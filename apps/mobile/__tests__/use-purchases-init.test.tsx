import { renderHook } from "@testing-library/react-native";

import { useAuthStore } from "../src/auth/auth-store";
import { usePurchasesInit } from "../src/billing/use-purchases-init";
import { identifyPurchaser, initPurchases, resetPurchaser } from "../src/billing/purchases";

jest.mock("../src/billing/purchases", () => ({
  initPurchases: jest.fn(),
  identifyPurchaser: jest.fn(async () => undefined),
  resetPurchaser: jest.fn(async () => undefined),
}));

const mockInitPurchases = initPurchases as jest.Mock;
const mockIdentifyPurchaser = identifyPurchaser as jest.Mock;
const mockResetPurchaser = resetPurchaser as jest.Mock;

describe("usePurchasesInit", () => {
  beforeEach(() => {
    mockInitPurchases.mockClear();
    mockIdentifyPurchaser.mockClear();
    mockResetPurchaser.mockClear();
    useAuthStore.setState({
      status: "restoring",
      user: null,
      householdId: null,
      accessToken: null,
    });
  });

  it("calls initPurchases on mount", async () => {
    await renderHook(() => usePurchasesInit());
    expect(mockInitPurchases).toHaveBeenCalledTimes(1);
  });

  it("does nothing while restoring", async () => {
    await renderHook(() => usePurchasesInit());
    expect(mockIdentifyPurchaser).not.toHaveBeenCalled();
    expect(mockResetPurchaser).not.toHaveBeenCalled();
  });

  it("identifies with user.id when already signedIn on mount", async () => {
    useAuthStore.setState({
      status: "signedIn",
      user: { id: "u1", email: "a@b.com" },
      householdId: "h1",
      accessToken: "tok",
    });

    await renderHook(() => usePurchasesInit());
    expect(mockIdentifyPurchaser).toHaveBeenCalledWith("u1");
  });

  it("identifies with user.id on a signedIn transition after mount", async () => {
    await renderHook(() => usePurchasesInit());

    useAuthStore.setState({
      status: "signedIn",
      user: { id: "u2", email: "c@d.com" },
      householdId: "h2",
      accessToken: "tok2",
    });

    expect(mockIdentifyPurchaser).toHaveBeenCalledWith("u2");
  });

  it("resets the purchaser on a signedOut transition", async () => {
    useAuthStore.setState({
      status: "signedIn",
      user: { id: "u1", email: "a@b.com" },
      householdId: "h1",
      accessToken: "tok",
    });

    await renderHook(() => usePurchasesInit());
    mockResetPurchaser.mockClear();

    useAuthStore.setState({
      status: "signedOut",
      user: null,
      householdId: null,
      accessToken: null,
    });

    expect(mockResetPurchaser).toHaveBeenCalledTimes(1);
  });
});
