import { BadRequestException, HttpException, HttpStatus, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Pet } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { ENTITLEMENT_RESOLVER, type EntitlementResolver } from "../quota/entitlement";
import { FREE_MAX_PETS } from "../quota/quota.constants";
import type { CreatePetDto } from "./dto/create-pet.dto";
import type { UpdatePetDto } from "./dto/update-pet.dto";

/** Public resource shape returned by the API — mirrors `packages/types`' `petSchema`. No `deletedAt`: internal only. */
export interface PetResponse {
  id: string;
  householdId: string;
  species: Pet["species"];
  sex: Pet["sex"];
  name: string;
  neutered: boolean;
  breedSlug: string | null;
  birthDate: Date | null;
  ageEstimateMonths: number | null;
  weightGrams: number | null;
  photoKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Household-scoped Pet CRUD with soft-delete. Every read/write query is
 * scoped to `{ householdId, deletedAt: null }` (list/get/update/remove) so
 * a caller can never observe, mutate, or "not-found-leak" a pet outside
 * their own resolved household, nor one already soft-deleted.
 */
@Injectable()
export class PetsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENTITLEMENT_RESOLVER) private readonly entitlementResolver: EntitlementResolver,
  ) {}

  async create(householdId: string, userId: string, dto: CreatePetDto): Promise<PetResponse> {
    this.assertAgeXor(dto.birthDate ? new Date(dto.birthDate) : null, dto.ageEstimateMonths ?? null);

    // Free-tier 1-pet gate (T075 plan decision 5 — household-scoped, SPEC
    // §7): authoritative from `Pet` rows, already server-side + reinstall-
    // safe. PREMIUM (household-scoped) lifts the gate for every member.
    const entitlement = await this.entitlementResolver.resolve(userId, householdId);
    if (entitlement.tier === "FREE") {
      const count = await this.prisma.pet.count({ where: { householdId, deletedAt: null } });
      if (count >= FREE_MAX_PETS) {
        throw new HttpException("Free tier is limited to one pet.", HttpStatus.PAYMENT_REQUIRED);
      }
    }

    const pet = await this.prisma.pet.create({
      data: {
        householdId,
        species: dto.species,
        name: dto.name,
        ...(dto.sex !== undefined ? { sex: dto.sex } : {}),
        ...(dto.neutered !== undefined ? { neutered: dto.neutered } : {}),
        ...(dto.breedSlug !== undefined ? { breedSlug: dto.breedSlug } : {}),
        ...(dto.photoKey !== undefined ? { photoKey: dto.photoKey } : {}),
        ...(dto.birthDate !== undefined ? { birthDate: new Date(dto.birthDate) } : {}),
        ...(dto.ageEstimateMonths !== undefined ? { ageEstimateMonths: dto.ageEstimateMonths } : {}),
        ...(dto.weightGrams !== undefined ? { weightGrams: dto.weightGrams } : {}),
      },
    });

    return this.toResponse(pet);
  }

  async findAll(householdId: string): Promise<PetResponse[]> {
    const pets = await this.prisma.pet.findMany({
      where: { householdId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });

    return pets.map((pet) => this.toResponse(pet));
  }

  async findOne(householdId: string, id: string): Promise<PetResponse> {
    const pet = await this.prisma.pet.findFirst({
      where: { id, householdId, deletedAt: null },
    });

    if (!pet) {
      throw new NotFoundException();
    }

    return this.toResponse(pet);
  }

  async update(householdId: string, id: string, dto: UpdatePetDto): Promise<PetResponse> {
    const existing = await this.prisma.pet.findFirst({
      where: { id, householdId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException();
    }

    // `"key" in dto` is NOT a reliable "was this key present in the request
    // body" check here: with this project's ES2022 compile target, plain
    // class-field declarations (`birthDate?: string | null`) are defined on
    // every DTO instance by JS class-field semantics as soon as
    // `class-transformer` does `new UpdatePetDto()`, so `"birthDate" in dto`
    // is `true` even when the field was omitted from the JSON body (its
    // value is simply left at the field-init default of `undefined`).
    // `dto.key !== undefined` is the correct test: an omitted key stays
    // `undefined`, while an explicit JSON `null` is copied through as `null`.
    const nextBirthDate: Date | null | undefined =
      dto.birthDate !== undefined ? (dto.birthDate === null ? null : new Date(dto.birthDate)) : undefined;

    const effectiveBirthDate: Date | null = nextBirthDate !== undefined ? nextBirthDate : existing.birthDate;
    const effectiveAge: number | null =
      dto.ageEstimateMonths !== undefined ? dto.ageEstimateMonths : existing.ageEstimateMonths;

    this.assertAgeXor(effectiveBirthDate, effectiveAge);

    const pet = await this.prisma.pet.update({
      where: { id },
      data: {
        ...(dto.species !== undefined ? { species: dto.species } : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.sex !== undefined ? { sex: dto.sex } : {}),
        ...(dto.neutered !== undefined ? { neutered: dto.neutered } : {}),
        ...(dto.breedSlug !== undefined ? { breedSlug: dto.breedSlug } : {}),
        ...(dto.photoKey !== undefined ? { photoKey: dto.photoKey } : {}),
        ...(nextBirthDate !== undefined ? { birthDate: nextBirthDate } : {}),
        ...(dto.ageEstimateMonths !== undefined ? { ageEstimateMonths: dto.ageEstimateMonths } : {}),
        ...(dto.weightGrams !== undefined ? { weightGrams: dto.weightGrams } : {}),
      },
    });

    return this.toResponse(pet);
  }

  async remove(householdId: string, id: string): Promise<PetResponse> {
    const existing = await this.prisma.pet.findFirst({
      where: { id, householdId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException();
    }

    const pet = await this.prisma.pet.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return this.toResponse(pet);
  }

  /** Throws `BadRequestException` (→ 400 VALIDATION_FAILED) when both are non-null. */
  private assertAgeXor(birthDate: Date | null, ageEstimateMonths: number | null): void {
    if (birthDate != null && ageEstimateMonths != null) {
      throw new BadRequestException("birthDate and ageEstimateMonths cannot both be set");
    }
  }

  private toResponse(pet: Pet): PetResponse {
    return {
      id: pet.id,
      householdId: pet.householdId,
      species: pet.species,
      sex: pet.sex,
      name: pet.name,
      neutered: pet.neutered,
      breedSlug: pet.breedSlug,
      birthDate: pet.birthDate,
      ageEstimateMonths: pet.ageEstimateMonths,
      weightGrams: pet.weightGrams,
      photoKey: pet.photoKey,
      createdAt: pet.createdAt,
      updatedAt: pet.updatedAt,
    };
  }
}
