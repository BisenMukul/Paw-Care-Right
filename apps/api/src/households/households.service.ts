import {
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DEEPLINK_SCHEME } from "@pawcareright/config";
import { Prisma, type Role } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { ENTITLEMENT_RESOLVER, type EntitlementResolver } from "../quota/entitlement";
import { generateInviteCode } from "./invite-code";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Bounded retry loop against the (astronomically unlikely) `code` unique collision. */
const MAX_CODE_GENERATION_ATTEMPTS = 5;

export interface CreateInviteResult {
  code: string;
  deepLink: string;
  expiresAt: Date;
}

export interface AcceptInviteResult {
  householdId: string;
  name: string;
}

export interface HouseholdMemberResult {
  userId: string;
  email: string;
  role: Role;
}

export interface HouseholdMeResult {
  id: string;
  name: string;
  members: HouseholdMemberResult[];
}

/**
 * v1 system invariant (plan Risk R2 / CENTRAL DESIGN COLLISION): every user
 * has EXACTLY ONE household `Membership` at all times — every user is
 * auto-provisioned their own household (T012), and `HouseholdScopeGuard`'s
 * from-membership mode 404s whenever a caller's membership count is ever
 * anything other than exactly 1. `acceptInvite` therefore implements
 * JOIN-REPLACES: within the SAME transaction that creates the joiner's new
 * MEMBER membership in the invite's household, their current membership is
 * removed first — the household itself is deleted if they were its OWNER
 * (blocked by a pets-present 409 to avoid stranding pet data), or just their
 * membership row is dropped if they were a MEMBER elsewhere. The invariant
 * therefore never observably breaks, even mid-request. Multi-household
 * selection is deferred (see `HouseholdScopeGuard`, T027/T028).
 */
@Injectable()
export class HouseholdsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENTITLEMENT_RESOLVER) private readonly entitlementResolver: EntitlementResolver,
  ) {}

  async createInvite(householdId: string, createdById: string): Promise<CreateInviteResult> {
    // Premium-only feature lock (T075 plan decision 5) — a pure entitlement
    // check, no counter: FREE households cannot mint invites at all.
    const entitlement = await this.entitlementResolver.resolve(createdById, householdId);
    if (entitlement.tier === "FREE") {
      throw new HttpException("Household sharing is a premium feature.", HttpStatus.PAYMENT_REQUIRED);
    }

    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

    for (let attempt = 0; attempt < MAX_CODE_GENERATION_ATTEMPTS; attempt += 1) {
      const code = generateInviteCode();

      try {
        await this.prisma.householdInvite.create({
          data: { code, householdId, createdById, expiresAt },
        });

        return { code, deepLink: `${DEEPLINK_SCHEME}://join/${code}`, expiresAt };
      } catch (error) {
        const isLastAttempt = attempt === MAX_CODE_GENERATION_ATTEMPTS - 1;
        if (!this.isUniqueConstraintViolation(error) || isLastAttempt) {
          throw error;
        }
        // Unique `code` collision — vanishingly unlikely (1.1x10^12 space),
        // but retry with a freshly generated code rather than failing the
        // request outright.
      }
    }

    /* istanbul ignore next -- unreachable: the loop above always returns or throws. */
    throw new Error("failed to generate a unique invite code");
  }

  async acceptInvite(userId: string, code: string): Promise<AcceptInviteResult> {
    const invite = await this.prisma.householdInvite.findUnique({ where: { code } });

    if (!invite || invite.usedAt !== null || invite.expiresAt.getTime() <= Date.now()) {
      // Uniform 404 for not-found / expired / already-used — anti-probing
      // (plan Risk R1): a caller must not be able to distinguish an invalid
      // code from a live one they simply aren't allowed to use.
      throw new NotFoundException();
    }

    const memberships = await this.prisma.membership.findMany({ where: { userId } });
    if (memberships.length !== 1) {
      // Unsupported multi/zero-household state — fails safe (invariant guard).
      throw new ConflictException();
    }
    const sole = memberships[0]!;

    if (sole.householdId === invite.householdId) {
      // Already a member of the inviting household (covers self-accept of
      // one's own invite and re-accepting an already-joined household).
      throw new ConflictException();
    }

    return this.prisma.$transaction(async (tx) => {
      // Single-use claim: only one concurrent caller can win this atomic
      // update. A lost race (count 0) is indistinguishable from "used" —
      // uniform 404 (plan Risk R1).
      const claimed = await tx.householdInvite.updateMany({
        where: { id: invite.id, usedAt: null },
        data: { usedAt: new Date(), usedById: userId },
      });

      if (claimed.count !== 1) {
        throw new NotFoundException();
      }

      // Pets guard: never silently delete a household that still holds pet
      // data. Throwing here rolls back the claim above.
      const petCount = await tx.pet.count({
        where: { householdId: sole.householdId, deletedAt: null },
      });
      if (petCount > 0) {
        throw new ConflictException();
      }

      if (sole.role === "OWNER") {
        // Deletes the sole membership via cascade — no pets, asserted above.
        await tx.household.delete({ where: { id: sole.householdId } });
      } else {
        await tx.membership.delete({ where: { id: sole.id } });
      }

      // `@@unique([userId, householdId])` is a second backstop against a
      // double-join race.
      await tx.membership.create({
        data: { userId, householdId: invite.householdId, role: "MEMBER" },
      });

      const target = await tx.household.findUnique({ where: { id: invite.householdId } });
      if (!target) {
        // Defensive: the invite's household FK guarantees this row exists.
        throw new NotFoundException();
      }

      return { householdId: target.id, name: target.name };
    });
  }

  async getHouseholdMe(householdId: string): Promise<HouseholdMeResult> {
    const household = await this.prisma.household.findUnique({
      where: { id: householdId },
      include: { memberships: { include: { user: true } } },
    });

    if (!household) {
      // Defensive: `HouseholdScopeGuard` only injects a scope for a
      // membership it just resolved, so this household must exist.
      throw new NotFoundException();
    }

    return {
      id: household.id,
      name: household.name,
      members: household.memberships.map((membership) => ({
        userId: membership.userId,
        email: membership.user.email,
        role: membership.role,
      })),
    };
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
  }
}
