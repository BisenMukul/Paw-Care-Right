import { createQueryClient, setOnline, streamSseRequest, type SseTransport } from "@pawcareright/api-client";
import { petIdSchema, type Pet } from "@pawcareright/types";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import React from "react";

import ChatScreen from "../app/chat/index";
import { apiClient } from "../src/api/client";
import { usePremiumStore } from "../src/billing/premium-store";
import { useChatStore } from "../src/chat/chat-store";
import { useActivePetStore } from "../src/pets/active-pet-store";
import { strings } from "../src/strings";

/**
 * T083 plan AC1 (stream render) / AC2 (drop-retry) / AC3 (nudge routing) /
 * AC-S1 (safety surfaces), exercised through the REAL screen + REAL
 * `useChatStream` hook (mirrors `home-screen.test.tsx`'s approach: only
 * `apiClient` is mocked). `expo-router`/`expo-crypto` are mocked; offline is
 * driven via the REAL shared `setOnline` store.
 */
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("../src/api/client", () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), streamSse: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

let mockUuidCounter = 0;
jest.mock("expo-crypto", () => ({
  randomUUID: jest.fn(() => `uuid-${++mockUuidCounter}`),
}));

const mockedGet = apiClient.get as jest.Mock;
const mockedPost = apiClient.post as jest.Mock;
const mockedStreamSse = apiClient.streamSse as jest.Mock;

const PET_A: Pet = {
  id: petIdSchema.parse("11111111-1111-4111-8111-111111111111"),
  householdId: "household-1",
  species: "DOG",
  sex: "MALE",
  name: "Rex",
  neutered: true,
  breedSlug: "labrador-retriever",
  birthDate: null,
  ageEstimateMonths: null,
  weightGrams: null,
  photoKey: null,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

const THREAD = { id: "thread-1", petId: PET_A.id, createdAt: "2024-01-01T00:00:00.000Z" };

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

async function renderScreen() {
  const client = createTestQueryClient();
  return render(<ChatScreen />, { wrapper: makeWrapper(client) });
}

async function renderWithPetLoaded() {
  await renderScreen();
  await waitFor(() => expect(screen.getByTestId("chat-active-pet-badge")).toBeTruthy());
}

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

/** Dispatches the given frames then resolves normally (a `done` frame, if present, makes the hook settle to idle/safeFallback). */
function scriptedStream(frames: FrameSpec[]) {
  return jest.fn(async (_path: string, _body: unknown, options: OnFrameOptions) => {
    for (const spec of frames) {
      options.onFrame(toFrame(spec));
    }
  });
}

/** Dispatches the given frames then NEVER resolves (keeps the hook in "streaming"). */
function hangingStream(frames: FrameSpec[]) {
  return jest.fn(
    (_path: string, _body: unknown, options: OnFrameOptions) =>
      new Promise<void>(() => {
        for (const spec of frames) {
          options.onFrame(toFrame(spec));
        }
      }),
  );
}

async function sendMessage(text: string) {
  await fireEvent.changeText(screen.getByTestId("chat-composer-input"), text);
  await fireEvent.press(screen.getByTestId("chat-composer-send"));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUuidCounter = 0;
  useActivePetStore.getState().clear();
  usePremiumStore.setState({ status: "unknown" });
  useChatStore.setState({ threadIdByPetId: {}, messagesByPetId: {} });
  mockedGet.mockImplementation((path: string) => {
    if (path.startsWith("/v1/pets")) {
      return Promise.resolve([PET_A]);
    }
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
  mockedPost.mockResolvedValue(THREAD);
});

afterEach(async () => {
  await act(async () => {
    setOnline(true);
  });
});

describe("chat screen -- AC1 stream render", () => {
  it("renders the user bubble immediately, then grows the assistant bubble as chunks arrive", async () => {
    let deliver: ((spec: FrameSpec) => void) | undefined;
    mockedStreamSse.mockImplementation(
      (_path: string, _body: unknown, options: OnFrameOptions) =>
        new Promise<void>((resolve) => {
          deliver = (spec) => {
            options.onFrame(toFrame(spec));
            if (spec.event === "done") {
              resolve();
            }
          };
        }),
    );

    await renderWithPetLoaded();
    await sendMessage("Hello");

    await waitFor(() => expect(screen.getByText("Hello")).toBeTruthy());
    await waitFor(() => expect(screen.getByTestId("chat-typing-indicator")).toBeTruthy());

    await act(async () => {
      deliver?.({ event: "start", data: { threadId: "thread-1", userMessageId: "u1", assistantMessageId: "a1" } });
    });
    await act(async () => {
      deliver?.({ event: "chunk", data: { seq: 0, text: "Hi " } });
    });
    await waitFor(() => expect(screen.getByText("Hi ")).toBeTruthy());
    expect(screen.queryByTestId("chat-typing-indicator")).toBeNull();

    await act(async () => {
      deliver?.({ event: "chunk", data: { seq: 1, text: "there." } });
    });
    await waitFor(() => expect(screen.getByText("Hi there.")).toBeTruthy());

    await act(async () => {
      deliver?.({
        event: "done",
        data: { assistantMessageId: "a1", status: "OK", quota: { used: 1, limit: 200, remaining: 199 } },
      });
    });
  });

  it("a frame split across transport chunks renders exactly once (no duplication, no truncation)", async () => {
    mockedStreamSse.mockImplementation((path: string, body: unknown, options: OnFrameOptions) => {
      const fakeTransport: SseTransport = async () => ({
        status: 200,
        getHeader: () => null,
        chunks: (async function* chunks() {
          yield 'event: start\ndata: {"threadId":"thread-1","userMessageId":"u1","assistantMessageId":"a1"}\n\n';
          yield 'event: chunk\ndata: {"se';
          yield 'q":0,"text":"Hello"}\n\n';
          yield 'event: done\ndata: {"assistantMessageId":"a1","status":"OK","quota":{"used":1,"limit":200,"remaining":199}}\n\n';
        })(),
      });
      return streamSseRequest(fakeTransport, { url: path, method: "POST", headers: {}, body: JSON.stringify(body) }, options);
    });

    await renderWithPetLoaded();
    await sendMessage("hi");

    await waitFor(() => expect(screen.getByText("Hello")).toBeTruthy());
    expect(screen.queryAllByText("Hello")).toHaveLength(1);
  });
});

describe("chat screen -- AC2 drop-retry", () => {
  it("a stream that ends without a `done` frame shows the retry affordance", async () => {
    mockedStreamSse.mockImplementation(
      scriptedStream([{ event: "start", data: { threadId: "thread-1", userMessageId: "u1", assistantMessageId: "a1" } }]),
    );

    await renderWithPetLoaded();
    await sendMessage("hi");

    await waitFor(() => expect(screen.getByTestId("chat-stream-dropped")).toBeTruthy());
    expect(screen.getByTestId("chat-retry")).toBeTruthy();
  });

  it("retry re-sends the last message on the SAME thread and does not duplicate the user bubble", async () => {
    let attempt = 0;
    mockedStreamSse.mockImplementation(async (path: string, _body: unknown, options: OnFrameOptions) => {
      attempt += 1;
      if (attempt === 1) {
        options.onFrame(toFrame({ event: "start", data: { threadId: "thread-1", userMessageId: "u1", assistantMessageId: "a1" } }));
        return; // ends without `done` -> dropped
      }
      expect(path).toBe("/v1/chat/threads/thread-1/messages");
      options.onFrame(toFrame({ event: "chunk", data: { seq: 0, text: "Full answer" } }));
      options.onFrame(
        toFrame({ event: "done", data: { assistantMessageId: "a1", status: "OK", quota: { used: 1, limit: 200, remaining: 199 } } }),
      );
    });

    await renderWithPetLoaded();
    await sendMessage("hi");
    await waitFor(() => expect(screen.getByTestId("chat-retry")).toBeTruthy());

    await fireEvent.press(screen.getByTestId("chat-retry"));

    await waitFor(() => expect(screen.getByText("Full answer")).toBeTruthy());
    expect(mockedPost).toHaveBeenCalledTimes(1);
    expect(mockedStreamSse).toHaveBeenCalledTimes(2);
    expect(screen.queryAllByText("hi")).toHaveLength(1);
  });

  it("a transport throw mid-body is a drop, not an error", async () => {
    mockedStreamSse.mockImplementation(async (_path: string, _body: unknown, options: OnFrameOptions) => {
      options.onFrame(toFrame({ event: "start", data: { threadId: "thread-1", userMessageId: "u1", assistantMessageId: "a1" } }));
      options.onFrame(toFrame({ event: "chunk", data: { seq: 0, text: "partial" } }));
      throw new Error("socket reset");
    });

    await renderWithPetLoaded();
    await sendMessage("hi");

    await waitFor(() => expect(screen.getByTestId("chat-stream-dropped")).toBeTruthy());
    expect(screen.getByTestId("chat-retry")).toBeTruthy();
    // The partial assistant bubble is removed (not a truthful record of a completed answer).
    expect(screen.queryByText("partial")).toBeNull();
  });

  it("offline blocks the send entirely", async () => {
    await renderWithPetLoaded();
    await act(async () => {
      setOnline(false);
    });

    await waitFor(() => expect(screen.getByTestId("chat-offline-banner")).toBeTruthy());
    expect(screen.getByTestId("chat-composer-send").props.accessibilityState).toEqual({ disabled: true });

    await sendMessage("hi");

    expect(mockedStreamSse).not.toHaveBeenCalled();
    expect(mockedPost).not.toHaveBeenCalled();
  });
});

describe("chat screen -- AC3 nudge block", () => {
  it("a `nudge` frame renders a tappable check card", async () => {
    mockedStreamSse.mockImplementation(
      scriptedStream([
        { event: "start", data: { threadId: "thread-1", userMessageId: "u1", assistantMessageId: "a1" } },
        { event: "nudge", data: { category: "vomiting" } },
        { event: "done", data: { assistantMessageId: "a1", status: "OK", quota: { used: 1, limit: 200, remaining: 199 } } },
      ]),
    );

    await renderWithPetLoaded();
    await sendMessage("my dog is vomiting");

    await waitFor(() => expect(screen.getByTestId("chat-nudge-card")).toBeTruthy());
    const card = screen.getByTestId("chat-nudge-card");
    expect(card.props.accessibilityRole).toBe("button");
    expect(screen.getByText(strings.chat.nudge.title)).toBeTruthy();
    expect(screen.getByText(strings.chat.nudge.cta)).toBeTruthy();
  });

  it("pressing the nudge card routes into the check intake with the category and the active pet", async () => {
    mockedStreamSse.mockImplementation(
      scriptedStream([
        { event: "nudge", data: { category: "vomiting" } },
        { event: "done", data: { assistantMessageId: "a1", status: "OK", quota: { used: 1, limit: 200, remaining: 199 } } },
      ]),
    );

    await renderWithPetLoaded();
    await sendMessage("my dog is vomiting");

    await waitFor(() => expect(screen.getByTestId("chat-nudge-card")).toBeTruthy());
    await fireEvent.press(screen.getByTestId("chat-nudge-card"));

    expect(mockPush).toHaveBeenCalledWith({ pathname: "/check/[category]", params: { category: "vomiting", petId: PET_A.id } });
  });

  it("the nudge card renders before the assistant bubble", async () => {
    mockedStreamSse.mockImplementation(
      scriptedStream([
        { event: "nudge", data: { category: "vomiting" } },
        { event: "chunk", data: { seq: 0, text: "Here is some guidance." } },
        { event: "done", data: { assistantMessageId: "a1", status: "OK", quota: { used: 1, limit: 200, remaining: 199 } } },
      ]),
    );

    await renderWithPetLoaded();
    await sendMessage("my dog is vomiting");

    await waitFor(() => expect(screen.getByText("Here is some guidance.")).toBeTruthy());

    const serialized = JSON.stringify(screen.toJSON());
    const nudgeIndex = serialized.indexOf(strings.chat.nudge.title);
    const bubbleIndex = serialized.indexOf("Here is some guidance.");
    expect(nudgeIndex).toBeGreaterThan(-1);
    expect(bubbleIndex).toBeGreaterThan(-1);
    expect(nudgeIndex).toBeLessThan(bubbleIndex);
  });
});

describe("chat screen -- AC-S1 safety surfaces", () => {
  it.each([
    ["loading", async () => {
      mockedGet.mockImplementation(() => new Promise(() => {}));
      await renderScreen();
      await waitFor(() => expect(screen.getByTestId("chat-loading")).toBeTruthy());
    }],
    ["empty", async () => {
      await renderWithPetLoaded();
      await waitFor(() => expect(screen.getByTestId("chat-empty")).toBeTruthy());
    }],
    ["offline", async () => {
      await renderWithPetLoaded();
      await act(async () => {
        setOnline(false);
      });
      await waitFor(() => expect(screen.getByTestId("chat-offline-banner")).toBeTruthy());
    }],
    ["error", async () => {
      mockedGet.mockImplementation(() => Promise.reject(new Error("boom")));
      await renderScreen();
      await waitFor(() => expect(screen.getByTestId("chat-error")).toBeTruthy());
    }],
    ["blocked402", async () => {
      mockedStreamSse.mockImplementation(async () => {
        const { ApiError } = jest.requireActual("@pawcareright/api-client") as typeof import("@pawcareright/api-client");
        throw new ApiError({ code: "PAYMENT_REQUIRED", message: "premium only", httpStatus: 402, requestId: null });
      });
      await renderWithPetLoaded();
      await sendMessage("hi");
      await waitFor(() => expect(screen.getByTestId("chat-blocked-upgrade")).toBeTruthy());
    }],
    ["streaming", async () => {
      mockedStreamSse.mockImplementation(
        hangingStream([{ event: "start", data: { threadId: "thread-1", userMessageId: "u1", assistantMessageId: "a1" } }]),
      );
      await renderWithPetLoaded();
      await sendMessage("hi");
      await waitFor(() => expect(screen.getByText("hi")).toBeTruthy());
    }],
  ] as const)("the vet disclaimer renders in the %s state", async (_name, setup) => {
    await setup();
    expect(screen.getByTestId("vet-disclaimer")).toBeTruthy();
  });

  it("the disclaimer has no dismiss affordance", async () => {
    await renderWithPetLoaded();

    const disclaimer = screen.getByTestId("vet-disclaimer");
    const serialized = JSON.stringify(disclaimer);
    expect(serialized).not.toMatch(/"accessibilityRole":"button"/);
    expect(serialized).not.toMatch(/"onPress":/);
  });

  it("a SAFE_FALLBACK answer offers NO retry", async () => {
    mockedStreamSse.mockImplementation(
      scriptedStream([
        { event: "start", data: { threadId: "thread-1", userMessageId: "u1", assistantMessageId: "a1" } },
        { event: "done", data: { assistantMessageId: "a1", status: "SAFE_FALLBACK", quota: { used: 1, limit: 200, remaining: 199 } } },
      ]),
    );

    await renderWithPetLoaded();
    await sendMessage("hi");

    await waitFor(() => expect(screen.getByTestId("chat-safe-fallback")).toBeTruthy());
    expect(screen.getByText(strings.chat.safeFallback)).toBeTruthy();
    expect(screen.queryByTestId("chat-retry")).toBeNull();

    const serialized = JSON.stringify(screen.toJSON());
    expect(/retry|try again|regenerate/i.test(serialized)).toBe(false);
  });

  it("drop and safe-fallback are different states", async () => {
    mockedStreamSse.mockImplementation(
      scriptedStream([{ event: "start", data: { threadId: "thread-1", userMessageId: "u1", assistantMessageId: "a1" } }]),
    );
    await renderWithPetLoaded();
    await sendMessage("hi");
    await waitFor(() => expect(screen.getByTestId("chat-retry")).toBeTruthy());
    expect(screen.queryByTestId("chat-safe-fallback")).toBeNull();
  });

  it("offline blocks the send entirely (composer disabled, banner renders)", async () => {
    await renderWithPetLoaded();
    await act(async () => {
      setOnline(false);
    });

    await sendMessage("hi");

    expect(mockedStreamSse).not.toHaveBeenCalled();
    expect(mockedPost).not.toHaveBeenCalled();
    expect(screen.getByTestId("chat-offline-banner")).toBeTruthy();
  });

  it("402 while unentitled routes to the paywall", async () => {
    mockedStreamSse.mockImplementation(async () => {
      const { ApiError } = jest.requireActual("@pawcareright/api-client") as typeof import("@pawcareright/api-client");
      throw new ApiError({ code: "PAYMENT_REQUIRED", message: "premium only", httpStatus: 402, requestId: null });
    });
    await renderWithPetLoaded();
    await sendMessage("hi");

    await waitFor(() => expect(screen.getByTestId("chat-402-upgrade")).toBeTruthy());
    await fireEvent.press(screen.getByTestId("chat-402-upgrade"));

    expect(mockPush).toHaveBeenCalledWith({ pathname: "/paywall", params: { source: "chat" } });
  });

  it("402 while entitled shows the fair-use copy with no upgrade CTA", async () => {
    usePremiumStore.setState({ status: "entitled" });
    mockedStreamSse.mockImplementation(async () => {
      const { ApiError } = jest.requireActual("@pawcareright/api-client") as typeof import("@pawcareright/api-client");
      throw new ApiError({ code: "PAYMENT_REQUIRED", message: "quota exhausted", httpStatus: 402, requestId: null });
    });
    await renderWithPetLoaded();
    await sendMessage("hi");

    await waitFor(() => expect(screen.getByTestId("chat-blocked-quota")).toBeTruthy());
    expect(screen.queryByTestId("chat-402-upgrade")).toBeNull();
    expect(mockPush).not.toHaveBeenCalledWith(expect.objectContaining({ pathname: expect.stringContaining("/check") }));
  });
});

describe("chat screen -- quick prompts (D10)", () => {
  it("a quick prompt prefills the composer without sending", async () => {
    await renderWithPetLoaded();

    await fireEvent.press(screen.getByTestId("chat-quick-prompt-food"));

    expect(screen.getByTestId("chat-composer-input").props.value).toBe(strings.chat.quickPrompts.food);
    expect(mockedStreamSse).not.toHaveBeenCalled();
    expect(mockedPost).not.toHaveBeenCalled();
  });
});

describe("chat screen -- FINDING-3 blocked402 is not a permanent dead-end", () => {
  it("blocked402 (feature-lock) clears when premiumStatus transitions to entitled (post-purchase) -- composer re-enabled", async () => {
    mockedStreamSse.mockImplementation(async () => {
      const { ApiError } = jest.requireActual("@pawcareright/api-client") as typeof import("@pawcareright/api-client");
      throw new ApiError({ code: "PAYMENT_REQUIRED", message: "premium only", httpStatus: 402, requestId: null });
    });

    await renderWithPetLoaded();
    await sendMessage("hi");

    await waitFor(() => expect(screen.getByTestId("chat-blocked-upgrade")).toBeTruthy());
    expect(screen.getByTestId("chat-composer-send").props.accessibilityState).toEqual({ disabled: true });

    // Simulate a successful purchase completing on the (still-mounted,
    // pushed-underneath) paywall screen: the shared store flips.
    await act(async () => {
      usePremiumStore.setState({ status: "entitled" });
    });

    await waitFor(() => expect(screen.queryByTestId("chat-blocked-upgrade")).toBeNull());
    expect(screen.queryByTestId("chat-blocked-quota")).toBeNull();
    // Composer is enabled again (still gated on non-empty/within-limit text,
    // but no longer force-disabled by a stuck blocked402).
    await fireEvent.changeText(screen.getByTestId("chat-composer-input"), "hi again");
    expect(screen.getByTestId("chat-composer-send").props.accessibilityState).toEqual({ disabled: false });
  });

  it("blocked402 (fair-use quota, entitled throughout) is NOT cleared by a no-op premiumStatus write -- stays blocked", async () => {
    usePremiumStore.setState({ status: "entitled" });
    mockedStreamSse.mockImplementation(async () => {
      const { ApiError } = jest.requireActual("@pawcareright/api-client") as typeof import("@pawcareright/api-client");
      throw new ApiError({ code: "PAYMENT_REQUIRED", message: "quota exhausted", httpStatus: 402, requestId: null });
    });

    await renderWithPetLoaded();
    await sendMessage("hi");

    await waitFor(() => expect(screen.getByTestId("chat-blocked-quota")).toBeTruthy());

    // The user was ALREADY entitled the whole time -- re-asserting the same
    // status is not a non-entitled -> entitled TRANSITION, so the quota
    // lock legitimately persists (this is not a purchase event).
    await act(async () => {
      usePremiumStore.setState({ status: "entitled" });
    });

    expect(screen.getByTestId("chat-blocked-quota")).toBeTruthy();
    expect(screen.getByTestId("chat-composer-send").props.accessibilityState).toEqual({ disabled: true });
  });
});

describe("chat screen -- FINDING-4 distinct copy for a non-transport error state", () => {
  it("a non-402 ApiError renders chat-stream-error with the neutral errorNotice copy (not the dropped 'lost connection' copy), and retry is still offered", async () => {
    mockedStreamSse.mockImplementation(async () => {
      const { ApiError } = jest.requireActual("@pawcareright/api-client") as typeof import("@pawcareright/api-client");
      throw new ApiError({ code: "INTERNAL", message: "server exploded", httpStatus: 500, requestId: null });
    });

    await renderWithPetLoaded();
    await sendMessage("hi");

    await waitFor(() => expect(screen.getByTestId("chat-stream-error")).toBeTruthy());
    expect(screen.getByText(strings.chat.errorNotice)).toBeTruthy();
    expect(screen.queryByTestId("chat-stream-dropped")).toBeNull();
    expect(screen.queryByText(strings.chat.dropped.title)).toBeNull();
    expect(screen.getByTestId("chat-retry")).toBeTruthy();
  });
});
