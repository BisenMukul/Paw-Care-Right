// T110 AC2: RTL smoke. Renders the same 3 core screens under the `ar-XB`
// RTL pseudolocale and snapshots them into a brand-new file (the ONLY new
// snapshot this task writes -- the 19 pre-existing snapshots are untouched,
// see `i18n-runtime.test.ts`/Stage B's "changed nothing" proof).
//
// Honest limitation (plan §2.7): jest renders no native layout, so these
// snapshots prove copy resolution + crash-free render under an RTL-tagged
// locale, not visual mirroring. This task deliberately does NOT call
// `I18nManager.forceRTL` (it requires an app reload and would change layout
// for real users of a locale we do not serve -- `ar` ships `reviewed:
// false` and no dictionary). Physical-direction NativeWind classes
// (`ml-*`, `pl-*`, `text-left`, `flex-row`) are inventoried in
// `docs/I18N.md` as the follow-up required before `ar` can ever be served.
import { createQueryClient } from "@bombaypetcompany/api-client";
import { APP_DISPLAY_NAME, collectLeafPaths, getTextDirection } from "@bombaypetcompany/config";
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
import { enStrings } from "../src/strings";

jest.mock("../src/strings", () => {
  const actual = jest.requireActual("../src/strings") as typeof import("../src/strings");
  const config = jest.requireActual("@bombaypetcompany/config") as typeof import("@bombaypetcompany/config");
  return { ...actual, strings: config.pseudoTree(actual.enStrings, config.rtlPseudoString) };
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

type JsonNode = { props?: Record<string, unknown>; children?: unknown } | string;

function collectRenderedText(node: unknown): string[] {
  if (node == null) return [];
  if (typeof node === "string") return [node];
  if (Array.isArray(node)) return node.flatMap(collectRenderedText);
  if (typeof node === "object") {
    return collectRenderedText((node as JsonNode as { children?: unknown }).children);
  }
  return [];
}

/** Every English string leaf value in the real (untransformed) strings tree. */
function englishLeafValues(): Set<string> {
  const values = new Set<string>();
  for (const path of collectLeafPaths(enStrings)) {
    const segments = path.replace(/\[(\d+)\]/g, ".$1").split(".");
    let node: unknown = enStrings;
    for (const segment of segments) {
      node = (node as Record<string, unknown>)[segment];
    }
    if (typeof node === "string") values.add(node);
  }
  return values;
}

describe("RTL smoke (AC2)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useActivePetStore.getState().clear();
    useChatStore.setState({ threadIdByPetId: {}, messagesByPetId: {} });
  });

  it("Home tab renders under the ar-XB RTL pseudo-locale", async () => {
    // Freezes the greeting's time-of-day (mirrors `home-screen.test.tsx`'s
    // `freezeHour` pattern) so this snapshot is deterministic regardless of
    // the real wall-clock time the suite happens to run at.
    jest.useFakeTimers({ now: new Date(2024, 0, 1, 8, 0, 0).getTime() });

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
    await waitFor(() => {
      expect(screen.getByTestId("home-care-score-card")).toBeTruthy();
    });

    expect(toJSON()).toMatchSnapshot();

    jest.useRealTimers();
  });

  it("Check Result renders under the ar-XB RTL pseudo-locale", async () => {
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
    expect(toJSON()).toMatchSnapshot();
  });

  it("Chat renders under the ar-XB RTL pseudo-locale", async () => {
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

    expect(toJSON()).toMatchSnapshot();
  });

  it("ar and ar-XB resolve right-to-left; en/es/pt-BR/hi resolve left-to-right", () => {
    expect(getTextDirection("ar")).toBe("rtl");
    expect(getTextDirection("ar-XB")).toBe("rtl");
    expect(getTextDirection("en")).toBe("ltr");
    expect(getTextDirection("es")).toBe("ltr");
    expect(getTextDirection("pt-BR")).toBe("ltr");
    expect(getTextDirection("hi")).toBe("ltr");
  });

  it("no English strings leaf survives untranslated in the RTL render", async () => {
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
    await waitFor(() => {
      expect(screen.getByTestId("home-care-score-card")).toBeTruthy();
    });

    const english = englishLeafValues();
    // Dynamic, non-strings-tree values are legitimately excluded (fixture
    // pet name/initial and the shared `APP_DISPLAY_NAME` constant -- see
    // `pseudo-locale-leak.test.tsx`'s identical exclusions).
    const dynamicFixtureValues = new Set(["Rex", PET_A.name.charAt(0), APP_DISPLAY_NAME]);
    for (const text of collectRenderedText(toJSON())) {
      if (dynamicFixtureValues.has(text)) continue;
      expect(english.has(text)).toBe(false);
    }
  });
});
