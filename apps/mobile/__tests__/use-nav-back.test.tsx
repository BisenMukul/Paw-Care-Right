import { renderHook } from "@testing-library/react-native";

import { useNavBack } from "../src/hooks/use-nav-back";

/**
 * FOUNDER-UX-3 plan AC2: `useNavBack` prefers real history (`router.back()`)
 * and only falls back to `router.replace(fallback)` when `canGoBack()` is
 * false (the deep-link-entry case).
 */
const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    back: mockBack,
    replace: mockReplace,
    canGoBack: mockCanGoBack,
  }),
}));

describe("useNavBack", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("[AC2] canGoBack() true: calls router.back(), never replace", async () => {
    mockCanGoBack.mockReturnValue(true);
    const { result } = await renderHook(() => useNavBack("/(tabs)"));

    result.current();

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("[AC2] canGoBack() false: calls router.replace(fallback), never back", async () => {
    mockCanGoBack.mockReturnValue(false);
    const { result } = await renderHook(() => useNavBack("/(tabs)/settings"));

    result.current();

    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/settings");
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("[AC2] canGoBack() false with no fallback supplied: replaces to the /(tabs) default", async () => {
    mockCanGoBack.mockReturnValue(false);
    const { result } = await renderHook(() => useNavBack());

    result.current();

    expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
  });
});
