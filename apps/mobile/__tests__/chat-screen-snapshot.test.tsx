import { createQueryClient } from "@bombaypetcompany/api-client";
import { petIdSchema, type Pet } from "@bombaypetcompany/types";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import React from "react";

import ChatScreen from "../app/chat/index";
import { apiClient } from "../src/api/client";
import { useChatStore } from "../src/chat/chat-store";
import { useActivePetStore } from "../src/pets/active-pet-store";

/**
 * T083 plan AC-S1 (CLAUDE §7 rule 3): pins the chat screen with a completed
 * answer, disclaimer footer INCLUDED in the frozen tree. Commit the
 * generated snapshot; never hand-edit it.
 */
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
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

beforeEach(() => {
  jest.clearAllMocks();
  mockUuidCounter = 0;
  useActivePetStore.getState().clear();
  useChatStore.setState({ threadIdByPetId: {}, messagesByPetId: {} });
  mockedGet.mockImplementation((path: string) => {
    if (path.startsWith("/v1/pets")) {
      return Promise.resolve([PET_A]);
    }
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
  mockedPost.mockResolvedValue({ id: "thread-1", petId: PET_A.id, createdAt: "2024-01-01T00:00:00.000Z" });
});

describe("chat screen snapshot", () => {
  it("chat screen with a completed answer", async () => {
    mockedStreamSse.mockImplementation(async (_path: string, _body: unknown, options: { onFrame: (f: unknown) => void }) => {
      options.onFrame({ event: "start", data: JSON.stringify({ threadId: "thread-1", userMessageId: "u1", assistantMessageId: "a1" }) });
      options.onFrame({ event: "chunk", data: JSON.stringify({ seq: 0, text: "Here is some general guidance." }) });
      options.onFrame({
        event: "done",
        data: JSON.stringify({ assistantMessageId: "a1", status: "OK", quota: { used: 1, limit: 200, remaining: 199 } }),
      });
    });

    const client = createTestQueryClient();
    const { toJSON } = await render(<ChatScreen />, { wrapper: makeWrapper(client) });

    await waitFor(() => expect(screen.getByTestId("chat-active-pet-badge")).toBeTruthy());
    await fireEvent.changeText(screen.getByTestId("chat-composer-input"), "Is this normal?");
    await fireEvent.press(screen.getByTestId("chat-composer-send"));

    await waitFor(() => expect(screen.getByText("Here is some general guidance.")).toBeTruthy());
    expect(screen.getByTestId("vet-disclaimer")).toBeTruthy();

    expect(toJSON()).toMatchSnapshot();
  });
});
