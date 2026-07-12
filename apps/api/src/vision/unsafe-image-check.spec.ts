import { Logger } from "@nestjs/common";

import { LogOnlyUnsafeImageCheck } from "./unsafe-image-check";

describe("LogOnlyUnsafeImageCheck", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns ok and logs", async () => {
    const logSpy = jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    const check = new LogOnlyUnsafeImageCheck();

    const result = await check.check({ bytes: Buffer.from("x"), key: "pets/p1/original/a.jpg" });

    expect(result).toEqual({ verdict: "ok" });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("pets/p1/original/a.jpg"));
  });
});
