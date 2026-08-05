import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import * as useUpdateFlowModule from "../src/hooks/use-update-flow";
import { UpdateReadyPrompt } from "../src/components/update-ready-prompt";
import type { UpdatesUpdateApi } from "../src/ota/update-controller";
import { strings } from "../src/strings";

/**
 * T114 (checker Finding 2, HIGH): `update-ready-prompt.tsx` had no test file
 * at all, so a component-level regression (or the component being ripped
 * out of `_layout.tsx` entirely) could ship with every gate green. Mirrors
 * `beta-banner.test.tsx`'s sibling idiom: most cases mock `useUpdateFlow`
 * directly (`jest.spyOn` on the module namespace, matching
 * `timeline-screen.test.tsx`'s local-module-spy precedent) so the component
 * is tested in isolation from the hook's async/AppState machinery. The
 * final case deliberately does NOT mock the hook -- it drives the REAL
 * `useUpdateFlow` with a critical loader while `expo-router`'s segments are
 * a protected route, so this test also fails if either the COMPONENT's
 * `if (!promptVisible) return null;` gate (checker mutation M4) or the
 * HOOK's `!deferred` gate were ever deleted.
 */
let mockSegments: (string | undefined)[] = ["(tabs)"];

jest.mock("expo-router", () => ({
  useSegments: () => mockSegments,
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 12, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("../src/config/app-config-queries", () => ({
  useAppConfig: () => ({ data: { criticalOtaVersion: null } }),
}));

function criticalLoader(): () => UpdatesUpdateApi {
  const api: UpdatesUpdateApi = {
    isEnabled: true,
    checkForUpdateAsync: jest.fn(async () => ({ isAvailable: true })),
    fetchUpdateAsync: jest.fn(async () => ({
      isNew: true,
      manifest: { extra: { updateMessage: "hotfix [critical]" } },
    })),
    reloadAsync: jest.fn(async () => undefined),
  };
  return () => api;
}

describe("UpdateReadyPrompt (mocked useUpdateFlow)", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    mockSegments = ["(tabs)"];
  });

  it("renders nothing when promptVisible is false", async () => {
    jest.spyOn(useUpdateFlowModule, "useUpdateFlow").mockReturnValue({
      promptVisible: false,
      restart: jest.fn(),
      dismiss: jest.fn(),
    });

    await render(<UpdateReadyPrompt />);

    expect(screen.queryByTestId("update-ready-prompt")).toBeNull();
  });

  it("renders nothing when a critical update is ready but the flow is deferred (§3 render-time enforcement)", async () => {
    // This mock represents exactly that state: a critical update WAS found
    // (restart/dismiss are real, callable functions) but the hook computed
    // `promptVisible: false` because the current flow is deferred. The
    // component must still render nothing -- proving the render-time gate
    // does not merely react to "no update", it reacts to `promptVisible`.
    const restart = jest.fn();
    const dismiss = jest.fn();
    jest.spyOn(useUpdateFlowModule, "useUpdateFlow").mockReturnValue({
      promptVisible: false,
      restart,
      dismiss,
    });

    await render(<UpdateReadyPrompt />);

    expect(screen.queryByTestId("update-ready-prompt")).toBeNull();
    expect(restart).not.toHaveBeenCalled();
    expect(dismiss).not.toHaveBeenCalled();
  });

  it("renders the banner with externalized strings and an alert a11y role when promptVisible is true", async () => {
    jest.spyOn(useUpdateFlowModule, "useUpdateFlow").mockReturnValue({
      promptVisible: true,
      restart: jest.fn(),
      dismiss: jest.fn(),
    });

    await render(<UpdateReadyPrompt />);

    const banner = screen.getByTestId("update-ready-prompt");
    expect(banner.props.accessibilityRole).toBe("alert");
    expect(banner.props.accessibilityLabel).toBe(strings.updateReady.a11yLabel);
    expect(screen.getByText(strings.updateReady.title)).toBeTruthy();
    expect(screen.getByText(strings.updateReady.body)).toBeTruthy();
    expect(screen.getByText(strings.updateReady.restartCta)).toBeTruthy();
    expect(screen.getByText(strings.updateReady.laterCta)).toBeTruthy();
  });

  it("pressing Restart now calls restart() exactly once", async () => {
    const restart = jest.fn();
    jest.spyOn(useUpdateFlowModule, "useUpdateFlow").mockReturnValue({
      promptVisible: true,
      restart,
      dismiss: jest.fn(),
    });

    await render(<UpdateReadyPrompt />);

    fireEvent.press(screen.getByTestId("update-ready-prompt-restart"));

    expect(restart).toHaveBeenCalledTimes(1);
  });

  it("pressing Later calls dismiss() exactly once", async () => {
    const dismiss = jest.fn();
    jest.spyOn(useUpdateFlowModule, "useUpdateFlow").mockReturnValue({
      promptVisible: true,
      restart: jest.fn(),
      dismiss,
    });

    await render(<UpdateReadyPrompt />);

    fireEvent.press(screen.getByTestId("update-ready-prompt-later"));

    expect(dismiss).toHaveBeenCalledTimes(1);
  });
});

describe("UpdateReadyPrompt (real useUpdateFlow, end-to-end deferral proof)", () => {
  afterEach(() => {
    mockSegments = ["(tabs)"];
  });

  it("never renders over the Emergency interstitial even with a real critical update ready", async () => {
    mockSegments = ["check", "emergency", "[checkId]"];
    const loader = criticalLoader();
    const api = loader();

    await render(<UpdateReadyPrompt loader={loader} />);

    // Let the real check/fetch/critical-decision cycle settle (the hook
    // WOULD set `pendingCritical: true` here) before asserting the banner
    // still never appears -- otherwise this would trivially pass just
    // because the async cycle hadn't resolved yet, regardless of whether
    // the deferral gate is intact.
    await waitFor(() => {
      expect(api.fetchUpdateAsync).toHaveBeenCalled();
    });

    expect(screen.queryByTestId("update-ready-prompt")).toBeNull();
  });
});
