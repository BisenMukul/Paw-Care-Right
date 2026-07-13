import { render } from "@testing-library/react-native";

import CheckDeepLinkScreen from "../app/checks/[id]";

// T050 plan "Tests to write" -> check-deeplink-route.test.tsx. Asserts the
// `pawcareright://checks/:id` alias route redirects to the unchanged result
// screen carrying the id. Native scheme->route resolution (the
// `getInitialURL` mapping) is on-device behavior and is NOT exercised here —
// it is explicitly deferred (plan Risk 2); this test only covers the
// in-app `Redirect` this file renders once mounted with a param.
const mockRedirect = jest.fn((href: unknown) => {
  void href;
  return null;
});
const mockUseLocalSearchParams = jest.fn();

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockUseLocalSearchParams(),
  Redirect: (props: { href: unknown }) => mockRedirect(props.href),
}));

describe("checks/[id] deep-link alias", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("redirects to the result screen carrying the id", async () => {
    mockUseLocalSearchParams.mockReturnValue({ id: "c1" });

    await render(<CheckDeepLinkScreen />);

    expect(mockRedirect).toHaveBeenCalledWith({
      pathname: "/check/result/[checkId]",
      params: { checkId: "c1" },
    });
  });

  it("redirects home when the id param is missing", async () => {
    mockUseLocalSearchParams.mockReturnValue({ id: undefined });

    await render(<CheckDeepLinkScreen />);

    expect(mockRedirect).toHaveBeenCalledWith("/(tabs)");
  });
});
