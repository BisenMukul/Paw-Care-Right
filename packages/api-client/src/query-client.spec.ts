import { MutationCache } from "@tanstack/react-query";

import { ApiError } from "./errors";
import { createQueryClient } from "./query-client";

describe("createQueryClient", () => {
  it("uses a passed mutationCache (T075 passthrough)", () => {
    const cache = new MutationCache();

    const client = createQueryClient({ mutationCache: cache });

    expect(client.getMutationCache()).toBe(cache);
  });

  it("falls back to a default MutationCache when none is passed (backward-compatible)", () => {
    const client = createQueryClient();

    expect(client.getMutationCache()).toBeInstanceOf(MutationCache);
  });

  it("still applies the no-retry-on-4xx default when a mutationCache is passed", () => {
    const client = createQueryClient({ mutationCache: new MutationCache() });

    const retry = client.getDefaultOptions().mutations?.retry as
      | ((failureCount: number, error: unknown) => boolean)
      | undefined;
    expect(retry).toBeDefined();
    expect(retry?.(0, new ApiError({ code: "PAYMENT_REQUIRED", message: "x", httpStatus: 402, requestId: null }))).toBe(
      false,
    );
  });
});
