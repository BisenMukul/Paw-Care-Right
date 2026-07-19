import { render, type RenderResult } from "@testing-library/react-native";
import type { ComponentType } from "react";

import ServicesIndexScreen from "../app/services";
import ServicesAdoptScreen from "../app/services/adopt";
import ServicesAdoptDetailScreen from "../app/services/adopt-detail";
import ServicesBookScreen from "../app/services/book";
import ServicesInsuranceScreen from "../app/services/insurance";
import ServicesPreviewEndScreen from "../app/services/preview-end";
import ServicesSalonsScreen from "../app/services/salons";
import ServicesSlotsScreen from "../app/services/slots";
import ServicesStoreScreen from "../app/services/store";
import ServicesVetsScreen from "../app/services/vets";

/**
 * PREVIEW-1 plan (AC scope-3 dual-theme): every service-flow screen carries
 * a `dark:bg-surface-*-dark` class somewhere on its root subtree and a key
 * text node's `dark:text-ink-dark` class, mirroring `services-hub.test.tsx`
 * / `check-flow-theme.test.tsx`'s idiom (mock `expo-router` at the hook
 * boundary, assert dark-token PRESENCE via `className` content -- NativeWind
 * under this jest setup never resolves `className`, it stays a literal
 * string regardless of OS color scheme, per design-system.md §1.6). Also
 * asserts the mounted `PreviewBanner` itself carries
 * `dark:bg-surface-raised-dark` on every screen.
 */
let mockParams: Record<string, string> = {};

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));

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

interface ScreenCase {
  name: string;
  Component: ComponentType;
  rootTestId: string;
  params: Record<string, string>;
}

const SCREENS: ScreenCase[] = [
  { name: "hub", Component: ServicesIndexScreen, rootTestId: "services-screen", params: {} },
  { name: "book", Component: ServicesBookScreen, rootTestId: "services-book-screen", params: {} },
  { name: "vets", Component: ServicesVetsScreen, rootTestId: "services-vets-screen", params: {} },
  { name: "salons", Component: ServicesSalonsScreen, rootTestId: "services-salons-screen", params: {} },
  {
    name: "slots",
    Component: ServicesSlotsScreen,
    rootTestId: "services-slots-screen",
    params: { kind: "vet", id: "vet-1" },
  },
  { name: "store", Component: ServicesStoreScreen, rootTestId: "services-store-screen", params: {} },
  { name: "adopt", Component: ServicesAdoptScreen, rootTestId: "services-adopt-screen", params: {} },
  {
    name: "adopt-detail",
    Component: ServicesAdoptDetailScreen,
    rootTestId: "services-adopt-detail-screen",
    params: { petId: "pet-1" },
  },
  { name: "insurance", Component: ServicesInsuranceScreen, rootTestId: "services-insurance-screen", params: {} },
  {
    name: "preview-end",
    Component: ServicesPreviewEndScreen,
    rootTestId: "services-preview-end-screen",
    params: { service: "vet" },
  },
];

describe("services preview theme: dual-theme tokens on every screen", () => {
  it.each(SCREENS.map((s): [string, ScreenCase] => [s.name, s]))(
    "%s root carries a dark surface class and ink-dark text; PreviewBanner carries dark:bg-surface-raised-dark",
    async (_name, s) => {
      mockParams = s.params;
      const Component = s.Component;
      const { toJSON } = await render(<Component />);

      const root = findByTestId(toJSON(), s.rootTestId);
      expect(root).not.toBeNull();
      const classNames = collectClassNames(root);

      expect(classNames.some((c) => /dark:bg-surface-\w+-dark/.test(c))).toBe(true);
      expect(classNames.some((c) => c.includes("dark:text-ink-dark"))).toBe(true);

      const banner = findByTestId(toJSON(), "services-preview-banner");
      expect(banner).not.toBeNull();
      expect(collectClassNames(banner).some((c) => c.includes("dark:bg-surface-raised-dark"))).toBe(true);
    },
  );
});
