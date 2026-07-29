import { createQueryClient } from "@bombaypetcompany/api-client";
import type { Pet } from "@bombaypetcompany/types";
import { petIdSchema } from "@bombaypetcompany/types";
import { render, screen } from "@testing-library/react-native";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import React from "react";
import * as ReactNative from "react-native";

import ChatScreen from "../app/chat/index";
import { apiClient } from "../src/api/client";
import { ActivePetBadge } from "../src/components/chat/active-pet-badge";
import { ChatBubble } from "../src/components/chat/chat-bubble";
import { ChatComposer } from "../src/components/chat/chat-composer";
import { NudgeCard } from "../src/components/chat/nudge-card";
import { QuickPrompts } from "../src/components/chat/quick-prompts";
import { TypingIndicator } from "../src/components/chat/typing-indicator";
import { useActivePetStore } from "../src/pets/active-pet-store";
import { useChatStore } from "../src/chat/chat-store";

/**
 * T083 plan "Component / craft / theme" tests: every new chat component
 * carries both its light and `dark:` class (the established
 * `dual-theme-tokens.test.tsx` className-content convention -- `className`
 * stays an unresolved literal prop under this workspace's NativeWind +
 * jest setup, so content assertion IS the definitive check, per that file's
 * own header comment); the send button, quick-prompt chips, and nudge card
 * reach the 44pt touch floor; the transcript column widens only on `wide`
 * (RESPONSIVE-1 `use-layout-bucket.ts` convention -- `jest.spyOn(ReactNative,
 * "useWindowDimensions")`, NOT a destructured import, per that file's
 * namespace-spy note).
 */
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("../src/api/client", () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), streamSse: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

jest.mock("expo-crypto", () => ({
  randomUUID: jest.fn(() => "uuid-1"),
}));

const mockedGet = apiClient.get as jest.Mock;

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

function spyWidth(width: number) {
  return jest.spyOn(ReactNative, "useWindowDimensions").mockReturnValue({
    width,
    height: 1200,
    scale: 2,
    fontScale: 1,
  });
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe("chat components: dual-theme class content", () => {
  it("ActivePetBadge: pill + name + species carry dark variants", async () => {
    await render(<ActivePetBadge pet={PET_A} />);

    const badge = screen.getByTestId("chat-active-pet-badge");
    expect(badge.props.className).toContain("bg-brand-50");
    expect(badge.props.className).toContain("dark:bg-surface-raised-dark");
    expect(screen.getByText("Rex").props.className).toContain("dark:text-ink-dark");
  });

  it("ChatBubble: user bubble carries bg-brand-700 + dark:bg-accent-dark", async () => {
    await render(<ChatBubble message={{ id: "m1", role: "user", text: "Hello" }} />);

    const bubble = screen.getByTestId("chat-bubble-m1");
    expect(bubble.props.className).toContain("bg-brand-700");
    expect(bubble.props.className).toContain("dark:bg-accent-dark");
  });

  it("ChatBubble: assistant bubble carries bg-brand-50 + dark:bg-surface-raised-dark, text dark:text-ink-dark", async () => {
    await render(<ChatBubble message={{ id: "m2", role: "assistant", text: "Hi there", status: "ok" }} />);

    const bubble = screen.getByTestId("chat-bubble-m2");
    expect(bubble.props.className).toContain("bg-brand-50");
    expect(bubble.props.className).toContain("dark:bg-surface-raised-dark");
    expect(screen.getByText("Hi there").props.className).toContain("dark:text-ink-dark");
  });

  it("TypingIndicator: dots carry dark:bg-ink-muted-dark", async () => {
    await render(<TypingIndicator />);

    const indicator = screen.getByTestId("chat-typing-indicator");
    expect(JSON.stringify(indicator)).toContain("dark:bg-ink-muted-dark");
  });

  it("NudgeCard: carries dark:bg-surface-card-dark (Card canon) and the 44pt floor", async () => {
    await render(<NudgeCard testID="nudge" onPress={jest.fn()} />);

    const card = screen.getByTestId("nudge");
    expect(card.props.className).toContain("dark:bg-surface-card-dark");
    expect(card.props.className).toContain("min-h-[44px]");
  });

  it("QuickPrompts: chips carry dark:bg-surface-card-dark and the 44pt floor", async () => {
    await render(<QuickPrompts onSelect={jest.fn()} />);

    const chip = screen.getByTestId("chat-quick-prompt-food");
    expect(chip.props.className).toContain("dark:bg-surface-card-dark");
    expect(chip.props.className).toContain("min-h-[44px]");
  });

  it("ChatComposer: input carries dark:bg-surface-card-dark; enabled send button carries dark:bg-accent-dark and the 44pt floor", async () => {
    await render(<ChatComposer value="hi" onChangeText={jest.fn()} onSend={jest.fn()} />);

    expect(screen.getByTestId("chat-composer-input").props.className).toContain("dark:bg-surface-card-dark");
    const send = screen.getByTestId("chat-composer-send");
    expect(send.props.className).toContain("dark:bg-accent-dark");
    expect(send.props.className).toContain("h-11 w-11");
  });

  it("ChatComposer: disabled send button carries dark:bg-surface-raised-dark", async () => {
    await render(<ChatComposer value="" onChangeText={jest.fn()} onSend={jest.fn()} />);

    const send = screen.getByTestId("chat-composer-send");
    expect(send.props.className).toContain("dark:bg-surface-raised-dark");
  });
});

describe("chat screen: responsive transcript column (RESPONSIVE-1 convention)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useActivePetStore.getState().clear();
    useChatStore.setState({ threadIdByPetId: {}, messagesByPetId: {} });
    mockedGet.mockImplementation((path: string) => {
      if (path.startsWith("/v1/pets")) {
        return Promise.resolve([PET_A]);
      }
      return Promise.reject(new Error(`unexpected GET ${path}`));
    });
  });

  it("wide (1024): the transcript scroll content caps at max-w-2xl self-center", async () => {
    spyWidth(1024);

    const client = createTestQueryClient();
    await render(<ChatScreen />, { wrapper: makeWrapper(client) });

    const scroll = await screen.findByTestId("chat-transcript");
    expect(scroll.props.contentContainerClassName).toContain("max-w-2xl");
    expect(scroll.props.contentContainerClassName).toContain("self-center");
    expect(scroll.props.contentContainerClassName).toContain("gap-3 px-4 pb-4 pt-2");
  });

  it("regular (750, jest default): the transcript scroll content is byte-identical to the base class (no wide extras)", async () => {
    spyWidth(750);

    const client = createTestQueryClient();
    await render(<ChatScreen />, { wrapper: makeWrapper(client) });

    const scroll = await screen.findByTestId("chat-transcript");
    expect(scroll.props.contentContainerClassName).toBe("gap-3 px-4 pb-4 pt-2");
  });
});
