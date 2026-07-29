import { ApiError, createQueryClient, setOnline } from "@bombaypetcompany/api-client";
import type { AgendaResponse } from "@bombaypetcompany/types";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { createMMKV } from "react-native-mmkv";
import type { ReactNode } from "react";
import React from "react";

import { agendaKeys, useCompleteOccurrence } from "../src/api/agenda-api";
import { apiClient } from "../src/api/client";
import { queryClient as appQueryClient } from "../src/api/query";
import { flushOutbox } from "../src/offline/flush-outbox";
import { MAX_OUTBOX_ATTEMPTS, useOutboxStore } from "../src/offline/outbox-store";
import { useOutboxFlush } from "../src/offline/use-outbox-flush";

/**
 * Offline reminder-completion outbox (T094 plan D1, AC2). `apiClient` is
 * mocked (mirrors `agenda-screen.test.tsx`); offline is driven by the REAL
 * shared `setOnline` store. The store + flush tests use the app's real
 * singleton `queryClient` (`../src/api/query`) directly, since
 * `flush-outbox.ts` itself imports that exact singleton (not a per-test
 * client) -- this is the ONLY module in the app that does, so tests must
 * match it to observe the fail-upward invalidate.
 */
jest.mock("../src/api/client", () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

const mockedPost = apiClient.post as jest.Mock;

function noRetryError(httpStatus: number, message = "request failed"): ApiError {
  const code =
    httpStatus === 404
      ? "NOT_FOUND"
      : httpStatus === 400
        ? "VALIDATION_FAILED"
        : httpStatus === 401
          ? "UNAUTHORIZED"
          : "INTERNAL";
  return new ApiError({ code, message, httpStatus, requestId: null });
}

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  };
}

function createTestQueryClient(): QueryClient {
  return createQueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } },
  });
}

/**
 * `gcTime: 0` (the default above) garbage-collects a manually-seeded query
 * the instant it has no active observer -- fine for tests that only assert
 * on the outbox/mocked-network side, but the integration test below seeds
 * agenda data directly via `setQueryData` (no `useAgenda()` observer is
 * ever mounted) and must read it back after the mutation, so QUERIES keep
 * the library's default (non-zero) `gcTime`. MUTATIONS still get
 * `gcTime: 0`: a settled `Mutation` schedules its OWN GC timer independent
 * of `QueryClient.clear()` (`MutationCache.clear()` drops the cache's
 * reference but never calls the mutation's own `destroy()`/
 * `clearGcTimeout()` -- confirmed by reading `mutationCache.ts`), so a
 * non-zero mutation `gcTime` here would leak a real ~5-minute timer past
 * the test (Jest's `--detectOpenHandles` pinned this exact leak).
 */
function createSeededQueryClient(): QueryClient {
  return createQueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false, gcTime: 0 } },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  useOutboxStore.getState().clear();
  appQueryClient.clear();
});

afterEach(async () => {
  await act(async () => {
    setOnline(true);
  });
  // Drain any flush left in-flight by a hook-triggered (not directly
  // awaited) reconnect within the test that just ran -- `flushOutbox`'s
  // module-level in-flight guard must settle (and clear itself) before the
  // NEXT test's `beforeEach` clears the outbox, or a stale in-flight
  // promise would short-circuit the next test's own `flushOutbox()` call.
  // Calling it again while already in-flight just awaits the SAME promise.
  await act(async () => {
    await flushOutbox().catch(() => undefined);
  });
});

describe("useOutboxStore", () => {
  it("enqueue builds the id as `${reminderId}:${dueAt}`", () => {
    useOutboxStore.getState().enqueue({ reminderId: "r1", dueAt: "2024-01-01T09:00:00.000Z" });

    expect(useOutboxStore.getState().items).toEqual([
      expect.objectContaining({ id: "r1:2024-01-01T09:00:00.000Z", reminderId: "r1", dueAt: "2024-01-01T09:00:00.000Z", attempts: 0 }),
    ]);
  });

  it("enqueue is a no-op when an item with the same id is already queued", () => {
    useOutboxStore.getState().enqueue({ reminderId: "r1", dueAt: "2024-01-01T09:00:00.000Z" });
    useOutboxStore.getState().enqueue({ reminderId: "r1", dueAt: "2024-01-01T09:00:00.000Z" });

    expect(useOutboxStore.getState().items).toHaveLength(1);
  });

  it("remove drops exactly the matching item", () => {
    useOutboxStore.getState().enqueue({ reminderId: "r1", dueAt: "d1" });
    useOutboxStore.getState().enqueue({ reminderId: "r2", dueAt: "d2" });

    useOutboxStore.getState().remove("r1:d1");

    expect(useOutboxStore.getState().items.map((item) => item.id)).toEqual(["r2:d2"]);
  });

  it("markAttempt increments attempts on the matching item only", () => {
    useOutboxStore.getState().enqueue({ reminderId: "r1", dueAt: "d1" });
    useOutboxStore.getState().enqueue({ reminderId: "r2", dueAt: "d2" });

    useOutboxStore.getState().markAttempt("r1:d1");

    expect(useOutboxStore.getState().items.find((item) => item.id === "r1:d1")?.attempts).toBe(1);
    expect(useOutboxStore.getState().items.find((item) => item.id === "r2:d2")?.attempts).toBe(0);
  });

  it("the outbox survives a cold start (persisted to MMKV under bombaypetcompany.reminder-outbox)", async () => {
    useOutboxStore.getState().enqueue({ reminderId: "r1", dueAt: "2024-01-01T09:00:00.000Z" });

    const mmkv = createMMKV();
    const persistedRaw = mmkv.getString("bombaypetcompany.reminder-outbox");
    expect(persistedRaw).toBeTruthy();
    expect(persistedRaw).toContain("r1");

    // Simulate relaunch: clear in-memory state, then rehydrate from the
    // still-persisted snapshot (mirrors `active-pet-store.test.ts`).
    useOutboxStore.setState({ items: [] });
    mmkv.set("bombaypetcompany.reminder-outbox", persistedRaw as string);
    await useOutboxStore.persist.rehydrate();

    expect(useOutboxStore.getState().items).toEqual([expect.objectContaining({ reminderId: "r1" })]);
  });
});

describe("flushOutbox", () => {
  it("a flush while still offline is a no-op", async () => {
    await act(async () => {
      setOnline(false);
    });
    useOutboxStore.getState().enqueue({ reminderId: "r1", dueAt: "d1" });

    const result = await flushOutbox();

    expect(result).toEqual({ synced: 0, dropped: 0, remaining: 1 });
    expect(mockedPost).not.toHaveBeenCalled();
  });

  it("reconnect flushes the queue: the completion POSTs once and the item is removed", async () => {
    useOutboxStore.getState().enqueue({ reminderId: "r1", dueAt: "2024-01-01T09:00:00.000Z" });
    mockedPost.mockResolvedValueOnce({});
    const invalidateSpy = jest.spyOn(appQueryClient, "invalidateQueries");

    const result = await flushOutbox();

    expect(mockedPost).toHaveBeenCalledTimes(1);
    expect(mockedPost).toHaveBeenCalledWith("/v1/reminders/r1/complete", { dueAt: "2024-01-01T09:00:00.000Z" });
    expect(result).toEqual({ synced: 1, dropped: 0, remaining: 0 });
    expect(useOutboxStore.getState().items).toEqual([]);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: agendaKeys.all });
  });

  it("duplicate completion is harmless server-side even if replayed: a re-flush of an already-synced item is a no-op", async () => {
    useOutboxStore.getState().enqueue({ reminderId: "r1", dueAt: "d1" });
    mockedPost.mockResolvedValueOnce({});

    await flushOutbox();
    expect(useOutboxStore.getState().items).toEqual([]);

    // The server's own `ReminderEvent.reminderId_dueAt` upsert makes a
    // replay harmless (apps/api reminders.service.spec.ts:821-822 pins the
    // server-side contract; this only proves the CLIENT never re-sends an
    // already-synced item).
    const result = await flushOutbox();

    expect(result).toEqual({ synced: 0, dropped: 0, remaining: 0 });
    expect(mockedPost).toHaveBeenCalledTimes(1);
  });

  it("stale completion: a 404 (reminder deleted while offline) DROPS the item and re-syncs the agenda", async () => {
    useOutboxStore.getState().enqueue({ reminderId: "r1", dueAt: "d1" });
    mockedPost.mockRejectedValueOnce(noRetryError(404));
    const invalidateSpy = jest.spyOn(appQueryClient, "invalidateQueries");

    const result = await flushOutbox();

    expect(result).toEqual({ synced: 0, dropped: 1, remaining: 0 });
    expect(useOutboxStore.getState().items).toEqual([]);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: agendaKeys.all });
  });

  it("stale completion: a 400 (dueAt is no longer an occurrence) also drops", async () => {
    useOutboxStore.getState().enqueue({ reminderId: "r1", dueAt: "d1" });
    mockedPost.mockRejectedValueOnce(noRetryError(400));

    const result = await flushOutbox();

    expect(result).toEqual({ synced: 0, dropped: 1, remaining: 0 });
    expect(useOutboxStore.getState().items).toEqual([]);
  });

  it("auth expiry: a 401 STOPS the flush and keeps every item queued", async () => {
    useOutboxStore.getState().enqueue({ reminderId: "r1", dueAt: "d1" });
    useOutboxStore.getState().enqueue({ reminderId: "r2", dueAt: "d2" });
    mockedPost.mockRejectedValueOnce(noRetryError(401));

    const result = await flushOutbox();

    expect(result).toEqual({ synced: 0, dropped: 0, remaining: 2 });
    expect(useOutboxStore.getState().items).toHaveLength(2);
    expect(mockedPost).toHaveBeenCalledTimes(1);
    // F1 fix (checker T094 review): a 401 is RETENTION, not an attempt --
    // deleting the dedicated 401 branch would fall through to the
    // defensive-transient fallback, which calls `markAttempt`. Pinning
    // `attempts === 0` here means that regression cannot hide behind this
    // test's other (unchanged) assertions.
    expect(useOutboxStore.getState().items.every((item) => item.attempts === 0)).toBe(true);
  });

  it("auth expiry: 401 retention never burns attempts, even across 6 consecutive re-auth failures (never converts to a poison drop)", async () => {
    // Reproduces the checker's own regression probe: without the dedicated
    // 401 branch, a 401 falls through to the defensive-transient fallback
    // (`markAttempt` + conditional remove once `attempts >= MAX_OUTBOX_ATTEMPTS`),
    // so the SAME queued completion would be silently dropped on the 5th
    // consecutive auth failure instead of surviving indefinitely until a
    // real re-auth (plan D6).
    useOutboxStore.getState().enqueue({ reminderId: "r1", dueAt: "d1" });

    for (let i = 0; i < 6; i += 1) {
      mockedPost.mockRejectedValueOnce(noRetryError(401));
      // Sequential by design: each flush must fully settle (and clear the
      // module-level in-flight guard) before the next one starts.
      await flushOutbox();
    }

    expect(useOutboxStore.getState().items).toHaveLength(1);
    expect(useOutboxStore.getState().items[0]?.attempts).toBe(0);
  });

  it("a 500 keeps the item, increments attempts, and stops the flush", async () => {
    useOutboxStore.getState().enqueue({ reminderId: "r1", dueAt: "d1" });
    useOutboxStore.getState().enqueue({ reminderId: "r2", dueAt: "d2" });
    mockedPost.mockRejectedValueOnce(noRetryError(500));

    const result = await flushOutbox();

    expect(result).toEqual({ synced: 0, dropped: 0, remaining: 2 });
    expect(useOutboxStore.getState().items[0]?.attempts).toBe(1);
    expect(mockedPost).toHaveBeenCalledTimes(1);
  });

  it("a poison item is dropped after MAX_OUTBOX_ATTEMPTS", async () => {
    useOutboxStore.getState().enqueue({ reminderId: "r1", dueAt: "d1" });

    for (let i = 0; i < MAX_OUTBOX_ATTEMPTS - 1; i += 1) {
      mockedPost.mockRejectedValueOnce(noRetryError(500));
      await flushOutbox();
      expect(useOutboxStore.getState().items).toHaveLength(1);
    }

    mockedPost.mockRejectedValueOnce(noRetryError(500));
    const finalResult = await flushOutbox();

    expect(finalResult.dropped).toBe(1);
    expect(useOutboxStore.getState().items).toEqual([]);
  });

  it("two concurrent flushes issue exactly one POST", async () => {
    useOutboxStore.getState().enqueue({ reminderId: "r1", dueAt: "d1" });
    let resolvePost!: (value: unknown) => void;
    mockedPost.mockImplementationOnce(() => new Promise((resolve) => (resolvePost = resolve)));

    const first = flushOutbox();
    const second = flushOutbox();
    resolvePost({});
    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(mockedPost).toHaveBeenCalledTimes(1);
    expect(firstResult).toEqual(secondResult);
  });
});

describe("useCompleteOccurrence + outbox integration", () => {
  function buildAgenda(): AgendaResponse {
    return {
      from: "2020-01-01T00:00:00.000Z",
      to: "2020-02-01T00:00:00.000Z",
      entries: [
        {
          reminderId: "r1",
          petId: "pet-1",
          type: "VACCINE",
          title: "Rabies booster",
          dueAt: "2024-01-01T09:00:00.000Z",
          status: "SCHEDULED",
          virtual: true,
        },
      ],
    };
  }

  it("completing a reminder while offline enqueues it and makes ZERO network calls", async () => {
    const client = createSeededQueryClient();
    client.setQueryData(agendaKeys.window({ from: "2020-01-01T00:00:00.000Z", to: "2020-02-01T00:00:00.000Z" }), buildAgenda());

    await act(async () => {
      setOnline(false);
    });

    const { result, unmount } = await renderHook(() => useCompleteOccurrence(), { wrapper: makeWrapper(client) });

    await act(async () => {
      await result.current.mutateAsync({ reminderId: "r1", dueAt: "2024-01-01T09:00:00.000Z" });
    });

    expect(mockedPost).not.toHaveBeenCalled();
    expect(useOutboxStore.getState().items).toEqual([
      expect.objectContaining({ id: "r1:2024-01-01T09:00:00.000Z" }),
    ]);

    const cached = client.getQueryData<AgendaResponse>(
      agendaKeys.window({ from: "2020-01-01T00:00:00.000Z", to: "2020-02-01T00:00:00.000Z" }),
    );
    expect(cached?.entries[0]?.status).toBe("DONE");

    unmount();

    // `createSeededQueryClient` deliberately keeps a non-zero `gcTime` (so
    // the manually-seeded, observer-less query survives long enough to be
    // read back above) -- that same non-zero `gcTime` schedules a real GC
    // timer that would otherwise leak past this test. `clear()` removes
    // every cached query (which cancels its GC timeout, per
    // `Removable.destroy()`) -- `unmount()` alone does NOT touch it (Jest's
    // `--detectOpenHandles` pinned this leak; every test-scoped QueryClient
    // must be disposed).
    client.clear();
  });

  it("duplicate completion: tapping done twice offline enqueues ONE item and POSTs once (after reconnect)", async () => {
    const client = createTestQueryClient();

    await act(async () => {
      setOnline(false);
    });

    const { result } = await renderHook(() => useCompleteOccurrence(), { wrapper: makeWrapper(client) });

    await act(async () => {
      await result.current.mutateAsync({ reminderId: "r1", dueAt: "d1" });
    });
    await act(async () => {
      await result.current.mutateAsync({ reminderId: "r1", dueAt: "d1" });
    });

    expect(useOutboxStore.getState().items).toHaveLength(1);

    mockedPost.mockResolvedValueOnce({});
    await act(async () => {
      setOnline(true);
    });
    // No `useOutboxFlush()` is mounted in this describe block -- reconnect
    // sync is driven explicitly here (the hook's own transition wiring is
    // covered by the `useOutboxFlush` describe block below).
    await flushOutbox();

    expect(mockedPost).toHaveBeenCalledTimes(1);
  });
});

describe("useOutboxFlush", () => {
  it("flushes once on mount when already online with pending items (cold start)", async () => {
    useOutboxStore.getState().enqueue({ reminderId: "r1", dueAt: "d1" });
    mockedPost.mockResolvedValueOnce({});

    await renderHook(() => useOutboxFlush());

    await waitFor(() => {
      expect(mockedPost).toHaveBeenCalledTimes(1);
    });
  });

  it("flushes on an offline->online transition and not on every render", async () => {
    await act(async () => {
      setOnline(false);
    });
    const { rerender } = await renderHook(() => useOutboxFlush());

    expect(mockedPost).not.toHaveBeenCalled();

    useOutboxStore.getState().enqueue({ reminderId: "r1", dueAt: "d1" });
    mockedPost.mockResolvedValueOnce({});

    await act(async () => {
      setOnline(true);
    });
    await waitFor(() => {
      expect(mockedPost).toHaveBeenCalledTimes(1);
    });

    // A re-render with no offline->online transition must not re-flush.
    rerender({});
    await act(async () => {});
    expect(mockedPost).toHaveBeenCalledTimes(1);
  });
});
