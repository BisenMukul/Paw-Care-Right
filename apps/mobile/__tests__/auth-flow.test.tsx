import { ApiError } from "@pawcareright/api-client";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import EmailScreen from "../app/(auth)/email";
import OtpScreen from "../app/(auth)/otp";
import { useAuthStore } from "../src/auth/auth-store";

// AC2 — error states: (a) OTP screen wrong-code error, (b) email screen
// invalid-input state. Native modules are mocked globally in
// `jest.setup.ts`; here we mock `expo-router` (navigation) and the auth
// store's actions so the screens can be rendered/driven in isolation.
const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockParams: Record<string, string> = {};

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useLocalSearchParams: () => mockParams,
}));

jest.mock("../src/auth/auth-store", () => ({
  useAuthStore: jest.fn(),
}));

const mockedUseAuthStore = useAuthStore as unknown as jest.Mock;

describe("auth flow error states", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { email: "a@b.com" };
  });

  describe("otp screen", () => {
    it("shows the wrong-code error after a 401 ApiError and keeps the input usable", async () => {
      const verifyOtp = jest.fn().mockRejectedValue(
        new ApiError({
          code: "UNAUTHORIZED",
          message: "Invalid code",
          httpStatus: 401,
          requestId: null,
        }),
      );
      const requestOtp = jest.fn();
      mockedUseAuthStore.mockImplementation(
        (selector: (state: { verifyOtp: unknown; requestOtp: unknown }) => unknown) =>
          selector({ verifyOtp, requestOtp }),
      );

      await render(<OtpScreen />);

      const digits = ["1", "2", "3", "4", "5", "6"];
      for (const [index, digit] of digits.entries()) {
        await fireEvent.changeText(screen.getByTestId(`otp-input-cell-${index}`), digit);
      }

      await waitFor(() => {
        expect(screen.getByTestId("otp-error")).toBeTruthy();
      });

      expect(verifyOtp).toHaveBeenCalledWith("a@b.com", "123456");
      expect(screen.getByTestId("otp-input-cell-0")).toBeTruthy();
    });
  });

  describe("email screen", () => {
    it("shows an invalid-email error and does not call requestOtp for malformed input", async () => {
      const requestOtp = jest.fn();
      mockedUseAuthStore.mockImplementation(
        (selector: (state: { requestOtp: unknown }) => unknown) => selector({ requestOtp }),
      );

      await render(<EmailScreen />);

      await fireEvent.changeText(screen.getByTestId("email-input"), "not-an-email");
      await fireEvent.press(screen.getByTestId("email-submit"));

      expect(screen.getByTestId("email-error")).toBeTruthy();
      expect(requestOtp).not.toHaveBeenCalled();
    });

    it("calls requestOtp and navigates to the otp screen for a valid email", async () => {
      const requestOtp = jest.fn().mockResolvedValue(undefined);
      mockedUseAuthStore.mockImplementation(
        (selector: (state: { requestOtp: unknown }) => unknown) => selector({ requestOtp }),
      );

      await render(<EmailScreen />);

      await fireEvent.changeText(screen.getByTestId("email-input"), "valid@example.com");
      await fireEvent.press(screen.getByTestId("email-submit"));

      await waitFor(() => {
        expect(requestOtp).toHaveBeenCalledWith("valid@example.com");
      });
      expect(mockPush).toHaveBeenCalledWith({
        pathname: "/(auth)/otp",
        params: { email: "valid@example.com" },
      });
    });
  });
});
