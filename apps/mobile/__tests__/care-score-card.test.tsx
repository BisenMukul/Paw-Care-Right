import { petIdSchema, type AgendaResponse, type Pet } from "@pawcareright/types";
import { render, screen } from "@testing-library/react-native";
import * as ReactNative from "react-native";

import { CareScoreCard } from "../src/components/home/care-score-card";
import { useAgenda } from "../src/api/agenda-api";
import { strings } from "../src/strings";

/**
 * Mocks at the `useAgenda` hook boundary (mirrors `today-preview-card`'s own
 * data-source), so `CareScoreCard`'s loading/error/offline/data states are
 * exercised without a QueryClientProvider.
 */
jest.mock("../src/api/agenda-api", () => ({
  useAgenda: jest.fn(),
}));

const mockedUseAgenda = useAgenda as unknown as jest.Mock;

const PET: Pet = {
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

function buildAgenda(entries: AgendaResponse["entries"]): AgendaResponse {
  return { from: "2020-01-01T00:00:00.000Z", to: "2020-02-01T00:00:00.000Z", entries };
}

describe("CareScoreCard", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it("data: renders home-care-score-card + home-care-score-ring, bucket line matches the computed bucket", async () => {
    mockedUseAgenda.mockReturnValue({
      data: buildAgenda([
        {
          reminderId: "r1",
          petId: PET.id,
          type: "VACCINE",
          title: "Rabies booster",
          dueAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          status: "DONE",
          virtual: false,
        },
      ]),
      isLoading: false,
      isError: false,
    });

    await render(<CareScoreCard pet={PET} />);

    expect(screen.getByTestId("home-care-score-card")).toBeTruthy();
    expect(screen.getByTestId("home-care-score-ring")).toBeTruthy();
    expect(screen.getByTestId("home-care-score-bucket")).toHaveTextContent(strings.careScore.bucketOnTrack);
  });

  it("loading: shows a benign placeholder without throwing", async () => {
    mockedUseAgenda.mockReturnValue({ data: undefined, isLoading: true, isError: false });

    await render(<CareScoreCard pet={PET} />);

    expect(screen.getByTestId("home-care-score-card")).toBeTruthy();
    expect(screen.getByTestId("home-care-score-loading")).toBeTruthy();
  });

  it("error: renders the honest insufficient placeholder, never throws", async () => {
    mockedUseAgenda.mockReturnValue({ data: undefined, isLoading: false, isError: true });

    await render(<CareScoreCard pet={PET} />);

    expect(screen.getByTestId("home-care-score-card")).toBeTruthy();
    expect(screen.getByTestId("home-care-score-bucket")).toHaveTextContent(strings.careScore.bucketInsufficient);
  });

  it("offline (no cached data): renders the honest insufficient placeholder, never throws", async () => {
    mockedUseAgenda.mockReturnValue({ data: undefined, isLoading: false, isError: false });

    await render(<CareScoreCard pet={PET} />);

    expect(screen.getByTestId("home-care-score-card")).toBeTruthy();
    expect(screen.getByTestId("home-care-score-bucket")).toHaveTextContent(strings.careScore.bucketInsufficient);
  });

  it("empty agenda: renders the honest insufficient placeholder", async () => {
    mockedUseAgenda.mockReturnValue({ data: buildAgenda([]), isLoading: false, isError: false });

    await render(<CareScoreCard pet={PET} />);

    expect(screen.getByTestId("home-care-score-bucket")).toHaveTextContent(strings.careScore.bucketInsufficient);
  });

  it("renders without error in both color schemes", async () => {
    mockedUseAgenda.mockReturnValue({ data: buildAgenda([]), isLoading: false, isError: false });

    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("light");
    await render(<CareScoreCard pet={PET} />);
    expect(screen.getByTestId("home-care-score-card")).toBeTruthy();

    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");
    await render(<CareScoreCard pet={PET} />);
    expect(screen.getAllByTestId("home-care-score-card").length).toBeGreaterThan(0);
  });
});
