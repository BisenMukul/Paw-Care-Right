import type { PrismaService } from "../prisma/prisma.service";
import {
  AI_AUDIT_RETENTION_BATCH_SIZE,
  AI_AUDIT_RETENTION_JOB_NAME,
  AI_AUDIT_RETENTION_MAX_BATCHES,
  AI_AUDIT_RETENTION_PATTERN,
  AI_AUDIT_RETENTION_QUEUE,
  AI_AUDIT_RETENTION_SCHEDULER_ID,
} from "./ai-audit-retention.contract";
import { AiAuditRetentionProcessor } from "./ai-audit-retention.processor";
import { AiAuditRetentionService } from "./ai-audit-retention.service";

interface Row {
  id: string;
  createdAt: Date;
}

function buildRows(count: number, createdAt: Date, prefix = "row"): Row[] {
  return Array.from({ length: count }, (_, i) => ({ id: `${prefix}-${i}`, createdAt }));
}

function buildPrisma(opts: { findManyImpl?: jest.Mock; deleteManyImpl?: jest.Mock } = {}) {
  const findMany = opts.findManyImpl ?? jest.fn().mockResolvedValue([]);
  const deleteMany = opts.deleteManyImpl ?? jest.fn().mockResolvedValue({ count: 0 });
  const prisma = { aiAuditLog: { findMany, deleteMany } } as unknown as PrismaService;
  return { prisma, findMany, deleteMany };
}

describe("AiAuditRetentionService.purge", () => {
  const NOW = new Date("2026-07-25T00:00:00.000Z");
  const CUTOFF = new Date("2026-04-26T00:00:00.000Z");

  it("computes a 90-day cutoff from the injected clock", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const { prisma } = buildPrisma({ findManyImpl: findMany });
    const service = new AiAuditRetentionService(prisma);

    const report = await service.purge(NOW);

    expect(report.cutoff).toEqual(CUTOFF);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { createdAt: { lt: CUTOFF } } }),
    );
  });

  it("never deletes rows at or newer than the cutoff (uses lt, not lte/gte)", async () => {
    const staleRows = buildRows(3, new Date("2026-01-01T00:00:00.000Z"), "stale");
    // Simulated fake Prisma: findMany is queried with `lt: cutoff`; a fake
    // that actually filters would only ever return the stale rows -- assert
    // the exact stale-id list reaches `deleteMany`, never a fresh id.
    const findMany = jest
      .fn()
      .mockImplementationOnce(async () => staleRows)
      .mockImplementationOnce(async () => []);
    const deleteMany = jest.fn().mockResolvedValue({ count: staleRows.length });
    const { prisma } = buildPrisma({ findManyImpl: findMany, deleteManyImpl: deleteMany });
    const service = new AiAuditRetentionService(prisma);

    const report = await service.purge(NOW);

    expect(deleteMany).toHaveBeenCalledTimes(1);
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: { in: staleRows.map((row) => row.id) } } });
    expect(report.deleted).toBe(3);
  });

  it("deletes in bounded batches and reports the total", async () => {
    const batch1 = buildRows(AI_AUDIT_RETENTION_BATCH_SIZE, new Date("2026-01-01T00:00:00.000Z"), "b1");
    const batch2 = buildRows(AI_AUDIT_RETENTION_BATCH_SIZE, new Date("2026-01-01T00:00:00.000Z"), "b2");
    const batch3 = buildRows(500, new Date("2026-01-01T00:00:00.000Z"), "b3");
    const findMany = jest
      .fn()
      .mockResolvedValueOnce(batch1)
      .mockResolvedValueOnce(batch2)
      .mockResolvedValueOnce(batch3);
    const deleteMany = jest.fn().mockResolvedValue({ count: 0 });
    const { prisma } = buildPrisma({ findManyImpl: findMany, deleteManyImpl: deleteMany });
    const service = new AiAuditRetentionService(prisma);

    const report = await service.purge(NOW);

    expect(deleteMany).toHaveBeenCalledTimes(3);
    expect(report).toMatchObject({ deleted: 2500, batches: 3, exhausted: false });
  });

  it("stops at MAX_BATCHES and reports exhausted when the supply never runs dry", async () => {
    const endlessBatch = buildRows(AI_AUDIT_RETENTION_BATCH_SIZE, new Date("2026-01-01T00:00:00.000Z"));
    const findMany = jest.fn().mockResolvedValue(endlessBatch);
    const deleteMany = jest.fn().mockResolvedValue({ count: 0 });
    const { prisma } = buildPrisma({ findManyImpl: findMany, deleteManyImpl: deleteMany });
    const service = new AiAuditRetentionService(prisma);

    const report = await service.purge(NOW);

    expect(findMany).toHaveBeenCalledTimes(AI_AUDIT_RETENTION_MAX_BATCHES);
    expect(report.batches).toBe(AI_AUDIT_RETENTION_MAX_BATCHES);
    expect(report.exhausted).toBe(true);
  });

  it("is idempotent -- a second run over already-purged data deletes nothing", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const deleteMany = jest.fn();
    const { prisma } = buildPrisma({ findManyImpl: findMany, deleteManyImpl: deleteMany });
    const service = new AiAuditRetentionService(prisma);

    const report = await service.purge(NOW);

    expect(deleteMany).not.toHaveBeenCalled();
    expect(report).toMatchObject({ deleted: 0, batches: 0 });
  });
});

describe("AiAuditRetentionProcessor.onApplicationBootstrap", () => {
  it("registers a daily repeatable scheduler with retry + DLQ opts", async () => {
    const upsertJobScheduler = jest.fn().mockResolvedValue(undefined);
    const queue = { upsertJobScheduler } as unknown as import("bullmq").Queue;
    const { prisma } = buildPrisma();
    const retention = new AiAuditRetentionService(prisma);
    const processor = new AiAuditRetentionProcessor(retention, queue);

    await processor.onApplicationBootstrap();

    expect(upsertJobScheduler).toHaveBeenCalledWith(
      AI_AUDIT_RETENTION_SCHEDULER_ID,
      { pattern: AI_AUDIT_RETENTION_PATTERN },
      expect.objectContaining({
        name: AI_AUDIT_RETENTION_JOB_NAME,
        opts: expect.objectContaining({
          attempts: 3,
          backoff: { type: "exponential", delay: 2000 },
          removeOnFail: false,
        }),
      }),
    );
  });
});

// Sanity: the queue name constant used by both the module wiring and this
// spec's processor construction is the single source of truth.
describe("AI_AUDIT_RETENTION_QUEUE", () => {
  it("is the pawcareright-prefixed queue name", () => {
    expect(AI_AUDIT_RETENTION_QUEUE).toBe("pawcareright-ai-audit-retention");
  });
});
