import { ApiError } from "@pawcareright/api-client";
import type { Mutation } from "@tanstack/react-query";

import { queryClient } from "../src/api/query";
import { useUpsellStore } from "../src/billing/upsell-store";

/**
 * T075 AC "upsell sheet triggered by error code (mobile test)". Drives the
 * central `MutationCache`'s own `onError` (wired in `src/api/query.ts`)
 * directly, rather than re-implementing the interceptor logic — a real
 * regression in `query.ts` fails this suite. `MutationCacheConfig` isn't a
 * public `@tanstack/react-query` export, so `config.onError` is read via a
 * minimal structural type rather than the library's internal one.
 */
type OnErrorConfig = { onError?: (error: unknown, variables: unknown, context: unknown, mutation: unknown) => unknown };

describe("central 402-upsell MutationCache.onError interceptor", () => {
  function fakeMutation(meta?: Record<string, unknown>): Mutation<unknown, unknown, unknown> {
    return { options: { meta } } as unknown as Mutation<unknown, unknown, unknown>;
  }

  function fireOnError(error: unknown, meta?: Record<string, unknown>): void {
    const onError = (queryClient.getMutationCache().config as OnErrorConfig).onError;
    onError?.(error, undefined, undefined, fakeMutation(meta));
  }

  beforeEach(() => {
    useUpsellStore.setState({ visible: false });
  });

  afterEach(() => {
    useUpsellStore.setState({ visible: false });
  });

  it("PAYMENT_REQUIRED, no skipUpsell meta -> visible becomes true", () => {
    fireOnError(new ApiError({ code: "PAYMENT_REQUIRED", message: "quota", httpStatus: 402, requestId: null }));

    expect(useUpsellStore.getState().visible).toBe(true);
  });

  it("a non-PAYMENT_REQUIRED ApiError -> stays false", () => {
    fireOnError(new ApiError({ code: "VALIDATION_FAILED", message: "bad", httpStatus: 400, requestId: null }));

    expect(useUpsellStore.getState().visible).toBe(false);
  });

  it("PAYMENT_REQUIRED WITH meta.skipUpsell:true -> stays false (checks path suppressed)", () => {
    fireOnError(
      new ApiError({ code: "PAYMENT_REQUIRED", message: "quota", httpStatus: 402, requestId: null }),
      { skipUpsell: true },
    );

    expect(useUpsellStore.getState().visible).toBe(false);
  });

  it("a non-ApiError error -> stays false", () => {
    fireOnError(new Error("network down"));

    expect(useUpsellStore.getState().visible).toBe(false);
  });
});
