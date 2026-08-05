import type { ExecutionContext } from "@nestjs/common";
import { ServiceUnavailableException } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";

import { FeatureFlagGuard } from "./feature-flag.guard";
import type { FeatureFlagsService } from "./feature-flags.service";

function buildContext(): ExecutionContext {
  return {
    getHandler: () => (): void => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

describe("FeatureFlagGuard", () => {
  function buildGuard(getAllAndOverride: jest.Mock, isEnabled: jest.Mock) {
    const reflector = { getAllAndOverride } as unknown as Reflector;
    const featureFlags = { isEnabled } as unknown as FeatureFlagsService;

    return new FeatureFlagGuard(reflector, featureFlags);
  }

  it("no @RequiresFeature metadata ⇒ allows", async () => {
    const guard = buildGuard(jest.fn().mockReturnValue(undefined), jest.fn());

    await expect(guard.canActivate(buildContext())).resolves.toBe(true);
  });

  it("flag on ⇒ allows", async () => {
    const guard = buildGuard(jest.fn().mockReturnValue("checks"), jest.fn().mockResolvedValue(true));

    await expect(guard.canActivate(buildContext())).resolves.toBe(true);
  });

  it("flag off ⇒ throws ServiceUnavailableException", async () => {
    const guard = buildGuard(jest.fn().mockReturnValue("checks"), jest.fn().mockResolvedValue(false));

    await expect(guard.canActivate(buildContext())).rejects.toThrow(ServiceUnavailableException);
  });

  it("method-level metadata beats class-level (via getAllAndOverride)", async () => {
    const getAllAndOverride = jest.fn().mockReturnValue("chat");
    const isEnabled = jest.fn().mockResolvedValue(false);
    const guard = buildGuard(getAllAndOverride, isEnabled);

    await expect(guard.canActivate(buildContext())).rejects.toThrow(ServiceUnavailableException);
    expect(isEnabled).toHaveBeenCalledWith("chat");
  });
});
