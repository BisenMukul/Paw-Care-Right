import { ApiError, setOnline } from "@pawcareright/api-client";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { apiClient } from "../src/api/client";
import { useChatStore } from "../src/chat/chat-store";
import { isNearBottom, NEAR_BOTTOM_THRESHOLD_PX } from "../src/chat/scroll";
import { useChatStream } from "../src/chat/use-chat-stream";

/**
 * `useChatStream` state-machine spec (T083 plan AC1/AC2 + D7 reducer
 * rules). `apiClient` is mocked (mirrors `checks-api.test.ts`) so
 * `post`/`streamSse` are scriptable spies instead of hitting the network;
 * `expo-crypto`'s `randomUUID` is mocked to fixed, counting values (mirrors
 * `check-submission.test.tsx`). Offline is driven via the REAL shared
 * `setOnline` store (mirrors `home-screen.test.tsx`).
 */
jest.mock("../src/api/client", () => ({
  apiClient: { post: jest.fn(), streamSse: jest.fn(), get: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

let mockUuidCounter = 0;
jest.mock("expo-crypto", () => ({
  randomUUID: jest.fn(() => `uuid-${++mockUuidCounter}`),
}));

const mockedPost = apiClient.post as jest.Mock;
const mockedStreamSse = apiClient.streamSse as jest.Mock;

interface FrameSpec {
  event: string;
  data: unknown;
}

function toFrame(spec: FrameSpec) {
  return { event: spec.event, data: JSON.stringify(spec.data) };
}

interface OnFrameOptions {
  onFrame: (frame: { event: string; data: string }) => void;
}

/** A `streamSse` stand-in that dispatches the given frames in order, then resolves (mirrors `streamSseRequest` ending normally without a synthetic `done`, or WITH one if the fixture includes it). */
function scriptedStream(frames: FrameSpec[]) {
  return jest.fn(async (_path: string, _body: unknown, options: OnFrameOptions) => {
    for (const spec of frames) {
      options.onFrame(toFrame(spec));
    }
  });
}

const THREAD = { id: "thread-1", petId: "pet1", createdAt: "2024-01-01T00:00:00.000Z" };

beforeEach(() => {
  jest.clearAllMocks();
  mockUuidCounter = 0;
  useChatStore.setState({ threadIdByPetId: {}, messagesByPetId: {} });
});

afterEach(async () => {
  await act(async () => {
    setOnline(true);
  });
});

describe("useChatStream", () => {
  it("offline: send() sets state 'offline' and makes zero network calls", async () => {
    await act(async () => {
      setOnline(false);
    });
    const { result } = await renderHook(() => useChatStream("pet1"));

    await act(async () => {
      result.current.send("hello");
    });

    expect(result.current.state).toBe("offline");
    expect(mockedPost).not.toHaveBeenCalled();
    expect(mockedStreamSse).not.toHaveBeenCalled();
  });

  it("creates a thread lazily on first send, and reuses it (no second POST) on a later send", async () => {
    mockedPost.mockResolvedValue(THREAD);
    mockedStreamSse.mockImplementation(
      scriptedStream([
        { event: "start", data: { threadId: "thread-1", userMessageId: "u1", assistantMessageId: "a1" } },
        { event: "done", data: { assistantMessageId: "a1", status: "OK", quota: { used: 1, limit: 200, remaining: 199 } } },
      ]),
    );
    const { result } = await renderHook(() => useChatStream("pet1"));

    await act(async () => {
      result.current.send("hi");
    });
    await waitFor(() => expect(result.current.state).toBe("idle"));

    expect(mockedPost).toHaveBeenCalledTimes(1);
    expect(mockedPost).toHaveBeenCalledWith("/v1/chat/threads", { petId: "pet1" });
    expect(mockedStreamSse.mock.calls[0]?.[0]).toBe("/v1/chat/threads/thread-1/messages");

    await act(async () => {
      result.current.send("again");
    });
    await waitFor(() => expect(mockedStreamSse).toHaveBeenCalledTimes(2));
    expect(mockedPost).toHaveBeenCalledTimes(1);
  });

  it("chunk `seq` values arrive strictly monotonically -- text is appended in arrival order, never reordered", async () => {
    mockedPost.mockResolvedValue(THREAD);
    mockedStreamSse.mockImplementation(
      scriptedStream([
        { event: "start", data: { threadId: "thread-1", userMessageId: "u1", assistantMessageId: "a1" } },
        { event: "chunk", data: { seq: 0, text: "Hi " } },
        { event: "chunk", data: { seq: 1, text: "there" } },
        { event: "chunk", data: { seq: 2, text: "." } },
        { event: "done", data: { assistantMessageId: "a1", status: "OK", quota: { used: 1, limit: 200, remaining: 199 } } },
      ]),
    );
    const { result } = await renderHook(() => useChatStream("pet1"));

    await act(async () => {
      result.current.send("hi");
    });
    await waitFor(() => expect(result.current.state).toBe("idle"));

    const assistant = result.current.messages.find((message) => message.role === "assistant");
    expect(assistant?.text).toBe("Hi there.");
  });

  it("a malformed known frame aborts immediately, before later frames are consumed", async () => {
    mockedPost.mockResolvedValue(THREAD);
    let framesAttempted = 0;
    mockedStreamSse.mockImplementation(async (_path: string, _body: unknown, options: OnFrameOptions) => {
      const frames: FrameSpec[] = [
        // `seq` must be an int -- this fails `chatChunkEventSchema`, so
        // `parseChatFrame` returns `{kind:"invalid"}` and the hook's
        // `onFrame` THROWS (fail upward, D4) -- exactly like the real
        // `streamSseRequest`, this stops the delivery loop immediately.
        { event: "chunk", data: { seq: "not-a-number", text: "first" } },
        { event: "chunk", data: { seq: 1, text: "afterwards" } },
      ];
      for (const spec of frames) {
        framesAttempted += 1;
        options.onFrame(toFrame(spec));
      }
    });
    const { result } = await renderHook(() => useChatStream("pet1"));

    await act(async () => {
      result.current.send("hi");
    });
    await waitFor(() => expect(result.current.state).toBe("dropped"));

    // The second (valid) frame was never even attempted -- the malformed
    // frame aborted consumption before it, not merely dropped its effect.
    expect(framesAttempted).toBe(1);
    expect(result.current.messages.some((message) => message.role === "assistant")).toBe(false);
  });

  describe("a transport error arriving AFTER a complete `done` frame is a no-op (BLOCKER-1/FINDING-2 regression)", () => {
    it("done(SAFE_FALLBACK) then a late transport error -- state stays safeFallback, message preserved, no retry", async () => {
      mockedPost.mockResolvedValue(THREAD);
      mockedStreamSse.mockImplementation(async (_path: string, _body: unknown, options: OnFrameOptions) => {
        options.onFrame(toFrame({ event: "start", data: { threadId: "thread-1", userMessageId: "u1", assistantMessageId: "a1" } }));
        options.onFrame(toFrame({ event: "chunk", data: { seq: 0, text: "General guidance." } }));
        options.onFrame(
          toFrame({
            event: "done",
            data: { assistantMessageId: "a1", status: "SAFE_FALLBACK", quota: { used: 1, limit: 200, remaining: 199 } },
          }),
        );
        // The `done` frame is already a complete, terminal outcome -- a
        // failure of the byte source AFTER it (readable-stream error before
        // EOF, or a `flush()`-phase throw) must NOT retroactively demote it.
        throw new Error("late transport error after done");
      });
      const { result } = await renderHook(() => useChatStream("pet1"));

      await act(async () => {
        result.current.send("hi");
      });
      await waitFor(() => expect(result.current.state).toBe("safeFallback"));

      const assistant = result.current.messages.find((message) => message.role === "assistant");
      expect(assistant?.status).toBe("safeFallback");
      expect(assistant?.text).toBe("General guidance.");

      // Never demoted to "dropped" and never removed.
      await act(async () => {
        result.current.retry();
      });
      expect(mockedStreamSse).toHaveBeenCalledTimes(1);
      expect(result.current.state).toBe("safeFallback");
    });

    it("done(OK) then a late transport error -- state stays idle, answer preserved, no retry, no duplicate send", async () => {
      mockedPost.mockResolvedValue(THREAD);
      mockedStreamSse.mockImplementation(async (_path: string, _body: unknown, options: OnFrameOptions) => {
        options.onFrame(toFrame({ event: "start", data: { threadId: "thread-1", userMessageId: "u1", assistantMessageId: "a1" } }));
        options.onFrame(toFrame({ event: "chunk", data: { seq: 0, text: "Full answer." } }));
        options.onFrame(
          toFrame({ event: "done", data: { assistantMessageId: "a1", status: "OK", quota: { used: 1, limit: 200, remaining: 199 } } }),
        );
        throw new Error("late transport error after done");
      });
      const { result } = await renderHook(() => useChatStream("pet1"));

      await act(async () => {
        result.current.send("hi");
      });
      await waitFor(() => expect(result.current.state).toBe("idle"));

      const assistant = result.current.messages.find((message) => message.role === "assistant");
      expect(assistant?.status).toBe("ok");
      expect(assistant?.text).toBe("Full answer.");

      // "idle" is not "dropped"/"error" -- retry() is a no-op, so the
      // already-persisted, already-quota-charged message is never re-sent.
      await act(async () => {
        result.current.retry();
      });
      expect(mockedStreamSse).toHaveBeenCalledTimes(1);
      expect(mockedPost).toHaveBeenCalledTimes(1);
    });
  });

  describe("retry() is a no-op outside `dropped`/`error`", () => {
    it("safeFallback: retry() issues zero additional streamSse calls", async () => {
      mockedPost.mockResolvedValue(THREAD);
      mockedStreamSse.mockImplementation(
        scriptedStream([
          {
            event: "done",
            data: { assistantMessageId: "a1", status: "SAFE_FALLBACK", quota: { used: 1, limit: 200, remaining: 199 } },
          },
        ]),
      );
      const { result } = await renderHook(() => useChatStream("pet1"));

      await act(async () => {
        result.current.send("hi");
      });
      await waitFor(() => expect(result.current.state).toBe("safeFallback"));

      await act(async () => {
        result.current.retry();
      });
      expect(mockedStreamSse).toHaveBeenCalledTimes(1);
    });

    it("blocked402: retry() issues zero additional streamSse calls", async () => {
      mockedPost.mockResolvedValue(THREAD);
      mockedStreamSse.mockImplementation(async () => {
        throw new ApiError({ code: "PAYMENT_REQUIRED", message: "premium only", httpStatus: 402, requestId: null });
      });
      const { result } = await renderHook(() => useChatStream("pet1"));

      await act(async () => {
        result.current.send("hi");
      });
      await waitFor(() => expect(result.current.state).toBe("blocked402"));

      await act(async () => {
        result.current.retry();
      });
      expect(mockedStreamSse).toHaveBeenCalledTimes(1);
    });

    it("offline: retry() issues zero streamSse calls (none were ever made)", async () => {
      await act(async () => {
        setOnline(false);
      });
      const { result } = await renderHook(() => useChatStream("pet1"));

      await act(async () => {
        result.current.send("hi");
      });
      expect(result.current.state).toBe("offline");

      await act(async () => {
        result.current.retry();
      });
      expect(mockedStreamSse).not.toHaveBeenCalled();
    });

    it("streaming: retry() issues zero additional streamSse calls", async () => {
      mockedPost.mockResolvedValue(THREAD);
      mockedStreamSse.mockImplementation(
        (_path: string, _body: unknown, options: OnFrameOptions) =>
          new Promise<void>(() => {
            // Never resolves within this test -- keeps the hook in "streaming".
            options.onFrame(toFrame({ event: "start", data: { threadId: "thread-1", userMessageId: "u1", assistantMessageId: "a1" } }));
          }),
      );
      const { result } = await renderHook(() => useChatStream("pet1"));

      await act(async () => {
        result.current.send("hi");
      });
      await waitFor(() => expect(result.current.state).toBe("streaming"));

      await act(async () => {
        result.current.retry();
      });
      expect(mockedStreamSse).toHaveBeenCalledTimes(1);
    });
  });

  describe("reset() (FINDING-3: clears a terminal blocked402 lock)", () => {
    it("clears blocked402 -> idle", async () => {
      mockedPost.mockResolvedValue(THREAD);
      mockedStreamSse.mockImplementation(async () => {
        throw new ApiError({ code: "PAYMENT_REQUIRED", message: "premium only", httpStatus: 402, requestId: null });
      });
      const { result } = await renderHook(() => useChatStream("pet1"));

      await act(async () => {
        result.current.send("hi");
      });
      await waitFor(() => expect(result.current.state).toBe("blocked402"));

      await act(async () => {
        result.current.reset();
      });
      expect(result.current.state).toBe("idle");
    });

    it("is a no-op in every other state", async () => {
      mockedPost.mockResolvedValue(THREAD);
      mockedStreamSse.mockImplementation(
        scriptedStream([
          { event: "done", data: { assistantMessageId: "a1", status: "SAFE_FALLBACK", quota: { used: 1, limit: 200, remaining: 199 } } },
        ]),
      );
      const { result } = await renderHook(() => useChatStream("pet1"));

      await act(async () => {
        result.current.send("hi");
      });
      await waitFor(() => expect(result.current.state).toBe("safeFallback"));

      await act(async () => {
        result.current.reset();
      });
      expect(result.current.state).toBe("safeFallback");
    });
  });
});

describe("isNearBottom (pure helper, T083 plan D11)", () => {
  it("true when the scroll offset is within the threshold of the bottom", () => {
    expect(isNearBottom({ contentHeight: 1000, layoutHeight: 600, offsetY: 400 })).toBe(true);
  });

  it("true exactly AT the threshold (<=, not <)", () => {
    expect(
      isNearBottom({ contentHeight: 1000, layoutHeight: 600, offsetY: 400 - NEAR_BOTTOM_THRESHOLD_PX }),
    ).toBe(true);
  });

  it("false when scrolled well away from the bottom", () => {
    expect(isNearBottom({ contentHeight: 1000, layoutHeight: 600, offsetY: 0 })).toBe(false);
  });

  it("true when content is shorter than the viewport (nothing to scroll)", () => {
    expect(isNearBottom({ contentHeight: 200, layoutHeight: 600, offsetY: 0 })).toBe(true);
  });
});
