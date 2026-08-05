import { Logger } from "@nestjs/common";

import type { PrismaService } from "../prisma/prisma.service";
import { AiAuditService } from "./ai-audit.service";
import type { AiAuditEntry } from "./ai-audit.types";

function buildPrisma(overrides: { create?: jest.Mock } = {}) {
  const create = overrides.create ?? jest.fn().mockResolvedValue(undefined);
  return { prisma: { aiAuditLog: { create } } as unknown as PrismaService, create };
}

const CHECK_ENTRY: AiAuditEntry = {
  surface: "CHECK",
  checkId: "check-1",
  promptVersion: "triage-v1",
  modelId: "model-1",
  detectorFlags: ["source:ai"],
  costMicroUsd: 3,
  status: "OK",
};

const CHAT_ENTRY: AiAuditEntry = {
  surface: "CHAT",
  threadId: "thread-1",
  promptVersion: "chat-v1",
  modelId: "model-1",
  detectorFlags: [],
  costMicroUsd: 0,
  status: "OK",
};

describe("AiAuditService.record", () => {
  it("persists ids, versions, flags and costs only -- no content/text field (with latencyMs present)", async () => {
    const { prisma, create } = buildPrisma();
    const service = new AiAuditService(prisma);

    await service.record({ ...CHECK_ENTRY, latencyMs: 500 });

    const dataArg = create.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(Object.keys(dataArg).sort()).toEqual(
      ["checkId", "costMicroUsd", "detectorFlags", "latencyMs", "modelId", "promptVersion", "status", "surface", "threadId"].sort(),
    );
  });

  it("persists ids, versions, flags and costs only -- no content/text field (latencyMs absent)", async () => {
    const { prisma, create } = buildPrisma();
    const service = new AiAuditService(prisma);

    await service.record(CHAT_ENTRY);

    const dataArg = create.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(Object.keys(dataArg).sort()).toEqual(
      ["checkId", "costMicroUsd", "detectorFlags", "modelId", "promptVersion", "status", "surface", "threadId"].sort(),
    );
  });

  it("sets the non-applicable id column to null -- CHECK entry -> threadId: null", async () => {
    const { prisma, create } = buildPrisma();
    const service = new AiAuditService(prisma);

    await service.record(CHECK_ENTRY);

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ checkId: "check-1", threadId: null, surface: "CHECK" }),
    });
  });

  it("sets the non-applicable id column to null -- CHAT entry -> checkId: null", async () => {
    const { prisma, create } = buildPrisma();
    const service = new AiAuditService(prisma);

    await service.record(CHAT_ENTRY);

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ threadId: "thread-1", checkId: null, surface: "CHAT" }),
    });
  });

  it("clamps costMicroUsd to a non-negative rounded integer", async () => {
    const { prisma, create } = buildPrisma();
    const service = new AiAuditService(prisma);

    await service.record({ ...CHECK_ENTRY, costMicroUsd: -5.7 });

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ costMicroUsd: 0 }) }));
  });

  it("exposes no mutating method -- append-only surface", () => {
    const methodNames = Object.getOwnPropertyNames(AiAuditService.prototype).filter((name) => name !== "constructor");
    expect(methodNames).toEqual(["record"]);
  });

  it("never throws when the insert fails", async () => {
    const { prisma } = buildPrisma({ create: jest.fn().mockRejectedValue(new Error("db down")) });
    const service = new AiAuditService(prisma);
    const warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);

    try {
      await expect(service.record(CHECK_ENTRY)).resolves.toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({ event: "ai_audit_write_failed", checkId: "check-1", message: "db down" }),
      );
    } finally {
      warnSpy.mockRestore();
    }
  });
});
