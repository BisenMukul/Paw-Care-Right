import { fireEvent, render, screen } from "@testing-library/react-native";

import BreedGuidesExploreScreen from "../app/breeds/index";
import * as breedGuideContent from "../src/content/breed-guide-content";
import { strings } from "../src/strings";

/**
 * T087 plan (AC1/AC2/AC3) — the explore list: grouped, tappable rows; the
 * empty guard (D6/R6, exercised via a mocked-empty content module since
 * today's 5 exemplars can never produce it for real); touch targets/a11y.
 *
 * `listPublishedBreedGuides` is wrapped as a `jest.fn` around its own real
 * implementation (`jest.requireActual`) so every test gets REAL data by
 * default; only the empty-guard test overrides it with `mockReturnValueOnce`
 * — no `jest.resetModules()`/re-require needed, so there is no risk of a
 * duplicate React module instance.
 */
jest.mock("../src/content/breed-guide-content", () => {
  const actual = jest.requireActual("../src/content/breed-guide-content") as typeof import("../src/content/breed-guide-content");
  return {
    ...actual,
    listPublishedBreedGuides: jest.fn(actual.listPublishedBreedGuides),
  };
});

const mockedListPublishedBreedGuides = breedGuideContent.listPublishedBreedGuides as jest.Mock;

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe("breed guides explore list: renders a grouped, tappable row per published guide", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedListPublishedBreedGuides.mockImplementation(
      jest.requireActual("../src/content/breed-guide-content").listPublishedBreedGuides,
    );
  });

  it("renders 5 rows and both species group headers, each row a button", async () => {
    await render(<BreedGuidesExploreScreen />);

    expect(screen.getByTestId("breeds-group-dog")).toBeTruthy();
    expect(screen.getByTestId("breeds-group-cat")).toBeTruthy();

    const rowTestIds = [
      "breeds-row-dog-german-shepherd",
      "breeds-row-dog-golden-retriever",
      "breeds-row-dog-labrador-retriever",
      "breeds-row-cat-maine-coon",
      "breeds-row-cat-persian",
    ];
    for (const testID of rowTestIds) {
      const row = screen.getByTestId(testID);
      expect(row).toBeTruthy();
      expect(row.props.accessibilityRole).toBe("button");
    }
  });

  it("row press navigates to the guide route", async () => {
    await render(<BreedGuidesExploreScreen />);

    await fireEvent.press(screen.getByTestId("breeds-row-dog-labrador-retriever"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/breeds/[species]/[slug]",
      params: { species: "dog", slug: "labrador-retriever" },
    });
  });
});

describe("breed guides explore list: empty guard (D6/R6)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("empty guard renders the empty state", async () => {
    mockedListPublishedBreedGuides.mockReturnValueOnce([]);

    await render(<BreedGuidesExploreScreen />);

    expect(screen.getByTestId("breeds-explore-empty")).toBeTruthy();
    expect(screen.queryByTestId("breeds-group-dog")).toBeNull();
    expect(screen.queryByTestId("breeds-group-cat")).toBeNull();
  });
});

describe("breed guides explore list: a11y", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedListPublishedBreedGuides.mockImplementation(
      jest.requireActual("../src/content/breed-guide-content").listPublishedBreedGuides,
    );
  });

  it("rows are labeled buttons with ≥44pt targets", async () => {
    await render(<BreedGuidesExploreScreen />);

    const row = screen.getByTestId("breeds-row-dog-labrador-retriever");
    expect(typeof row.props.accessibilityLabel).toBe("string");
    expect(row.props.accessibilityLabel.length).toBeGreaterThan(0);
    expect(row.props.className).toContain("min-h-[56px]");
  });

  it("screen title is a header", async () => {
    await render(<BreedGuidesExploreScreen />);

    const title = screen.getByText(strings.breedGuide.listTitle);
    expect(title.props.accessibilityRole).toBe("header");
  });
});
