import { getBreedGuide } from "@pawcareright/data";
import { render, screen, type RenderResult } from "@testing-library/react-native";

import BreedGuideDetailScreen from "../app/breeds/[species]/[slug]";
import { guideRouteParams, listPublishedBreedGuides } from "../src/content/breed-guide-content";
import { strings } from "../src/strings";

/**
 * T087 plan (AC2/AC3) — deep-link + a11y + theme coverage for the guide
 * detail screen. `useLocalSearchParams` and `Redirect` are mocked per the
 * established per-file pattern (`check-deeplink-route.test.tsx`);
 * `useRouter` is mocked minimally (only `AppHeader`'s back control needs
 * it) so the "cold start from params alone" test genuinely proves the
 * screen's CONTENT depends on nothing but the URL params + local data.
 *
 * Native `pawcareright://` URL -> route resolution (`getInitialURL`) is NOT
 * exercised here — RNTL cannot mount the native linking layer; these tests
 * prove params-only cold-start rendering. Deferred per the
 * `check-deeplink-route.test.tsx` precedent (T050 plan Risk 2).
 */
const mockRedirect = jest.fn((href: unknown) => {
  void href;
  return null;
});
const mockUseLocalSearchParams = jest.fn();
const mockCanGoBack = jest.fn(() => true);
const mockBack = jest.fn();
const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace, canGoBack: mockCanGoBack }),
  useLocalSearchParams: () => mockUseLocalSearchParams(),
  Redirect: (props: { href: unknown }) => mockRedirect(props.href),
}));

const LABRADOR = getBreedGuide("DOG", "labrador-retriever");
if (LABRADOR === undefined) {
  throw new Error("test fixture assumption broken: DOG/labrador-retriever is no longer a published guide");
}

type JsonNode = ReturnType<RenderResult["toJSON"]>;

function collectClassNames(node: JsonNode | JsonNode[] | string | null | undefined, acc: string[] = []): string[] {
  if (node == null || typeof node === "string") {
    return acc;
  }
  if (Array.isArray(node)) {
    node.forEach((child) => collectClassNames(child, acc));
    return acc;
  }
  const className = (node.props as { className?: unknown } | undefined)?.className;
  if (typeof className === "string") {
    acc.push(className);
  }
  collectClassNames(node.children as JsonNode[] | null, acc);
  return acc;
}

function findByTestId(node: JsonNode | JsonNode[] | string | null | undefined, testID: string): JsonNode | null {
  if (node == null || typeof node === "string") {
    return null;
  }
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findByTestId(child, testID);
      if (found !== null) {
        return found;
      }
    }
    return null;
  }
  if ((node.props as { testID?: unknown } | undefined)?.testID === testID) {
    return node;
  }
  return findByTestId(node.children as JsonNode[] | null, testID);
}

describe("breed guide detail screen: renders exemplar content", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders every section of a published exemplar", async () => {
    mockUseLocalSearchParams.mockReturnValue({ species: "dog", slug: "labrador-retriever" });

    await render(<BreedGuideDetailScreen />);

    expect(screen.getByTestId("breed-guide-section-temperament")).toBeTruthy();
    expect(screen.getByTestId("breed-guide-section-exercise")).toBeTruthy();
    expect(screen.getByTestId("breed-guide-section-conditions")).toBeTruthy();
    expect(screen.getByTestId("breed-guide-section-grooming")).toBeTruthy();
    expect(screen.getByTestId("breed-guide-section-temperament")).toHaveTextContent(LABRADOR.temperament, {
      exact: false,
    });
  });

  it("renders the non-dismissible vet disclaimer", async () => {
    mockUseLocalSearchParams.mockReturnValue({ species: "dog", slug: "labrador-retriever" });

    await render(<BreedGuideDetailScreen />);

    expect(screen.getByTestId("vet-disclaimer")).toBeTruthy();
  });

  it("screen title renders as a header via AppHeader", async () => {
    mockUseLocalSearchParams.mockReturnValue({ species: "dog", slug: "labrador-retriever" });

    await render(<BreedGuideDetailScreen />);

    const title = screen.getByTestId("app-header-title");
    expect(title.props.accessibilityRole).toBe("header");
    expect(title).toHaveTextContent(strings.breedGuide.title("Labrador Retriever"));
  });
});

describe("breed guide detail screen: renders every published exemplar (B10)", () => {
  const publishedEntries = listPublishedBreedGuides();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  beforeAll(() => {
    // Non-vacuity guard (M12): if the dataset ever shrinks below 5 published
    // guides, every test in this block fails loudly instead of silently
    // parametrising over too few (or zero) exemplars.
    expect(publishedEntries.length).toBeGreaterThanOrEqual(5);
  });

  it.each(publishedEntries.map((entry) => [`${entry.guide.species}/${entry.guide.slug}`, entry] as const))(
    "renders every section for %s",
    async (_label, entry) => {
      mockUseLocalSearchParams.mockReturnValue(guideRouteParams(entry));

      await render(<BreedGuideDetailScreen />);

      expect(screen.getByTestId("breed-guide-section-temperament")).toBeTruthy();
      expect(screen.getByTestId("breed-guide-section-exercise")).toBeTruthy();
      expect(screen.getByTestId("breed-guide-section-conditions")).toBeTruthy();
      expect(screen.getByTestId("breed-guide-section-grooming")).toBeTruthy();
      expect(screen.getByTestId("breed-guide-section-temperament")).toHaveTextContent(entry.guide.temperament, {
        exact: false,
      });
      expect(screen.getByTestId("vet-disclaimer")).toBeTruthy();
    },
  );
});

describe("breed guide detail screen: deep link (AC2)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("cold start from URL params alone renders the guide", async () => {
    mockUseLocalSearchParams.mockReturnValue({ species: "dog", slug: "labrador-retriever" });

    await render(<BreedGuideDetailScreen />);

    expect(screen.getByTestId("breed-guide-sections")).toBeTruthy();
  });

  it("uppercase species param also resolves", async () => {
    mockUseLocalSearchParams.mockReturnValue({ species: "DOG", slug: "labrador-retriever" });

    await render(<BreedGuideDetailScreen />);

    expect(screen.getByTestId("breed-guide-sections")).toBeTruthy();
  });

  it("unknown species param redirects to the explore list", async () => {
    mockUseLocalSearchParams.mockReturnValue({ species: "hamster", slug: "x" });

    await render(<BreedGuideDetailScreen />);

    expect(mockRedirect).toHaveBeenCalledWith("/breeds");
    expect(screen.queryByTestId("breed-guide-sections")).toBeNull();
  });

  it("missing slug redirects to the explore list", async () => {
    mockUseLocalSearchParams.mockReturnValue({ species: "dog", slug: undefined });

    await render(<BreedGuideDetailScreen />);

    expect(mockRedirect).toHaveBeenCalledWith("/breeds");
  });

  it("a draft slug shows not-found and no guide content", async () => {
    mockUseLocalSearchParams.mockReturnValue({ species: "dog", slug: "beagle" });

    await render(<BreedGuideDetailScreen />);

    expect(screen.getByTestId("breed-guide-not-found")).toBeTruthy();
    expect(screen.queryByTestId("breed-guide-sections")).toBeNull();
  });
});

describe("breed guide detail screen: theme", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("dual-theme tokens", async () => {
    mockUseLocalSearchParams.mockReturnValue({ species: "dog", slug: "labrador-retriever" });

    const { toJSON } = await render(<BreedGuideDetailScreen />);

    const root = findByTestId(toJSON(), "breed-guide-screen");
    expect(root).not.toBeNull();
    const classNames = collectClassNames(root);
    expect(classNames.some((c) => c.includes("dark:bg-surface-page-dark"))).toBe(true);
    expect(classNames.some((c) => c.includes("dark:bg-surface-card-dark"))).toBe(true);
    expect(classNames.some((c) => c.includes("dark:text-ink-dark"))).toBe(true);
  });
});
