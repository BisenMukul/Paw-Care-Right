import { randomUUID } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { TestingModuleBuilder } from "@nestjs/testing";
import type {
  Household,
  Membership,
  Pet,
  Prisma,
  PrismaClient,
  Role,
  Species,
  Subscription,
  SubscriptionEntitlement,
  User,
} from "@prisma/client";
import request from "supertest";

import { DEFAULT_LOCALE, DEFAULT_REGION } from "../../src/auth/auth.constants";
import { AppConfigService } from "../../src/config/app-config.service";
import { CheckRunnerProcessor } from "../../src/workers/check-runner.processor";

/**
 * Shared e2e test factories. Plain functions (no fixtures framework) that
 * consolidate the duplicated user/household/membership provisioning, JWT
 * minting, and FK-ordered cleanup that used to be copy-pasted across the
 * auth-adjacent e2e suites (devices, guards, auth-social).
 */

export function uniqueEmail(prefix = "user"): string {
  return `${prefix}-${randomUUID()}@pawcareright.local`;
}

/** Registers a no-op CheckRunnerProcessor so BullMQ attaches NO live `pawcareright-checks`
 *  Worker for this app instance (the explorer keys off @Processor metadata on the resolved
 *  instance's constructor; a plain object has none). Only the T052 lifecycle suite omits this. */
export function overrideCheckRunner(builder: TestingModuleBuilder): TestingModuleBuilder {
  return builder.overrideProvider(CheckRunnerProcessor).useValue({ process: async () => undefined });
}

export function resolveJwtService(app: INestApplication): JwtService {
  try {
    return app.get(JwtService);
  } catch {
    // Falls back to a locally configured instance (same default secret
    // resolution as the app) if root-level DI resolution ever fails.
    return new JwtService({ secret: new AppConfigService().jwtSecret });
  }
}

export function mintAccessToken(jwt: JwtService, userId: string): string {
  return jwt.sign({ sub: userId });
}

export async function createUser(
  prisma: PrismaClient,
  overrides?: Partial<{
    email: string;
    locale: string;
    region: string;
    appleSub: string;
    googleSub: string;
  }>,
): Promise<User> {
  return prisma.user.create({
    data: {
      email: overrides?.email ?? uniqueEmail(),
      locale: overrides?.locale ?? DEFAULT_LOCALE,
      region: overrides?.region ?? DEFAULT_REGION,
      ...(overrides?.appleSub !== undefined ? { appleSub: overrides.appleSub } : {}),
      ...(overrides?.googleSub !== undefined ? { googleSub: overrides.googleSub } : {}),
    },
  });
}

export async function createHousehold(
  prisma: PrismaClient,
  ownerId: string,
  overrides?: { name?: string },
): Promise<Household> {
  const household = await prisma.household.create({
    data: { name: overrides?.name ?? "My Household", ownerId },
  });
  await prisma.membership.create({
    data: { userId: ownerId, householdId: household.id, role: "OWNER" },
  });
  return household;
}

export async function addMembership(
  prisma: PrismaClient,
  args: { userId: string; householdId: string; role: Role },
): Promise<Membership> {
  return prisma.membership.create({
    data: { userId: args.userId, householdId: args.householdId, role: args.role },
  });
}

export interface AuthedContext {
  user: User;
  household: Household;
  token: string;
  authedAgent: (
    method: "get" | "post" | "delete" | "patch" | "put",
    path: string,
  ) => request.Test;
}

export async function createAuthedContext(
  app: INestApplication,
  prisma: PrismaClient,
  jwt: JwtService,
  opts?: { role?: Role },
): Promise<AuthedContext> {
  const role = opts?.role ?? "OWNER";
  const user = await createUser(prisma);

  // `createHousehold` always makes its owner an OWNER member. For a
  // non-OWNER context, the household is owned by a separate user and
  // `user` is added as a plain member — the household's `ownerId` still
  // identifies that owner, so callers can pass both
  // `[context.user.id, context.household.ownerId]` to `cleanupUsers`.
  const household =
    role === "OWNER"
      ? await createHousehold(prisma, user.id)
      : await createHousehold(prisma, (await createUser(prisma)).id);

  if (role !== "OWNER") {
    await addMembership(prisma, { userId: user.id, householdId: household.id, role });
  }

  const token = mintAccessToken(jwt, user.id);

  const authedAgent = (method: "get" | "post" | "delete" | "patch" | "put", path: string) =>
    request(app.getHttpServer())[method](path).set("Authorization", `Bearer ${token}`);

  return { user, household, token, authedAgent };
}

export async function createPet(
  prisma: PrismaClient,
  householdId: string,
  overrides?: { species?: Species; name?: string },
): Promise<Pet> {
  return prisma.pet.create({
    data: {
      householdId,
      species: overrides?.species ?? "DOG",
      name: overrides?.name ?? "Fido",
    },
  });
}

/**
 * Consolidates the duplicated `owner()`/`member()` helpers that used to be
 * copy-pasted across the pets/photos/households e2e suites: mint an
 * authed context via `createAuthedContext` and track the resulting user
 * id(s) for `cleanupUsers`.
 */
export async function createOwnerContext(
  app: INestApplication,
  prisma: PrismaClient,
  jwt: JwtService,
  userIds: string[],
): Promise<AuthedContext> {
  const ctx = await createAuthedContext(app, prisma, jwt, { role: "OWNER" });
  userIds.push(ctx.user.id);
  return ctx;
}

export async function createMemberContext(
  app: INestApplication,
  prisma: PrismaClient,
  jwt: JwtService,
  userIds: string[],
): Promise<AuthedContext> {
  const ctx = await createAuthedContext(app, prisma, jwt, { role: "MEMBER" });
  userIds.push(ctx.user.id, ctx.household.ownerId);
  return ctx;
}

/**
 * Deletes everything FK'd to the given user ids, in dependency order, then
 * the users themselves. `Household.owner` is `onDelete: Restrict`, so
 * households owned by these users must be removed before the users.
 * No-op on an empty array.
 */
export async function cleanupUsers(
  prisma: PrismaClient,
  userIds: readonly string[],
): Promise<void> {
  if (userIds.length === 0) {
    return;
  }

  const ids = [...userIds];
  await prisma.membership.deleteMany({ where: { userId: { in: ids } } });
  await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
  await prisma.device.deleteMany({ where: { userId: { in: ids } } });
  await prisma.household.deleteMany({ where: { ownerId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

/**
 * T072 billing factory: seeds a `Subscription` mirror row. `Subscription`
 * FKs to both `User` (rcAppUserId, PK) and `Household` (both `onDelete:
 * Cascade`), so `cleanupUsers`'s existing `household.deleteMany` cascade
 * removes any row seeded here -- no cleanup-ordering change needed.
 */
export async function createSubscription(
  prisma: PrismaClient,
  args: {
    rcAppUserId: string;
    householdId: string;
    entitlement: SubscriptionEntitlement;
    plan?: string;
    status?: string;
    expiresAt?: Date | null;
  },
): Promise<Subscription> {
  return prisma.subscription.create({
    data: {
      rcAppUserId: args.rcAppUserId,
      householdId: args.householdId,
      entitlement: args.entitlement,
      plan: args.plan ?? null,
      status: args.status ?? "active",
      expiresAt: args.expiresAt ?? null,
      rawEventJson: {} as Prisma.InputJsonValue,
    },
  });
}

export * from "./health-logs";
