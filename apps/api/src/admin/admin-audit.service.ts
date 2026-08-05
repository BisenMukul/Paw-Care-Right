import { BadRequestException, Injectable } from "@nestjs/common";
import { adminAuditPageSchema, type AdminAuditPage } from "@bombaypetcompany/types";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";

const AUDIT_SELECT = {
  id: true,
  surface: true,
  checkId: true,
  threadId: true,
  promptVersion: true,
  modelId: true,
  detectorFlags: true,
  costMicroUsd: true,
  latencyMs: true,
  status: true,
  createdAt: true,
} as const;

/**
 * T111 step 8: `/v1/admin/ai-audit`'s keyset cursor page over the
 * append-only `AiAuditLog` table. `orderBy: [{createdAt:"desc"},{id:"desc"}]`
 * + `cursor: {id}, skip: 1` is stable because rows are never updated
 * (T090 comment: "APPEND-ONLY"). `select` is the exact, pinned 11-column
 * allowlist -- ids, enum codes, versions and counts only, never content.
 * An unknown cursor id is explicitly pre-checked with a single indexed
 * `findUnique` before the page query: this Prisma client version does NOT
 * throw for a `findMany({ cursor })` pointing at a non-existent row (unlike
 * `findUniqueOrThrow`) -- it silently returns an empty page instead, which
 * would violate "never a silent empty page". The `PrismaClientKnownRequestError`
 * catch around the page query itself stays as a defensive second layer for
 * any other client-error shape (belt-and-braces, proven by the unit spec).
 * Either path resolves to `BadRequestException` (-> 400 `VALIDATION_FAILED`),
 * never a 500.
 */
@Injectable()
export class AdminAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async getPage(limit: number, cursor: string | undefined): Promise<AdminAuditPage> {
    if (cursor !== undefined) {
      const cursorRow = await this.prisma.aiAuditLog.findUnique({ where: { id: cursor }, select: { id: true } });
      if (cursorRow === null) {
        throw new BadRequestException();
      }
    }

    let rows;
    try {
      rows = await this.prisma.aiAuditLog.findMany({
        take: limit + 1,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        ...(cursor !== undefined ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: AUDIT_SELECT,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new BadRequestException();
      }
      throw error;
    }

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? (page[page.length - 1]?.id ?? null) : null;

    return adminAuditPageSchema.parse({
      rows: page.map((row) => ({
        id: row.id,
        surface: row.surface,
        checkId: row.checkId,
        threadId: row.threadId,
        promptVersion: row.promptVersion,
        modelId: row.modelId,
        detectorFlags: row.detectorFlags,
        costMicroUsd: row.costMicroUsd,
        latencyMs: row.latencyMs,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
      })),
      nextCursor,
    });
  }
}
