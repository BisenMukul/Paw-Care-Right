import { cleanup, fireEvent, render, screen } from "@testing-library/react-native";

import { UpsellSheet } from "../src/components/upsell-sheet";
import { useUpsellStore } from "../src/billing/upsell-store";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

/** T075 AC "upsell sheet triggered by error code (mobile test)" — sheet half. */
describe("UpsellSheet", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useUpsellStore.setState({ visible: false });
  });

  afterEach(() => {
    cleanup();
    useUpsellStore.setState({ visible: false });
  });

  it("renders nothing when hidden", async () => {
    await render(<UpsellSheet />);

    expect(screen.queryByTestId("upsell-sheet")).toBeNull();
  });

  it("renders the sheet when visible", async () => {
    useUpsellStore.setState({ visible: true });

    await render(<UpsellSheet />);

    expect(screen.getByTestId("upsell-sheet")).toBeTruthy();
  });

  it("'See plans' navigates to /paywall (source: upsell) and hides", async () => {
    useUpsellStore.setState({ visible: true });

    await render(<UpsellSheet />);
    fireEvent.press(screen.getByTestId("upsell-see-plans"));

    expect(mockPush).toHaveBeenCalledWith({ pathname: "/paywall", params: { source: "upsell" } });
    expect(useUpsellStore.getState().visible).toBe(false);
  });

  it("'Not now' just hides, no navigation", async () => {
    useUpsellStore.setState({ visible: true });

    await render(<UpsellSheet />);
    fireEvent.press(screen.getByTestId("upsell-dismiss"));

    expect(mockPush).not.toHaveBeenCalled();
    expect(useUpsellStore.getState().visible).toBe(false);
  });

  it("contains no diagnosis/dose/medication tokens (§5-adjacent copy guard)", async () => {
    useUpsellStore.setState({ visible: true });

    await render(<UpsellSheet />);
    const text = JSON.stringify(screen.toJSON());

    expect(text).not.toMatch(/diagnos/i);
    expect(text).not.toMatch(/\bdose|dosage\b/i);
    expect(text).not.toMatch(/\bmedication\b/i);
  });
});
