import { apiClient } from "../src/api/client";
import { DEFAULT_PAYWALL_CONFIG, fetchPaywallConfig } from "../src/billing/paywall-queries";

/**
 * T074 "copy/variant from /config" AC + offline-safe-default (plan Risk 6).
 */
jest.mock("../src/api/client", () => ({
  apiClient: { get: jest.fn() },
}));

const mockGet = apiClient.get as jest.Mock;

describe("fetchPaywallConfig", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("resolves the server variant on a valid 200 body", async () => {
    mockGet.mockResolvedValue({ paywall: { variant: "B" } });

    await expect(fetchPaywallConfig()).resolves.toEqual({ variant: "B" });
  });

  it("resolves the default variant A on a fetch rejection (offline)", async () => {
    mockGet.mockRejectedValue(new Error("network down"));

    await expect(fetchPaywallConfig()).resolves.toEqual(DEFAULT_PAYWALL_CONFIG);
  });

  it("resolves the default variant A on a malformed/schema-invalid body", async () => {
    mockGet.mockResolvedValue({ paywall: { variant: "not-a-real-variant" } });

    await expect(fetchPaywallConfig()).resolves.toEqual(DEFAULT_PAYWALL_CONFIG);
  });

  it("resolves the default variant A on a body missing the paywall field", async () => {
    mockGet.mockResolvedValue({});

    await expect(fetchPaywallConfig()).resolves.toEqual(DEFAULT_PAYWALL_CONFIG);
  });
});
