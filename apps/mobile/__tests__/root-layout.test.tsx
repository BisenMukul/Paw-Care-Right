import { render, screen, waitFor } from "@testing-library/react-native";
import React from "react";

import RootLayout from "../app/_layout";

/**
 * Founder-hotfix regression pins for the app entry:
 *  (a) the restoring splash renders inside ONE provider tree,
 *  (b) the error boundary is OUTERMOST -- even the query provider throwing
 *      must render the readable fallback instead of a blank screen/crash,
 *  (c) a signed-out launch renders the router stack (no throw on the
 *      happy path).
 * Navigation, side-effect hooks, and the gate are mocked so the test
 * exercises the layout's own structure only.
 */

const mockReplace = jest.fn();

// The real PersistQueryClientProvider gates children on an async cache
// restore; these tests pin the layout STRUCTURE, so it becomes a labeled
// passthrough. Test (b) below flips `mockProviderThrows` to prove the
// boundary sits OUTSIDE the provider.
let mockProviderThrows = false;

jest.mock("@pawcareright/api-client", () => {
  const actual = jest.requireActual("@pawcareright/api-client");
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    ...actual,
    PersistedApiQueryProvider: ({ children }: { children?: React.ReactNode }) => {
      if (mockProviderThrows) {
        throw new Error("provider boom");
      }
      return <View testID="query-provider">{children}</View>;
    },
  };
});

// SafeAreaProvider renders nothing in jest until native insets arrive;
// stub it as a passthrough so children mount synchronously.
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

let mockStatus: "restoring" | "signedOut" | "signedIn" = "restoring";
const mockRestore = jest.fn();

jest.mock("../src/auth/auth-store", () => {
  const useAuthStore = (selector: (state: { status: string }) => unknown) => selector({ status: mockStatus });
  useAuthStore.getState = () => ({ status: mockStatus, restore: mockRestore });
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

describe("root layout startup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStatus = "restoring";
  });

  it("renders the auth splash while restoring, inside a single tree", async () => {
    render(<RootLayout />);

    await waitFor(() => {
      expect(screen.getByTestId("auth-splash")).toBeTruthy();
    });
    expect(mockRestore).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("router-stack")).toBeNull();
  });

  it("renders the router stack once signed out (happy startup path)", async () => {
    mockStatus = "signedOut";
    render(<RootLayout />);

    await waitFor(() => {
      expect(screen.getByTestId("router-stack")).toBeTruthy();
    });
    expect(screen.getByTestId("update-gate")).toBeTruthy();
  });

  it("shows the readable error fallback even when the QUERY PROVIDER itself throws (boundary is outermost)", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockProviderThrows = true;
    try {
      render(<RootLayout />);

      await waitFor(() => {
        expect(screen.getByText("App failed to start")).toBeTruthy();
      });
      expect(screen.getByText("provider boom")).toBeTruthy();
    } finally {
      mockProviderThrows = false;
    }
  });

});
