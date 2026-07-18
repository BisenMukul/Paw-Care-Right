import { fireEvent, render, screen, type RenderResult } from "@testing-library/react-native";

import ServicesScreen from "../app/services";
import SettingsScreen from "../app/(tabs)/settings";
import { useEntitlement } from "../src/api/billing-api";
import { strings } from "../src/strings";

/**
 * PAWSAATHI-4 plan (scope 1 "Tests -- new"): the Services hub is a static,
 * non-interactive, honest "coming soon" list -- no booking/adopt/shop flow,
 * no "Notify me"/waitlist capture (decision 2, HONESTY RULE), no price/date.
 */
const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("../src/api/billing-api", () => ({
  useEntitlement: jest.fn(),
}));

const mockedUseEntitlement = useEntitlement as unknown as jest.Mock;

type JsonNode = ReturnType<RenderResult["toJSON"]>;

/** Recursively collects every `className` string anywhere in a rendered JSON
 * (sub)tree (mirrors `check-flow-theme.test.tsx`'s `collectClassNames`). */
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

/** Finds the first node whose `testID` matches, returning its JSON subtree. */
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

const SERVICE_KEYS = ["vet", "salon", "store", "adoption", "insurance"] as const;

describe("services hub: cards render", () => {
  it("all 5 service cards render with their titles", async () => {
    await render(<ServicesScreen />);

    for (const key of SERVICE_KEYS) {
      const card = screen.getByTestId(`services-card-${key}`);
      expect(card).toBeTruthy();
      expect(card).toHaveTextContent(strings.services.items[key].title, { exact: false });
    }
  });
});

describe("services hub: coming-soon states, no capture (decision 2)", () => {
  it("every card shows a coming-soon badge; no notify/waitlist/on-the-list text; no card is a button", async () => {
    const { toJSON } = await render(<ServicesScreen />);

    for (const key of SERVICE_KEYS) {
      const badge = screen.getByTestId(`services-badge-${key}`);
      expect(badge).toHaveTextContent(strings.services.comingSoon);

      const card = screen.getByTestId(`services-card-${key}`);
      expect(card.props.accessibilityRole).not.toBe("button");
      expect(card.props.onPress).toBeUndefined();
    }

    const rendered = JSON.stringify(toJSON());
    expect(rendered).not.toMatch(/notify me/i);
    expect(rendered).not.toMatch(/waitlist/i);
    expect(rendered).not.toMatch(/on the list/i);
  });
});

describe("services hub: a11y", () => {
  it("screen title is a header, each card is accessible with a 'coming soon' label", async () => {
    await render(<ServicesScreen />);

    const title = screen.getByText(strings.services.title);
    expect(title.props.accessibilityRole).toBe("header");

    for (const key of SERVICE_KEYS) {
      const card = screen.getByTestId(`services-card-${key}`);
      expect(card.props.accessible).toBe(true);
      expect(card.props.accessibilityLabel).toMatch(/coming soon/i);
    }
  });
});

describe("services hub: navigation entry point", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseEntitlement.mockReturnValue({ data: undefined });
  });

  it("pressing settings-services navigates to /services", async () => {
    await render(<SettingsScreen />);

    await fireEvent.press(screen.getByTestId("settings-services"));

    expect(mockPush).toHaveBeenCalledWith("/services");
  });
});

describe("services hub: tone scan (record-only, CLAUDE §7 / decision 2)", () => {
  it("the strings.services namespace contains no year/currency/notify/medical token, and DOES contain 'Coming soon'", () => {
    const serialized = JSON.stringify(strings.services);

    expect(serialized).not.toMatch(/\b(19|20)\d\d\b/);
    expect(serialized).not.toMatch(/[₹$€£]/);
    expect(serialized).not.toMatch(/\bnotify\b/i);
    expect(serialized).not.toMatch(/\b(dose|dosage|mg|diagnos)/i);
    expect(serialized).toContain("Coming soon");
  });
});

describe("services hub: dark tokens", () => {
  it("root carries dark:bg-surface-page-dark, a card carries dark:bg-surface-card-dark, a badge carries dark:text-accent-bright", async () => {
    const { toJSON } = await render(<ServicesScreen />);

    const root = findByTestId(toJSON(), "services-screen");
    expect(root).not.toBeNull();
    const classNames = collectClassNames(root);
    expect(classNames.some((c) => c.includes("dark:bg-surface-page-dark"))).toBe(true);
    expect(classNames.some((c) => c.includes("dark:bg-surface-card-dark"))).toBe(true);
    expect(classNames.some((c) => c.includes("dark:text-accent-bright"))).toBe(true);
  });
});
