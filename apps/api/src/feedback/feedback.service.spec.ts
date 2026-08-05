import { BadRequestException, NotFoundException } from "@nestjs/common";

import type { PrismaService } from "../prisma/prisma.service";
import type { StorageService } from "../storage/storage.service";
import type { SubmitFeedbackDto } from "./dto/submit-feedback.dto";
import { FeedbackService } from "./feedback.service";

describe("FeedbackService", () => {
  const userId = "user-1";

  function buildDeps(overrides: {
    create?: jest.Mock;
    getPresignedPutUrl?: jest.Mock;
    objectExists?: jest.Mock;
  }) {
    const create =
      overrides.create ??
      jest.fn().mockResolvedValue({ id: "report-1", createdAt: new Date("2024-01-01T00:00:00.000Z") });

    const prisma = {
      feedbackReport: { create },
    } as unknown as PrismaService;

    const storage = {
      getPresignedPutUrl: overrides.getPresignedPutUrl ?? jest.fn().mockResolvedValue("https://signed.example/put"),
      objectExists: overrides.objectExists ?? jest.fn().mockResolvedValue(true),
    } as unknown as StorageService;

    return { prisma, storage, create };
  }

  function baseDto(): SubmitFeedbackDto {
    return {
      category: "BUG",
      message: "The app crashed.",
      platform: "ios",
      appVersion: "1.0.0",
      attachLogs: false,
    } as SubmitFeedbackDto;
  }

  describe("createScreenshotUploadUrl", () => {
    it("builds a key under feedback/<userId>/ and signs it as image/jpeg", async () => {
      const getPresignedPutUrl = jest.fn().mockResolvedValue("https://signed.example/put");
      const { prisma, storage } = buildDeps({ getPresignedPutUrl });
      const service = new FeedbackService(prisma, storage);

      const result = await service.createScreenshotUploadUrl(userId, {});

      expect(result.key).toMatch(new RegExp(`^feedback/${userId}/[0-9a-f-]+\\.jpg$`));
      expect(getPresignedPutUrl).toHaveBeenCalledWith({ key: result.key, contentType: "image/jpeg" });
      expect(result.uploadUrl).toBe("https://signed.example/put");
    });
  });

  describe("submit", () => {
    it("happy path: persists the expected row and returns { reportId, createdAt }", async () => {
      const create = jest
        .fn()
        .mockResolvedValue({ id: "report-1", createdAt: new Date("2024-01-01T00:00:00.000Z") });
      const { prisma, storage } = buildDeps({ create });
      const service = new FeedbackService(prisma, storage);
      const dto = baseDto();

      const result = await service.submit(userId, dto);

      expect(create).toHaveBeenCalledWith({
        data: {
          userId,
          category: "BUG",
          message: "The app crashed.",
          platform: "ios",
          appVersion: "1.0.0",
          logsConsent: false,
          logs: [],
          screenshotKey: null,
          sentryEventId: null,
          sentryRelease: null,
        },
        select: { id: true, createdAt: true },
      });
      expect(result).toEqual({ reportId: "report-1", createdAt: "2024-01-01T00:00:00.000Z" });
    });

    it("throws BadRequestException when logs are supplied without attachLogs consent, no row created", async () => {
      const create = jest.fn();
      const { prisma, storage } = buildDeps({ create });
      const service = new FeedbackService(prisma, storage);
      const dto: SubmitFeedbackDto = {
        ...baseDto(),
        attachLogs: false,
        logs: [{ at: "2024-01-01T00:00:00.000Z", level: "error", code: "captured_error" }],
      } as SubmitFeedbackDto;

      await expect(service.submit(userId, dto)).rejects.toBeInstanceOf(BadRequestException);
      expect(create).not.toHaveBeenCalled();
    });

    it("stores logs:[] and logsConsent:false when attachLogs is false and no logs are supplied", async () => {
      const create = jest
        .fn()
        .mockResolvedValue({ id: "report-2", createdAt: new Date("2024-01-01T00:00:00.000Z") });
      const { prisma, storage } = buildDeps({ create });
      const service = new FeedbackService(prisma, storage);

      await service.submit(userId, baseDto());

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ logs: [], logsConsent: false }) }),
      );
    });

    it("stores the supplied logs and logsConsent:true when attachLogs is true", async () => {
      const create = jest
        .fn()
        .mockResolvedValue({ id: "report-3", createdAt: new Date("2024-01-01T00:00:00.000Z") });
      const { prisma, storage } = buildDeps({ create });
      const service = new FeedbackService(prisma, storage);
      const entry = { at: "2024-01-01T00:00:00.000Z", level: "error" as const, code: "captured_error" as const };
      const dto: SubmitFeedbackDto = { ...baseDto(), attachLogs: true, logs: [entry] } as SubmitFeedbackDto;

      await service.submit(userId, dto);

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ logs: [entry], logsConsent: true }) }),
      );
    });

    it("throws BadRequestException for a screenshotKey outside this user's feedback namespace, no objectExists/create call", async () => {
      const objectExists = jest.fn();
      const create = jest.fn();
      const { prisma, storage } = buildDeps({ objectExists, create });
      const service = new FeedbackService(prisma, storage);
      const dto: SubmitFeedbackDto = { ...baseDto(), screenshotKey: "feedback/other-user/x.jpg" } as SubmitFeedbackDto;

      await expect(service.submit(userId, dto)).rejects.toBeInstanceOf(BadRequestException);
      expect(objectExists).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the screenshot object was never uploaded, no create call", async () => {
      const objectExists = jest.fn().mockResolvedValue(false);
      const create = jest.fn();
      const { prisma, storage } = buildDeps({ objectExists, create });
      const service = new FeedbackService(prisma, storage);
      const dto: SubmitFeedbackDto = {
        ...baseDto(),
        screenshotKey: `feedback/${userId}/never-uploaded.jpg`,
      } as SubmitFeedbackDto;

      await expect(service.submit(userId, dto)).rejects.toBeInstanceOf(NotFoundException);
      expect(create).not.toHaveBeenCalled();
    });

    it("never logs message content", async () => {
      const create = jest
        .fn()
        .mockResolvedValue({ id: "report-4", createdAt: new Date("2024-01-01T00:00:00.000Z") });
      const { prisma, storage } = buildDeps({ create });
      const service = new FeedbackService(prisma, storage);
      const loggerSpy = jest.spyOn((service as unknown as { logger: { log: (...args: unknown[]) => void } }).logger, "log");
      const dto = { ...baseDto(), message: "SECRET_MESSAGE_CONTENT" } as SubmitFeedbackDto;

      await service.submit(userId, dto);

      for (const call of loggerSpy.mock.calls) {
        expect(JSON.stringify(call)).not.toContain("SECRET_MESSAGE_CONTENT");
      }
    });
  });
});
