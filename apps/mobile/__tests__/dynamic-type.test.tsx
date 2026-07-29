import { createQueryClient } from "@bombaypetcompany/api-client";
import { petIdSchema, type Pet } from "@bombaypetcompany/types";
import { render, screen, type RenderResult } from "@testing-library/react-native";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import React from "react";
import * as ReactNative from "react-native";

import HomeScreen from "../app/(tabs)/index";
import CheckResultScreen from "../app/check/result/[checkId]";
import PaywallScreen from "../app/paywall";
import ChatScreen from "../app/chat/index";
import { apiClient } from "../src/api/client";
import { useOfferings, usePaywallConfig } from "../src/billing/paywall-queries";
import { useActivePetStore } from "../src/pets/active-pet-store";

/**
 * T093 plan D3 -- dynamic-type coverage for the 4 key screens (home, check
 * result, paywall, chat). This test proves exactly three things per screen
 * (D3's honest scope, NOT a layout test):
 *
 *   1. Chrome text carrying `maxFontSizeMultiplier` is present, and every
 *      value found is within [1.2, 1.5] (design-system §4.5).
 *   2. No node whose `className` sizes a fixed height (`h-[…]`/`h-<n>`) has
 *      a `Text` node anywhere in its subtree (§4.5 "no fixed heights on
 *      text containers").
 *   3. Each screen renders its key testIDs without throwing when
 *      `useWindowDimensions()` reports `fontScale: 3`. This proves only that
 *      no code path divides by / branches on `fontScale` and crashes -- it
 *      does NOT prove the layout survives visually at that scale (that is a
 *      `[DEVICE-ONLY]` row in `docs/qa/a11y-script.md`). Under this
 *      workspace's jest, `className` is an unresolved literal string (no
 *      layout engine runs), so a "nothing overflows visually" assertion is
 *      impossible here (design-system.md §7.9, `use-layout-bucket.ts`'s own
 *      header comment).
 *
 * `useWindowDimensions` is spied via the `import * as ReactNative`
 * namespace form (not a destructured import), per `use-layout-bucket.ts`'s
 * own documented empirical requirement -- width stays 750 (`regular`
 * bucket, `layout-bucket.test.tsx`'s pinned invariant) so this spy cannot
 * flip any responsive branch or churn a snapshot; only `fontScale` changes.
 */
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ checkId: "c1", source: "onboarding" }),
}));

const mockUseCheck = jest.fn();
jest.mock("../src/api/checks-api", () => ({
  useCheck: (checkId: string) => mockUseCheck(checkId),
}));

jest.mock("../src/billing/paywall-queries", () => ({
  usePaywallConfig: jest.fn(),
  useOfferings: jest.fn(),
}));
const mockedUsePaywallConfig = usePaywallConfig as unknown as jest.Mock;
const mockedUseOfferings = useOfferings as unknown as jest.Mock;

jest.mock("../src/api/client", () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), streamSse: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock("expo-crypto", () => ({ randomUUID: jest.fn(() => "uuid-1") }));

// `pets-api` is NOT mocked -- home AND chat both read the pet list through
// the REAL `usePets`/`useActivePet` hooks (chat/index.tsx's own `useActivePet`
// call), so both describes below drive that data by answering `/v1/pets`
// through the mocked `apiClient.get` under a real `QueryClientProvider`
// (mirrors `home-screen.test.tsx`/`chat-screen-snapshot.test.tsx`).
const mockedGet = apiClient.get as jest.Mock;

type JsonNode = ReturnType<RenderResult["toJSON"]>;
interface NodeLike {
  type?: unknown;
  props?: Record<string, unknown>;
  children?: unknown;
}

function flatten(node: JsonNode | JsonNode[] | string | null | undefined, acc: NodeLike[] = []): NodeLike[] {
  if (node == null || typeof node === "string") {
    return acc;
  }
  if (Array.isArray(node)) {
    node.forEach((child) => flatten(child, acc));
    return acc;
  }
  acc.push(node as NodeLike);
  flatten((node as NodeLike).children as JsonNode[] | null, acc);
  return acc;
}

/**
 * A `Text` node counts as "real" text for this rule only if it does NOT
 * carry `allowFontScaling={false}` -- `@expo/vector-icons`' `Ionicons`
 * renders its glyph as a `Text` node internally with exactly that prop (a
 * decorative icon font-ligature, never user-facing copy), so an icon-sized
 * `h-11 w-11` button would otherwise false-positive this rule. This does
 * NOT weaken rule 1 in `a11y-static-scan.test.ts` (which bans
 * `allowFontScaling={false}` in OUR source under `app/`/`src/` -- Ionicons'
 * own internals live in `node_modules` and are out of that scan's scope).
 */
function isRealText(node: NodeLike): boolean {
  return node.type === "Text" && node.props?.allowFontScaling !== false;
}

function containsText(node: NodeLike | undefined): boolean {
  if (node === undefined) {
    return false;
  }
  if (isRealText(node)) {
    return true;
  }
  return flatten(node.children as JsonNode[] | null).some((child) => isRealText(child));
}

const FIXED_HEIGHT_CLASS_PATTERN = /(^|\s)h-(\[|\d)/;

/** D3 item 2: no fixed-height class on a node whose subtree contains a Text. */
function fixedHeightTextContainers(root: JsonNode): NodeLike[] {
  return flatten(root).filter((node) => {
    const className = typeof node.props?.className === "string" ? (node.props.className as string) : "";
    return FIXED_HEIGHT_CLASS_PATTERN.test(className) && containsText(node);
  });
}

/** D3 item 1: every Text node carrying maxFontSizeMultiplier. */
function maxFontSizeNodes(root: JsonNode): NodeLike[] {
  return flatten(root).filter((node) => typeof node.props?.maxFontSizeMultiplier === "number");
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

function fixtureResult() {
  return {
    urgency: "MONITOR" as const,
    confidence: "high" as const,
    summary: "General guidance based on the information provided.",
    possibleCauses: [{ name: "Mild upset stomach", whyItFits: "Reported symptoms are consistent with this." }],
    redFlagsToWatch: ["Repeated vomiting"],
    homeCare: ["Offer small amounts of water"],
    doNot: ["Do not give human medications without veterinary guidance."],
    vetQuestions: ["How long have symptoms been present?"],
    followUpHours: 24,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  useActivePetStore.getState().clear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("dynamic-type: home screen", () => {
  beforeEach(() => {
    // T098 docket 2: mockImplementationOnce bodies queued by other describes
    // survive `jest.clearAllMocks()` (it clears calls, not implementations) --
    // `mockReset()` removes them so this describe's own implementation is the
    // only one in force.
    mockedGet.mockReset();
    mockedGet.mockImplementation((path: string) => {
      if (path.startsWith("/v1/pets")) {
        return Promise.resolve([PET_A]);
      }
      if (path.startsWith("/v1/agenda")) {
        return Promise.resolve({ from: "2020-01-01T00:00:00.000Z", to: "2020-02-01T00:00:00.000Z", entries: [] });
      }
      return Promise.reject(new Error(`unexpected GET ${path}`));
    });
  });

  it("chrome text caps font scaling within [1.2, 1.5]", async () => {
    const client = createTestQueryClient();
    const { toJSON } = await render(<HomeScreen />, { wrapper: makeWrapper(client) });
    // T098 docket 2: gate on the pets-query-dependent node, not "home-header"
    // (unconditional chrome, rendered before `useActivePet()` resolves --
    // waiting on it does not force the loading-vs-loaded race to settle;
    // see `loop/reviews`/journal for the reproduction).
    await screen.findByTestId("home-open-active-pet");

    const nodes = maxFontSizeNodes(toJSON());
    expect(nodes.length).toBeGreaterThan(0);
    for (const node of nodes) {
      const value = node.props?.maxFontSizeMultiplier as number;
      expect(value).toBeGreaterThanOrEqual(1.2);
      expect(value).toBeLessThanOrEqual(1.5);
    }
  });

  it("no fixed-height container wraps text", async () => {
    const client = createTestQueryClient();
    const { toJSON } = await render(<HomeScreen />, { wrapper: makeWrapper(client) });
    await screen.findByTestId("home-open-active-pet");

    const allNodes = flatten(toJSON());
    expect(allNodes.length).toBeGreaterThan(10);
    expect(fixedHeightTextContainers(toJSON())).toEqual([]);
  });

  it("renders at fontScale 3 without throwing", async () => {
    jest.spyOn(ReactNative, "useWindowDimensions").mockReturnValue({ width: 750, height: 1334, scale: 2, fontScale: 3 });

    const client = createTestQueryClient();
    await render(<HomeScreen />, { wrapper: makeWrapper(client) });

    expect(await screen.findByTestId("home-header")).toBeTruthy();
  });
});

describe("dynamic-type: check result screen", () => {
  beforeEach(() => {
    mockUseCheck.mockReturnValue({
      data: { id: "c1", status: "DONE", category: "vomiting", createdAt: "2024-01-01T00:00:00.000Z", result: fixtureResult() },
      isError: false,
      refetch: jest.fn(),
    });
  });

  it("chrome text caps font scaling within [1.2, 1.5]", async () => {
    const { toJSON } = await render(<CheckResultScreen />);
    await screen.findByTestId("check-result-screen");

    const nodes = maxFontSizeNodes(toJSON());
    expect(nodes.length).toBeGreaterThan(0);
    for (const node of nodes) {
      const value = node.props?.maxFontSizeMultiplier as number;
      expect(value).toBeGreaterThanOrEqual(1.2);
      expect(value).toBeLessThanOrEqual(1.5);
    }
  });

  it("no fixed-height container wraps text", async () => {
    const { toJSON } = await render(<CheckResultScreen />);
    await screen.findByTestId("check-result-screen");

    const allNodes = flatten(toJSON());
    expect(allNodes.length).toBeGreaterThan(10);
    expect(fixedHeightTextContainers(toJSON())).toEqual([]);
  });

  it("renders at fontScale 3 without throwing", async () => {
    jest.spyOn(ReactNative, "useWindowDimensions").mockReturnValue({ width: 750, height: 1334, scale: 2, fontScale: 3 });

    await render(<CheckResultScreen />);

    expect(await screen.findByTestId("check-result-screen")).toBeTruthy();
    expect(screen.getByTestId("vet-disclaimer")).toBeTruthy();
  });
});

describe("dynamic-type: paywall screen", () => {
  beforeEach(() => {
    mockedUsePaywallConfig.mockReturnValue({ data: { variant: "A" } });
    mockedUseOfferings.mockReturnValue({
      data: {
        packages: [
          { id: "monthly", priceString: "$4.99/mo", rcPackage: {} },
          { id: "annual", priceString: "$39.99/yr", rcPackage: {} },
          { id: "family", priceString: "$59.99/yr", rcPackage: {} },
        ],
      },
      isLoading: false,
    });
  });

  it("chrome text caps font scaling within [1.2, 1.5]", async () => {
    const { toJSON } = await render(<PaywallScreen />);
    await screen.findByTestId("paywall-screen");

    const nodes = maxFontSizeNodes(toJSON());
    expect(nodes.length).toBeGreaterThan(0);
    for (const node of nodes) {
      const value = node.props?.maxFontSizeMultiplier as number;
      expect(value).toBeGreaterThanOrEqual(1.2);
      expect(value).toBeLessThanOrEqual(1.5);
    }
  });

  it("no fixed-height container wraps text", async () => {
    const { toJSON } = await render(<PaywallScreen />);
    await screen.findByTestId("paywall-screen");

    const allNodes = flatten(toJSON());
    expect(allNodes.length).toBeGreaterThan(10);
    expect(fixedHeightTextContainers(toJSON())).toEqual([]);
  });

  it("renders at fontScale 3 without throwing", async () => {
    jest.spyOn(ReactNative, "useWindowDimensions").mockReturnValue({ width: 750, height: 1334, scale: 2, fontScale: 3 });

    await render(<PaywallScreen />);

    expect(await screen.findByTestId("paywall-screen")).toBeTruthy();
    expect(screen.getByTestId("paywall-headline")).toBeTruthy();
  });
});

describe("dynamic-type: chat screen", () => {
  beforeEach(() => {
    // T098 docket 2: same mockReset() rationale as the home describe above.
    mockedGet.mockReset();
    mockedGet.mockImplementation((path: string) => {
      if (path.startsWith("/v1/pets")) {
        return Promise.resolve([PET_A]);
      }
      return Promise.reject(new Error(`unexpected GET ${path}`));
    });
  });

  it("chrome text caps font scaling within [1.2, 1.5]", async () => {
    const client = createTestQueryClient();
    const { toJSON, findByTestId } = await render(<ChatScreen />, { wrapper: makeWrapper(client) });
    await findByTestId("chat-active-pet-badge");

    const nodes = maxFontSizeNodes(toJSON());
    expect(nodes.length).toBeGreaterThan(0);
    for (const node of nodes) {
      const value = node.props?.maxFontSizeMultiplier as number;
      expect(value).toBeGreaterThanOrEqual(1.2);
      expect(value).toBeLessThanOrEqual(1.5);
    }
  });

  it("no fixed-height container wraps text", async () => {
    const client = createTestQueryClient();
    const { toJSON, findByTestId } = await render(<ChatScreen />, { wrapper: makeWrapper(client) });
    await findByTestId("chat-active-pet-badge");

    const allNodes = flatten(toJSON());
    expect(allNodes.length).toBeGreaterThan(10);
    expect(fixedHeightTextContainers(toJSON())).toEqual([]);
  });

  it("renders at fontScale 3 without throwing", async () => {
    jest.spyOn(ReactNative, "useWindowDimensions").mockReturnValue({ width: 750, height: 1334, scale: 2, fontScale: 3 });

    const client = createTestQueryClient();
    const { findByTestId } = await render(<ChatScreen />, { wrapper: makeWrapper(client) });

    expect(await findByTestId("chat-screen")).toBeTruthy();
  });
});
