// T110 AC1: the pseudo-locale leak test (mobile, rendered -- the strong
// proof). Renders the 3 core screens (Home, Check Result, Chat) with the
// shared `strings` module replaced by its own pseudo-transformed tree (the
// exact mechanism `resolveActiveStrings` uses for the real `en-XA` locale --
// see `src/i18n/runtime.ts`) and asserts every rendered text node is either
// pseudo-marked, an explicitly test-supplied dynamic fixture value, or
// letter-free. Anything else is a hardcoded literal that never flowed
// through the strings tree.
//
// This mocks the ONE module (`../src/strings`) every screen imports rather
// than resetting the whole module registry + env var (that idiom is proven
// safe for PURE modules in `eas-config.test.ts`/`startup-guard.test.ts`, but
// is unsafe here: re-requiring React/`@testing-library/react-native` after
// `jest.resetModules()` produces a second, incompatible React instance that
// breaks hooks and jest-circus's own lifecycle-hook registration -- see
// `breed-guide-explore.test.tsx`'s header comment on this exact hazard).
import { createQueryClient } from "@bombaypetcompany/api-client";
import {
  APP_DISPLAY_NAME,
  collectLeafPaths,
  isPseudoTransformed,
  pseudoString,
  pseudoTree,
} from "@bombaypetcompany/config";
import { HOME_CARE_ALLOWED_TIERS, petIdSchema, type AgendaResponse, type Pet, type TriageResult } from "@bombaypetcompany/types";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import React from "react";

import HomeScreen from "../app/(tabs)/index";
import CheckResultScreen from "../app/check/result/[checkId]";
import ChatScreen from "../app/chat/index";
import { useCheck } from "../src/api/checks-api";
import { apiClient } from "../src/api/client";
import { useChatStore } from "../src/chat/chat-store";
import { useActivePetStore } from "../src/pets/active-pet-store";
import { strings } from "../src/strings";

jest.mock("../src/strings", () => {
  const actual = jest.requireActual("../src/strings") as typeof import("../src/strings");
  const config = jest.requireActual("@bombaypetcompany/config") as typeof import("@bombaypetcompany/config");
  return { ...actual, strings: config.pseudoTree(actual.enStrings, config.pseudoString) };
});

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => ({ checkId: "c1" }),
}));

jest.mock("../src/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    streamSse: jest.fn(),
  },
}));

let mockUuidCounter = 0;
jest.mock("expo-crypto", () => ({ randomUUID: jest.fn(() => `uuid-${++mockUuidCounter}`) }));

jest.mock("../src/api/checks-api", () => ({ useCheck: jest.fn() }));

const mockedGet = apiClient.get as jest.Mock;
const mockedPost = apiClient.post as jest.Mock;
const mockedStreamSse = apiClient.streamSse as jest.Mock;
const mockedUseCheck = useCheck as jest.Mock;

type JsonNode = { props?: Record<string, unknown>; children?: unknown } | string;

/** Every string leaf actually rendered anywhere in a `toJSON()` tree. */
function collectRenderedText(node: unknown): string[] {
  if (node == null) return [];
  if (typeof node === "string") return [node];
  if (Array.isArray(node)) return node.flatMap(collectRenderedText);
  if (typeof node === "object") {
    return collectRenderedText((node as JsonNode as { children?: unknown }).children);
  }
  return [];
}

/** `/^\P{L}*$/u` — icon glyphs, separators, digits: no Unicode letter at all. */
function isLetterFree(text: string): boolean {
  return /^\P{L}*$/u.test(text);
}

/**
 * Asserts every rendered text node is pseudo-marked, an explicitly listed
 * dynamic fixture value, or letter-free. Fails with the offending text.
 */
function assertNoLeak(tree: unknown, dynamicFixtureValues: readonly string[]): void {
  const texts = collectRenderedText(tree);
  expect(texts.length).toBeGreaterThan(0);
  for (const text of texts) {
    const ok =
      isPseudoTransformed(text) || dynamicFixtureValues.includes(text) || isLetterFree(text);
    if (!ok) {
      throw new Error(`hardcoded literal leaked outside the strings tree: ${JSON.stringify(text)}`);
    }
  }
}

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

function buildAgenda(entries: AgendaResponse["entries"] = []): AgendaResponse {
  return { from: "2020-01-01T00:00:00.000Z", to: "2020-02-01T00:00:00.000Z", entries };
}

/** Mirrors `check-result-snapshot.test.tsx`'s fixture builder. */
function fixtureFor(tier: "REASSURE"): TriageResult {
  const allowsHomeCare = (HOME_CARE_ALLOWED_TIERS as readonly string[]).includes(tier);
  return {
    urgency: tier,
    confidence: "high",
    summary: "General guidance based on the information provided.",
    possibleCauses: [
      { name: "Mild upset stomach", whyItFits: "Reported symptoms are consistent with this." },
    ],
    redFlagsToWatch: ["Repeated vomiting", "Lethargy that worsens"],
    homeCare: allowsHomeCare ? ["Offer small amounts of water"] : [],
    doNot: ["Do not give human medications without veterinary guidance."],
    vetQuestions: ["How long have symptoms been present?"],
    followUpHours: 24,
  };
}

const CHECK_RESULT_FIXTURE_VALUES = [
  "General guidance based on the information provided.",
  "Mild upset stomach",
  "Reported symptoms are consistent with this.",
  "• Repeated vomiting",
  "• Lethargy that worsens",
  "• Offer small amounts of water",
  "• Do not give human medications without veterinary guidance.",
  "• How long have symptoms been present?",
];

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

describe("pseudo-locale leak (AC1.1-AC1.4)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useActivePetStore.getState().clear();
    useChatStore.setState({ threadIdByPetId: {}, messagesByPetId: {} });
  });

  it("the Home tab leaks no hardcoded copy under the en-XA pseudo-locale", async () => {
    mockedGet.mockImplementation((path: string) => {
      if (path.startsWith("/v1/pets")) return Promise.resolve([PET_A]);
      if (path.startsWith("/v1/agenda")) return Promise.resolve(buildAgenda([]));
      return Promise.reject(new Error(`unexpected GET ${path}`));
    });

    const client = createTestQueryClient();
    const { toJSON } = await render(<HomeScreen />, { wrapper: makeWrapper(client) });

    await waitFor(() => {
      expect(screen.getByTestId("home-open-active-pet")).toBeTruthy();
    });
    // Lets the Care Score card's own (agenda-derived) query settle before
    // asserting, so no state update lands outside `act(...)` after this
    // test's assertions run (mirrors `home-screen.test.tsx`'s two-step wait).
    await waitFor(() => {
      expect(screen.getByTestId("home-care-score-card")).toBeTruthy();
    });

    // `APP_DISPLAY_NAME` is a legitimate, non-strings-tree constant (CLAUDE
    // §1a): it is injected at render time from the shared config constant,
    // never hardcoded and never part of the strings tree, so it never flows
    // through `pseudoTree` -- exactly analogous to a test-supplied fixture
    // value like the pet name. `PET_A.name.charAt(0)` is the hero card's
    // photo-less avatar initial, also derived from fixture data.
    assertNoLeak(toJSON(), ["Rex", PET_A.name.charAt(0), APP_DISPLAY_NAME]);
  });

  it("the Check Result screen leaks no hardcoded copy under en-XA", async () => {
    mockedUseCheck.mockReturnValue({
      data: {
        id: "c1",
        status: "DONE",
        category: "vomiting",
        createdAt: "2024-01-01T00:00:00.000Z",
        result: fixtureFor("REASSURE"),
      },
      isError: false,
      refetch: jest.fn(),
    });

    const { toJSON } = await render(<CheckResultScreen />);

    expect(screen.getByTestId("vet-disclaimer")).toBeTruthy();
    assertNoLeak(toJSON(), CHECK_RESULT_FIXTURE_VALUES);
  });

  it("the Chat screen leaks no hardcoded copy under en-XA", async () => {
    mockedGet.mockImplementation((path: string) => {
      if (path.startsWith("/v1/pets")) return Promise.resolve([PET_A]);
      return Promise.reject(new Error(`unexpected GET ${path}`));
    });
    mockedPost.mockResolvedValue({ id: "thread-1", petId: PET_A.id, createdAt: "2024-01-01T00:00:00.000Z" });
    mockedStreamSse.mockImplementation(
      async (_path: string, _body: unknown, options: { onFrame: (frame: unknown) => void }) => {
        options.onFrame({
          event: "start",
          data: JSON.stringify({ threadId: "thread-1", userMessageId: "u1", assistantMessageId: "a1" }),
        });
        options.onFrame({ event: "chunk", data: JSON.stringify({ seq: 0, text: "Here is some general guidance." }) });
        options.onFrame({
          event: "done",
          data: JSON.stringify({ assistantMessageId: "a1", status: "OK", quota: { used: 1, limit: 200, remaining: 199 } }),
        });
      },
    );

    const client = createTestQueryClient();
    const { toJSON } = await render(<ChatScreen />, { wrapper: makeWrapper(client) });

    await waitFor(() => expect(screen.getByTestId("chat-active-pet-badge")).toBeTruthy());
    await fireEvent.changeText(screen.getByTestId("chat-composer-input"), "Is this normal?");
    await fireEvent.press(screen.getByTestId("chat-composer-send"));

    await waitFor(() => {
      expect(screen.getByText("Here is some general guidance.")).toBeTruthy();
    });

    assertNoLeak(toJSON(), [
      "Rex",
      APP_DISPLAY_NAME,
      "Is this normal?",
      "Here is some general guidance.",
    ]);
  });

  it("the pseudo-locale actually transformed the tree (non-vacuity)", () => {
    const paths = collectLeafPaths(strings);
    expect(paths.length).toBeGreaterThanOrEqual(600);

    function readPath(tree: unknown, path: string): unknown {
      const segments = path.replace(/\[(\d+)\]/g, ".$1").split(".");
      let node: unknown = tree;
      for (const segment of segments) {
        node = (node as Record<string, unknown>)[segment];
      }
      return node;
    }

    let stringLeafCount = 0;
    let transformedCount = 0;
    for (const path of paths) {
      const value = readPath(strings, path);
      if (typeof value === "function") continue; // covered by i18n-runtime.test.ts's arity test
      if (typeof value !== "string") continue;
      stringLeafCount += 1;
      if (isPseudoTransformed(value)) transformedCount += 1;
    }
    expect(stringLeafCount).toBeGreaterThan(0);
    expect(transformedCount).toBe(stringLeafCount);

    // a function leaf also flows through the transform, e.g. the disclaimer
    expect(isPseudoTransformed(strings.check.result.disclaimer(APP_DISPLAY_NAME))).toBe(true);

    // an untransformed control string fails the same predicate
    expect(isPseudoTransformed("an untransformed control string")).toBe(false);

    // pseudoTree itself is exercised directly too, for good measure
    const sanityTree = pseudoTree({ greet: "Hi" }, pseudoString);
    expect(isPseudoTransformed(sanityTree.greet)).toBe(true);
  });
});
