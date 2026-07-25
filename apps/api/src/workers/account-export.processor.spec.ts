import type { AccountExportService } from "../me/account-export.service";
import { AccountExportProcessor } from "./account-export.processor";
import type { AccountExportJobData } from "./account-export.contract";

/**
 * Direct-invoke unit test (mirrors `images.processor.spec.ts`): constructs
 * `AccountExportProcessor` with a mocked `AccountExportService` and calls
 * `process()` on a hand-built `Job`-shaped object -- no real BullMQ/Redis/
 * MinIO involved here (that round-trip is the e2e suite's job).
 */
describe("AccountExportProcessor", () => {
  function buildJob(data: AccountExportJobData) {
    return { id: "job-1", data } as unknown as Parameters<AccountExportProcessor["process"]>[0];
  }

  it("delegates to AccountExportService.build with the job's exportId/userId", async () => {
    const build = jest.fn().mockResolvedValue(undefined);
    const exportService = { build } as unknown as AccountExportService;
    const processor = new AccountExportProcessor(exportService);

    await processor.process(buildJob({ exportId: "export-1", userId: "user-1" }));

    expect(build).toHaveBeenCalledWith("export-1", "user-1");
  });

  it("propagates a build failure so BullMQ retries", async () => {
    const build = jest.fn().mockRejectedValue(new Error("build failed"));
    const exportService = { build } as unknown as AccountExportService;
    const processor = new AccountExportProcessor(exportService);

    await expect(processor.process(buildJob({ exportId: "export-1", userId: "user-1" }))).rejects.toThrow(
      "build failed",
    );
  });
});
