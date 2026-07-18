import { petIdSchema, type Pet } from "@pawcareright/types";
import { render, screen, type RenderResult } from "@testing-library/react-native";

import FamilyScreen from "../app/family";
import PaywallScreen from "../app/paywall";
import PetHomeScreen from "../app/pets/[id]";
import ComingSoonScreen from "../app/coming-soon";
import SpeciesScreen from "../app/add-pet/species";
import SettingsScreen from "../app/(tabs)/settings";
import { useEntitlement } from "../src/api/billing-api";
import { useCreateInvite, useHouseholdMe, useLeaveHousehold } from "../src/api/households-api";
import { usePet } from "../src/api/pets-api";
import { UpsellSheet } from "../src/components/upsell-sheet";
import { useUpsellStore } from "../src/billing/upsell-store";
import type { PaywallOffering } from "../src/billing/paywall-types";

/**
 * PAWSAATHI-4 plan (scope 9 "Tests -- new"): dark-evidence sweep over the
 * batch's remaining screens (mirrors `timeline-screen-theme.test.tsx`/
 * `check-flow-theme.test.tsx`'s mock idiom) -- each page root carries a dark
 * surface token and a key text node carries a dark ink token. Also pins
 * decision 4 (the paywall notice fills + `BillingIssueBanner` stay FROZEN,
 * no `dark:`) and the record-only §7 "no diagnos" invariant.
 */
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
  useLocalSearchParams: () => ({ id: "pet1", petId: "pet1" }),
}));

jest.mock("../src/api/pets-api", () => ({
  usePet: jest.fn(),
}));

jest.mock("../src/api/billing-api", () => ({
  useEntitlement: jest.fn(),
}));

jest.mock("../src/api/households-api", () => ({
  useHouseholdMe: jest.fn(),
  useCreateInvite: jest.fn(),
  useLeaveHousehold: jest.fn(),
}));

jest.mock("../src/billing/paywall-queries", () => ({
  usePaywallConfig: () => ({ data: { variant: "A" } }),
  useOfferings: () => ({ data: FIXTURE_OFFERING, isLoading: false }),
}));

jest.mock("../src/billing/manage-subscription", () => ({
  openManageSubscription: jest.fn(),
}));

jest.mock("../src/billing/purchases", () => ({
  restorePurchases: jest.fn().mockResolvedValue({ status: "error" }),
  purchasePackage: jest.fn(),
}));

jest.mock("../src/billing/upsell-store", () => ({
  useUpsellStore: jest.fn(),
}));

const mockedUsePet = usePet as unknown as jest.Mock;
const mockedUseEntitlement = useEntitlement as unknown as jest.Mock;
const mockedUseHouseholdMe = useHouseholdMe as unknown as jest.Mock;
const mockedUseCreateInvite = useCreateInvite as unknown as jest.Mock;
const mockedUseLeaveHousehold = useLeaveHousehold as unknown as jest.Mock;
const mockedUseUpsellStore = useUpsellStore as unknown as jest.Mock;

const FIXTURE_OFFERING: PaywallOffering = {
  packages: [
    { id: "monthly", priceString: "$4.99/mo", rcPackage: {} },
    { id: "annual", priceString: "$39.99/yr", rcPackage: {} },
  ],
};

const FIXTURE_PET: Pet = {
  id: petIdSchema.parse("11111111-1111-4111-8111-111111111111"),
  householdId: "22222222-2222-2222-2222-222222222222",
  species: "DOG",
  sex: "MALE",
  name: "Rex",
  neutered: true,
  breedSlug: null,
  birthDate: null,
  ageEstimateMonths: null,
  weightGrams: null,
  photoKey: null,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

type JsonNode = ReturnType<RenderResult["toJSON"]>;

/** Recursively collects every `className` string anywhere in a rendered JSON
 * (sub)tree (mirrors `check-flow-theme.test.tsx`'s `collectClassNames`). */
function collectClassNames(
  node: JsonNode | JsonNode[] | string | null | undefined,
  skipTestIds: readonly string[] = [],
  acc: string[] = [],
): string[] {
  if (node == null || typeof node === "string") {
    return acc;
  }
  if (Array.isArray(node)) {
    node.forEach((child) => collectClassNames(child, skipTestIds, acc));
    return acc;
  }
  const testID = (node.props as { testID?: unknown } | undefined)?.testID;
  if (typeof testID === "string" && skipTestIds.includes(testID)) {
    return acc;
  }
  const className = (node.props as { className?: unknown } | undefined)?.className;
  if (typeof className === "string") {
    acc.push(className);
  }
  collectClassNames(node.children as JsonNode[] | null, skipTestIds, acc);
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

describe("sweep-remaining-theme: representative PAWSAATHI-4 screens carry dark tokens", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseEntitlement.mockReturnValue({ data: undefined });
  });

  it("PaywallScreen: root + headline carry dark tokens", async () => {
    const { toJSON } = await render(<PaywallScreen />);

    const root = findByTestId(toJSON(), "paywall-screen");
    expect(root?.props.className).toContain("dark:bg-surface-page-dark");
    const headline = screen.getByTestId("paywall-headline");
    expect(headline.props.className).toContain("dark:text-ink-dark");
    expect(headline.props.className).toContain("font-display");
  });

  it("PetHomeScreen (pets/[id]): loaded root region + name carry dark tokens", async () => {
    mockedUsePet.mockReturnValue({ data: FIXTURE_PET, isLoading: false, isError: false, isFetching: false, refetch: jest.fn() });

    const { toJSON } = await render(<PetHomeScreen />);

    const classNames = collectClassNames(toJSON());
    expect(classNames.some((c) => c.includes("dark:bg-surface-card-dark"))).toBe(true);
    const name = screen.getByTestId("pet-home-name");
    expect(name.props.className).toContain("dark:text-ink-dark");
  });

  it("add-pet wizard step (species): heading carries dark tokens", async () => {
    const { toJSON } = await render(<SpeciesScreen />);

    const classNames = collectClassNames(toJSON());
    expect(classNames.some((c) => c.includes("dark:bg-surface-page-dark"))).toBe(true);
    expect(classNames.some((c) => c.includes("dark:text-ink-dark") && c.includes("font-display-semibold"))).toBe(true);
  });

  it("FamilyScreen: root + title carry dark tokens", async () => {
    mockedUseHouseholdMe.mockReturnValue({
      data: { id: "h1", name: "House", members: [{ userId: "u1", email: "a@b.com", role: "OWNER" as const }] },
      isLoading: false,
      isError: false,
      isRefetching: false,
      refetch: jest.fn(),
    });
    mockedUseCreateInvite.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    mockedUseLeaveHousehold.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });

    const { toJSON } = await render(<FamilyScreen />);

    const classNames = collectClassNames(toJSON());
    expect(classNames.some((c) => c.includes("dark:bg-surface-page-dark"))).toBe(true);
    const title = screen.getByText("Family");
    expect(title.props.className).toContain("dark:text-ink-dark");
  });

  it("SettingsScreen: root + settings-services row carry dark tokens", async () => {
    const { toJSON } = await render(<SettingsScreen />);

    const classNames = collectClassNames(toJSON());
    expect(classNames.some((c) => c.includes("dark:bg-surface-page-dark"))).toBe(true);
    const servicesRow = findByTestId(toJSON(), "settings-services");
    expect(collectClassNames(servicesRow).some((c) => c.includes("dark:text-ink-dark"))).toBe(true);
  });

  it("SettingsScreen: the billing-pinned settings-family-note row carries dark tokens", async () => {
    mockedUseEntitlement.mockReturnValue({ data: { entitled: true, source: "family", billingIssue: false } });

    const { toJSON } = await render(<SettingsScreen />);

    const note = findByTestId(toJSON(), "settings-family-note");
    expect(note?.props.className).toContain("dark:bg-surface-raised-dark");
  });

  it("UpsellSheet: sheet root carries dark tokens", async () => {
    mockedUseUpsellStore.mockImplementation(
      (selector: (state: { visible: boolean; hide: () => void }) => unknown) =>
        selector({ visible: true, hide: jest.fn() }),
    );

    const { toJSON } = await render(<UpsellSheet />);

    const sheet = findByTestId(toJSON(), "upsell-sheet");
    expect(sheet?.props.className).toContain("dark:bg-surface-card-dark");
  });

  it("ComingSoonScreen: root + title carry dark tokens", async () => {
    const { toJSON } = await render(<ComingSoonScreen />);

    const root = findByTestId(toJSON(), "coming-soon-screen");
    expect(root?.props.className).toContain("dark:bg-surface-page-dark");
    const classNames = collectClassNames(root);
    expect(classNames.some((c) => c.includes("dark:text-ink-dark") && c.includes("font-display-semibold"))).toBe(true);
  });
});

describe("sweep-remaining-theme: decision 4 frozen semantic fills carry NO dark:", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("BillingIssueBanner (Settings) carries no dark: token -- frozen amber fill", async () => {
    // The paywall's four notice fills (pending/error/restoreNone/success) are
    // conditionally rendered and already directly asserted byte-identical by
    // the re-recorded `paywall-snapshot.test.tsx` + the source diff in the
    // final report; `BillingIssueBanner` is the other decision-4 frozen fill
    // and is deterministically renderable here via `useEntitlement`.
    mockedUseEntitlement.mockReturnValue({ data: { entitled: true, source: "own", billingIssue: true } });

    const { toJSON } = await render(<SettingsScreen />);

    const banner = findByTestId(toJSON(), "billing-issue-banner");
    expect(banner).not.toBeNull();
    const classNames = collectClassNames(banner);
    for (const className of classNames) {
      expect(className).not.toContain("dark:");
    }
  });
});

describe("sweep-remaining-theme: record-only tone (§7)", () => {
  it("PaywallScreen renders no 'diagnos' substring", async () => {
    mockedUseEntitlement.mockReturnValue({ data: undefined });

    const { toJSON } = await render(<PaywallScreen />);

    expect(JSON.stringify(toJSON())).not.toMatch(/diagnos/i);
  });
});
