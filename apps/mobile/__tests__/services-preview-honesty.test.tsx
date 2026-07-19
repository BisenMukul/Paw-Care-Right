import { render, screen } from "@testing-library/react-native";
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
import { strings } from "../src/strings";

/**
 * PREVIEW-1 plan HONESTY ARCHITECTURE: (1) the PREVIEW banner is present
 * and non-dismissible on EVERY one of the 10 service-flow screens; (2) the
 * single shared terminal never frames itself as a real success (no
 * confirmed/booked/purchased/approved/success/order-placed lexeme) and
 * collects nothing (no `TextInput`); (3) every new string in
 * `strings.servicesPreview` -- including the literal text baked into its
 * template-literal functions -- is scanned for the same forbidden
 * vocabulary plus notify/currency/year/medical tokens.
 */
let mockParams: Record<string, string> = {};

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));

interface ScreenCase {
  name: string;
  Component: ComponentType;
  params: Record<string, string>;
}

const SCREENS: ScreenCase[] = [
  { name: "hub", Component: ServicesIndexScreen, params: {} },
  { name: "book", Component: ServicesBookScreen, params: {} },
  { name: "vets", Component: ServicesVetsScreen, params: {} },
  { name: "salons", Component: ServicesSalonsScreen, params: {} },
  { name: "slots", Component: ServicesSlotsScreen, params: { kind: "vet", id: "vet-1" } },
  { name: "store", Component: ServicesStoreScreen, params: {} },
  { name: "adopt", Component: ServicesAdoptScreen, params: {} },
  { name: "adopt-detail", Component: ServicesAdoptDetailScreen, params: { petId: "pet-1" } },
  { name: "insurance", Component: ServicesInsuranceScreen, params: {} },
  { name: "preview-end", Component: ServicesPreviewEndScreen, params: { service: "vet" } },
];

describe("services preview honesty: PreviewBanner on every screen (non-dismissible)", () => {
  it.each(SCREENS.map((s): [string, ScreenCase] => [s.name, s]))(
    "%s renders services-preview-banner with no close/dismiss control",
    async (_name, s) => {
      mockParams = s.params;
      const Component = s.Component;
      await render(<Component />);

      const banner = screen.getByTestId("services-preview-banner");
      expect(banner).toBeTruthy();
      expect(banner.props.onPress).toBeUndefined();
    },
  );
});

describe("services preview honesty: single honest terminal, no success framing, no data capture", () => {
  const FORBIDDEN = /\b(confirmed|booked|purchased|approved|success|order placed)\b/i;

  it.each(["vet", "salon", "store", "adopt"])(
    "preview-end for service=%s frames itself as a preview and collects nothing",
    async (service) => {
      mockParams = { service };
      const { toJSON } = await render(<ServicesPreviewEndScreen />);

      expect(screen.getByTestId("services-preview-end-title")).toHaveTextContent(strings.servicesPreview.end.title);

      const serialized = JSON.stringify(toJSON());
      expect(serialized).toContain("isn't available yet");
      expect(serialized).not.toMatch(FORBIDDEN);
      expect(serialized).not.toContain('"TextInput"');
    },
  );
});

/**
 * Also captures the ACTUAL rendered output of every template-literal
 * function (e.g. `end.body`, `vets.ratingA11y`) by invoking it with
 * representative sample arguments, rather than a plain `JSON.stringify`
 * (which drops function values entirely) or a raw `.toString()` (whose
 * template-literal source contains a literal `${` -- a false-positive
 * currency-symbol match). Unresolvable arg types for a given function are
 * skipped (try/catch), not fatal to the scan.
 */
function collectStrings(value: unknown, acc: string[] = []): string[] {
  if (typeof value === "string") {
    acc.push(value);
    return acc;
  }
  if (typeof value === "function") {
    const fn = value as (...args: unknown[]) => unknown;
    for (const arg of ["sample-value", 3] as const) {
      try {
        const result = fn(arg);
        if (typeof result === "string") {
          acc.push(result);
        } else if (Array.isArray(result)) {
          collectStrings(result, acc);
        }
      } catch {
        // wrong arg type/arity for this function -- skip
      }
    }
    return acc;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, acc));
    return acc;
  }
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach((item) => collectStrings(item, acc));
    return acc;
  }
  return acc;
}

describe("services preview honesty: forbidden-vocabulary string tone scan", () => {
  it("strings.servicesPreview contains no success/notify/currency/year/medical token", () => {
    const serialized = collectStrings(strings.servicesPreview).join(" | ");

    expect(serialized).not.toMatch(/\b(confirmed|booked|purchased|approved|success|order placed)\b/i);
    expect(serialized).not.toMatch(/\bnotify\b/i);
    expect(serialized).not.toMatch(/[₹$€£]/);
    expect(serialized).not.toMatch(/\b(19|20)\d\d\b/);
    expect(serialized).not.toMatch(/\b(dose|dosage|mg|diagnos)/i);
  });
});
