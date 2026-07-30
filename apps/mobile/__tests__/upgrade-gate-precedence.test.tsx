import { render, screen, waitFor } from "@testing-library/react-native";
import { fireEvent } from "@testing-library/react-native";
import * as Linking from "expo-linking";
import React from "react";

import RootLayout from "../app/_layout";

/**
 * T115 AC3 — "blocking screen renders before any authenticated route (flow
 * test)". Scaffolding copied from `root-layout.test.tsx` (query-provider
 * passthrough, safe-area passthrough, `expo-router` `Stack` -> a
 * `testID="router-stack"` View, auth-store mock, side-effect hook mocks,
 * `update-ready-prompt` stub with a `testID`), but -- unlike that file --
 * `../src/components/update-gate` is NOT mocked here: the REAL `UpdateGate`
 * -> `useUpgradeState` -> `resolveUpgradeState` chain runs, and
 * `../src/config/app-config-queries` is mocked ONLY at `useAppConfig` (via
 * `jest.requireActual` passthrough for everything else, so `DEFAULT_APP_CONFIG`
 * stays real). This is the flow-level proof that `<UpdateGate>` structurally
 * wraps `<Stack>` -- a blocked launch renders NO route at all, authenticated
 * or otherwise, and no `<UpgradeRecommendedBanner/>`/`<UpdateReadyPrompt/>`
 * either (the gate returns EARLY instead of `children`, so nothing inside it
 * ever mounts -- see `update-gate.tsx`).
 */
const mockReplace = jest.fn();

jest.mock("@bombaypetcompany/api-client", () => {
  const actual = jest.requireActual("@bombaypetcompany/api-client");
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    ...actual,
    PersistedApiQueryProvider: ({ children }: { children?: React.ReactNode }) => (
      <View testID="query-provider">{children}</View>
    ),
  };
});

jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  // Unlike `root-layout.test.tsx`'s equivalent mock (which never renders the
  // REAL `<UpdateGate>`'s `<SafeAreaView testID="update-gate-screen">`),
  // this file exercises the real gate, so the passthrough must forward ALL
  // props -- not just `children` -- or `testID`/`className` are silently
  // dropped.
  const passthrough = (props: { children?: React.ReactNode }) => <View {...props} />;
  return {
    SafeAreaProvider: passthrough,
    SafeAreaView: passthrough,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock("expo-router", () => {
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  function Stack({ children }: { children?: React.ReactNode }) {
    return <View testID="router-stack">{children}</View>;
  }
  Stack.Screen = function Screen() {
    return null;
  };
  return {
    Stack,
    useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
    useSegments: () => [],
  };
});

const mockStatus = "signedIn" as const;
const mockRestore = jest.fn();

jest.mock("../src/auth/auth-store", () => {
  const useAuthStore = (selector: (state: { status: string }) => unknown) => selector({ status: mockStatus });
  useAuthStore.getState = () => ({ status: mockStatus, restore: mockRestore });
  return { useAuthStore };
});

jest.mock("../src/offline/use-network-listener", () => ({ useNetworkListener: jest.fn() }));
jest.mock("../src/offline/use-outbox-flush", () => ({ useOutboxFlush: jest.fn() }));
jest.mock("../src/billing/use-purchases-init", () => ({ usePurchasesInit: jest.fn() }));
// T107 mechanical consequence (see `root-layout.test.tsx`'s identical
// comment): `usePaywallExperimentAssignment` needs a real
// `QueryClientProvider`, which this suite's mocked passthrough provider does
// not supply -- stubbed like the other side-effect hooks, since this suite
// only pins the `<UpdateGate>` precedence behaviour.
jest.mock("../src/experiments/use-paywall-experiment-assignment", () => ({
  usePaywallExperimentAssignment: jest.fn(),
}));
jest.mock("../src/components/upsell-sheet", () => ({ UpsellSheet: () => null }));
jest.mock("../src/components/update-ready-prompt", () => {
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return { UpdateReadyPrompt: () => <View testID="update-ready-prompt-stub" /> };
});

jest.mock("expo-linking", () => ({
  openURL: jest.fn(),
}));

const mockOpenURL = Linking.openURL as jest.Mock;

// NOTE: `../src/components/update-gate` is DELIBERATELY not mocked -- this
// file's whole point is to exercise the real gate.
let mockConfig: Record<string, unknown> | undefined;

jest.mock("../src/config/app-config-queries", () => {
  const actual = jest.requireActual("../src/config/app-config-queries");
  return { ...actual, useAppConfig: () => ({ data: mockConfig }) };
});

describe("upgrade-gate precedence (T115 AC3)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConfig = undefined;
  });

  it("a signed-IN launch below minAppVersion renders the blocking screen and NO authenticated route", async () => {
    mockConfig = {
      minSupportedVersion: "0.0.0",
      minAppVersion: { ios: "99.0.0", android: "99.0.0" },
      recommendedAppVersion: { ios: "99.0.0", android: "99.0.0" },
    };

    render(<RootLayout />);

    await waitFor(() => {
      expect(screen.getByTestId("update-gate-screen")).toBeTruthy();
    });

    expect(screen.queryByTestId("router-stack")).toBeNull();
    expect(screen.queryByTestId("upgrade-recommended-banner")).toBeNull();
    expect(screen.queryByTestId("update-ready-prompt-stub")).toBeNull();
  });

  it("the blocking screen has no dismiss affordance in the real layout", async () => {
    mockConfig = {
      minSupportedVersion: "0.0.0",
      minAppVersion: { ios: "99.0.0", android: "99.0.0" },
      recommendedAppVersion: { ios: "99.0.0", android: "99.0.0" },
    };

    render(<RootLayout />);

    await waitFor(() => {
      expect(screen.getByTestId("update-gate-screen")).toBeTruthy();
    });

    await fireEvent.press(screen.getByTestId("update-gate-cta"));

    expect(mockOpenURL).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("update-gate-screen")).toBeTruthy();
    expect(screen.queryByTestId("router-stack")).toBeNull();
  });

  it("a signed-in launch at/above minAppVersion renders the router stack (case 1 is not vacuous)", async () => {
    mockConfig = {
      minSupportedVersion: "0.0.0",
      minAppVersion: { ios: "0.0.0", android: "0.0.0" },
      recommendedAppVersion: { ios: "0.0.0", android: "0.0.0" },
    };

    render(<RootLayout />);

    await waitFor(() => {
      expect(screen.getByTestId("router-stack")).toBeTruthy();
    });

    expect(screen.queryByTestId("update-gate-screen")).toBeNull();
  });
});
