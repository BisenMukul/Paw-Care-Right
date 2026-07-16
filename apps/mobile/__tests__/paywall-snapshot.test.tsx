import { APP_DISPLAY_NAME } from "@pawcareright/config";
import { render, screen } from "@testing-library/react-native";

import PaywallScreen from "../app/paywall";
import type { PaywallOffering } from "../src/billing/paywall-types";

/**
 * T074 "Snapshot both variants" AC. `usePaywallConfig`/`useOfferings` are
 * mocked so the screen renders deterministically from a fixed variant + a
 * fixture RC offering (proving prices come from the offering, never
 * hardcoded, and both A/B copy variants render).
 */
const mockUsePaywallConfig = jest.fn();
const mockUseOfferings = jest.fn();

jest.mock("../src/billing/paywall-queries", () => ({
  usePaywallConfig: () => mockUsePaywallConfig(),
  useOfferings: () => mockUseOfferings(),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ source: "onboarding" }),
}));

const FIXTURE_OFFERING: PaywallOffering = {
  packages: [
    { id: "monthly", priceString: "$4.99/mo", introPriceString: "Free for 7 days", rcPackage: {} },
    { id: "annual", priceString: "$39.99/yr", rcPackage: {} },
    { id: "family", priceString: "$59.99/yr", rcPackage: {} },
  ],
};

const FORBIDDEN_TOKENS = [/diagnos/i, /\bdose\b|\bdosage\b/i, /\bmedication\b/i];

function assertCommonContent() {
  expect(screen.getByTestId("paywall-plan-annual")).toBeTruthy();
  expect(screen.getByTestId("paywall-plan-annual-highlight")).toBeTruthy();
  expect(screen.getByTestId("paywall-plan-family")).toBeTruthy();
  expect(screen.getByTestId("paywall-family-explainer")).toBeTruthy();
  expect(screen.getByTestId("paywall-trial-cta")).toBeTruthy();
  expect(screen.getByTestId("paywall-restore")).toBeTruthy();
  expect(screen.getByTestId("paywall-terms")).toBeTruthy();
  expect(screen.getByTestId("paywall-privacy")).toBeTruthy();

  // Prices shown equal the OFFERING fixture values -- proves price-from-SDK, not hardcoded.
  expect(screen.getByTestId("paywall-price-annual")).toHaveTextContent("$39.99/yr");
  expect(screen.getByTestId("paywall-price-monthly")).toHaveTextContent("$4.99/mo");
  expect(screen.getByTestId("paywall-price-family")).toHaveTextContent("$59.99/yr");

  expect(screen.getByTestId("paywall-headline")).toHaveTextContent(APP_DISPLAY_NAME, { exact: false });

  // §7 guard: no diagnosis/dose/medication tokens anywhere in the rendered tree.
  const rendered = JSON.stringify(screen.toJSON());
  for (const pattern of FORBIDDEN_TOKENS) {
    expect(rendered).not.toMatch(pattern);
  }
}

describe("paywall screen — variant A", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePaywallConfig.mockReturnValue({ data: { variant: "A" } });
    mockUseOfferings.mockReturnValue({ data: FIXTURE_OFFERING, isLoading: false });
  });

  it("renders and matches the snapshot", async () => {
    const view = await render(<PaywallScreen />);

    assertCommonContent();
    expect(view.toJSON()).toMatchSnapshot();
  });
});

describe("paywall screen — variant B", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePaywallConfig.mockReturnValue({ data: { variant: "B" } });
    mockUseOfferings.mockReturnValue({ data: FIXTURE_OFFERING, isLoading: false });
  });

  it("renders and matches the snapshot", async () => {
    const view = await render(<PaywallScreen />);

    assertCommonContent();
    expect(view.toJSON()).toMatchSnapshot();
  });
});

describe("paywall screen — offering unavailable (Expo Go / no offering)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePaywallConfig.mockReturnValue({ data: { variant: "A" } });
    mockUseOfferings.mockReturnValue({ data: null, isLoading: false });
  });

  it("shows the unavailable state, no crash, no fake prices", async () => {
    await render(<PaywallScreen />);

    expect(screen.getByTestId("paywall-unavailable")).toBeTruthy();
    expect(screen.queryByTestId("paywall-plan-annual")).toBeNull();
  });
});
