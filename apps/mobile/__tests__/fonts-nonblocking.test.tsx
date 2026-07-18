import { render, screen, waitFor } from "@testing-library/react-native";
import React from "react";

import RootLayout from "../app/_layout";

/**
 * PAWSAATHI-1 plan: `useAppFonts()` (wrapping `expo-font`'s `useFonts`) is
 * called once in `RootLayout`, above the boundary tree, and its return
 * value is never read. This is the load-bearing evidence that a pending
 * font load AND a font-load error can NEVER block startup -- the app
 * renders exactly as it does today (the restoring splash, `auth-splash`)
 * either way. Mirrors `root-layout.test.tsx`'s mock setup so this test
 * exercises the SAME layout tree, just with `expo-font`'s `useFonts`
 * overridden per-case.
 */

const mockReplace = jest.fn();

jest.mock("@pawcareright/api-client", () => {
  const actual = jest.requireActual("@pawcareright/api-client");
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
  const passthrough = ({ children }: { children?: React.ReactNode }) => <View>{children}</View>;
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

jest.mock("../src/auth/auth-store", () => {
  const useAuthStore = (selector: (state: { status: string }) => unknown) =>
    selector({ status: "restoring" });
  useAuthStore.getState = () => ({ status: "restoring", restore: jest.fn() });
  return { useAuthStore };
});

jest.mock("../src/offline/use-network-listener", () => ({ useNetworkListener: jest.fn() }));
jest.mock("../src/billing/use-purchases-init", () => ({ usePurchasesInit: jest.fn() }));
jest.mock("../src/components/update-gate", () => {
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    UpdateGate: ({ children }: { children?: React.ReactNode }) => <View testID="update-gate">{children}</View>,
  };
});
jest.mock("../src/components/upsell-sheet", () => ({ UpsellSheet: () => null }));

const mockedUseFonts = jest.requireMock<{ useFonts: jest.Mock }>("expo-font").useFonts;

describe("fonts-nonblocking: a pending or failed font load never blocks startup", () => {
  afterEach(() => {
    mockedUseFonts.mockReturnValue([true, null]);
  });

  it("fonts pending ([false, null]): the app still renders (auth-splash)", async () => {
    mockedUseFonts.mockReturnValue([false, null]);

    render(<RootLayout />);

    await waitFor(() => {
      expect(screen.getByTestId("auth-splash")).toBeTruthy();
    });
  });

  it("fonts failed ([false, Error]): the app still renders (auth-splash), no throw", async () => {
    mockedUseFonts.mockReturnValue([false, new Error("font load failed")]);

    render(<RootLayout />);

    await waitFor(() => {
      expect(screen.getByTestId("auth-splash")).toBeTruthy();
    });
  });

  it("fonts loaded ([true, null]): the app still renders (auth-splash) -- the baseline", async () => {
    mockedUseFonts.mockReturnValue([true, null]);

    render(<RootLayout />);

    await waitFor(() => {
      expect(screen.getByTestId("auth-splash")).toBeTruthy();
    });
  });
});
