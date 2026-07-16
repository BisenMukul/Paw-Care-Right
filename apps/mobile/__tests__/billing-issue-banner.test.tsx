import { fireEvent, render, screen } from "@testing-library/react-native";

import { useEntitlement } from "../src/api/billing-api";
import { useBillingBannerStore } from "../src/billing/billing-banner-store";
import { openManageSubscription } from "../src/billing/manage-subscription";
import { BillingIssueBanner } from "../src/components/billing-issue-banner";
import { strings } from "../src/strings";

/** T076 "billing-issue banner" AC. */
jest.mock("../src/api/billing-api", () => ({
  useEntitlement: jest.fn(),
}));

jest.mock("../src/billing/manage-subscription", () => ({
  openManageSubscription: jest.fn(),
}));

const mockedUseEntitlement = useEntitlement as unknown as jest.Mock;
const mockedOpenManageSubscription = openManageSubscription as jest.Mock;

describe("BillingIssueBanner", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useBillingBannerStore.setState({ dismissed: false });
  });

  it("renders on a BILLING_ISSUE fixture", async () => {
    mockedUseEntitlement.mockReturnValue({
      data: { entitled: true, source: "own", plan: "pawcareright_monthly", expiresAt: null, billingIssue: true },
    });

    await render(<BillingIssueBanner />);

    expect(screen.getByTestId("billing-issue-banner")).toBeTruthy();
  });

  it("is absent when entitled-clean (billingIssue: false)", async () => {
    mockedUseEntitlement.mockReturnValue({
      data: { entitled: true, source: "own", plan: "pawcareright_monthly", expiresAt: null, billingIssue: false },
    });

    await render(<BillingIssueBanner />);

    expect(screen.queryByTestId("billing-issue-banner")).toBeNull();
  });

  it("is absent while entitlement is loading (data: undefined)", async () => {
    mockedUseEntitlement.mockReturnValue({ data: undefined });

    await render(<BillingIssueBanner />);

    expect(screen.queryByTestId("billing-issue-banner")).toBeNull();
  });

  it("unmounts on dismiss (per-session store)", async () => {
    mockedUseEntitlement.mockReturnValue({
      data: { entitled: true, source: "own", plan: null, expiresAt: null, billingIssue: true },
    });

    await render(<BillingIssueBanner />);
    await fireEvent.press(screen.getByTestId("billing-issue-dismiss"));

    expect(useBillingBannerStore.getState().dismissed).toBe(true);
    expect(screen.queryByTestId("billing-issue-banner")).toBeNull();
  });

  it("pressing fix calls openManageSubscription", async () => {
    mockedUseEntitlement.mockReturnValue({
      data: { entitled: true, source: "own", plan: null, expiresAt: null, billingIssue: true },
    });

    await render(<BillingIssueBanner />);
    await fireEvent.press(screen.getByTestId("billing-issue-fix"));

    expect(mockedOpenManageSubscription).toHaveBeenCalledTimes(1);
  });

  it("copy contains no diagnosis/dose/medication tokens", async () => {
    mockedUseEntitlement.mockReturnValue({
      data: { entitled: true, source: "own", plan: null, expiresAt: null, billingIssue: true },
    });

    const copy = [strings.settings.billingIssue.body, strings.settings.billingIssue.fix, strings.settings.billingIssue.dismiss].join(
      " ",
    );

    expect(copy).not.toMatch(/diagnos/i);
    expect(copy).not.toMatch(/\bdose|dosage\b/i);
    expect(copy).not.toMatch(/\bmedication\b/i);
  });
});
