import * as SecureStore from "expo-secure-store";

import { authApi } from "../src/api/auth-api";
import { useAuthStore } from "../src/auth/auth-store";

// AC4 (automated stand-in for the cold-start auto-login manual device
// script, see plan) + the store's state-machine contract. `expo-secure-store`
// is mocked globally (in-memory map, `jest.setup.ts`); `authApi` calls are
// mocked per-test so no real `fetch`/network is involved.
jest.mock("../src/api/auth-api", () => ({
  authApi: {
    requestOtp: jest.fn(),
    verifyOtp: jest.fn(),
    social: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
  },
}));

const mockedAuthApi = authApi as unknown as {
  requestOtp: jest.Mock;
  verifyOtp: jest.Mock;
  social: jest.Mock;
  refresh: jest.Mock;
  logout: jest.Mock;
};

const tokens = {
  accessToken: "access-1",
  refreshToken: "refresh-1",
  user: { id: "user-1", email: "a@b.com" },
  householdId: "household-1",
};

function resetStore() {
  useAuthStore.setState({
    status: "restoring",
    user: null,
    householdId: null,
    accessToken: null,
    pushAsked: false,
  });
}

describe("useAuthStore", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await SecureStore.deleteItemAsync("pawcareright.auth.accessToken");
    await SecureStore.deleteItemAsync("pawcareright.auth.refreshToken");
    resetStore();
  });

  describe("restore()", () => {
    it("ends signedOut when no refresh token is stored (cold start, never signed in)", async () => {
      await useAuthStore.getState().restore();

      expect(useAuthStore.getState().status).toBe("signedOut");
      expect(mockedAuthApi.refresh).not.toHaveBeenCalled();
    });

    it("ends signedIn and re-persists tokens when the stored refresh token refreshes successfully", async () => {
      await SecureStore.setItemAsync("pawcareright.auth.refreshToken", "stale-refresh");
      mockedAuthApi.refresh.mockResolvedValue(tokens);

      await useAuthStore.getState().restore();

      const state = useAuthStore.getState();
      expect(state.status).toBe("signedIn");
      expect(state.user).toEqual(tokens.user);
      expect(state.householdId).toBe(tokens.householdId);
      expect(state.accessToken).toBe(tokens.accessToken);
      expect(mockedAuthApi.refresh).toHaveBeenCalledWith("stale-refresh");

      expect(await SecureStore.getItemAsync("pawcareright.auth.accessToken")).toBe(
        tokens.accessToken,
      );
      expect(await SecureStore.getItemAsync("pawcareright.auth.refreshToken")).toBe(
        tokens.refreshToken,
      );
    });

    it("ends signedOut and clears SecureStore when the stored refresh token fails to refresh", async () => {
      await SecureStore.setItemAsync("pawcareright.auth.refreshToken", "expired-refresh");
      await SecureStore.setItemAsync("pawcareright.auth.accessToken", "stale-access");
      mockedAuthApi.refresh.mockRejectedValue(new Error("expired"));

      await useAuthStore.getState().restore();

      const state = useAuthStore.getState();
      expect(state.status).toBe("signedOut");
      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();
      expect(await SecureStore.getItemAsync("pawcareright.auth.accessToken")).toBeNull();
      expect(await SecureStore.getItemAsync("pawcareright.auth.refreshToken")).toBeNull();
    });
  });

  describe("verifyOtp()", () => {
    it("saves tokens and transitions to signedIn on success", async () => {
      mockedAuthApi.verifyOtp.mockResolvedValue(tokens);

      await useAuthStore.getState().verifyOtp("a@b.com", "123456");

      const state = useAuthStore.getState();
      expect(state.status).toBe("signedIn");
      expect(state.user).toEqual(tokens.user);
      expect(state.accessToken).toBe(tokens.accessToken);
      expect(await SecureStore.getItemAsync("pawcareright.auth.accessToken")).toBe(
        tokens.accessToken,
      );
      expect(await SecureStore.getItemAsync("pawcareright.auth.refreshToken")).toBe(
        tokens.refreshToken,
      );
    });

    it("propagates the error and stays signedOut on failure", async () => {
      mockedAuthApi.verifyOtp.mockRejectedValue(new Error("bad code"));

      await expect(useAuthStore.getState().verifyOtp("a@b.com", "000000")).rejects.toThrow(
        "bad code",
      );
      expect(useAuthStore.getState().status).toBe("restoring");
    });
  });

  describe("refreshSession()", () => {
    it("persists tokens, sets signedIn, and returns the access token on success", async () => {
      await SecureStore.setItemAsync("pawcareright.auth.refreshToken", "stale-refresh");
      mockedAuthApi.refresh.mockResolvedValue(tokens);

      const result = await useAuthStore.getState().refreshSession();

      expect(result).toBe(tokens.accessToken);
      const state = useAuthStore.getState();
      expect(state.status).toBe("signedIn");
      expect(state.user).toEqual(tokens.user);
      expect(state.accessToken).toBe(tokens.accessToken);
      expect(await SecureStore.getItemAsync("pawcareright.auth.accessToken")).toBe(
        tokens.accessToken,
      );
      expect(await SecureStore.getItemAsync("pawcareright.auth.refreshToken")).toBe(
        tokens.refreshToken,
      );
    });

    it("returns null and leaves state untouched on failure", async () => {
      await SecureStore.setItemAsync("pawcareright.auth.refreshToken", "expired-refresh");
      mockedAuthApi.refresh.mockRejectedValue(new Error("expired"));
      useAuthStore.setState({
        status: "signedIn",
        user: tokens.user,
        householdId: tokens.householdId,
        accessToken: "still-here",
      });

      const result = await useAuthStore.getState().refreshSession();

      expect(result).toBeNull();
      const state = useAuthStore.getState();
      expect(state.status).toBe("signedIn");
      expect(state.accessToken).toBe("still-here");
      expect(await SecureStore.getItemAsync("pawcareright.auth.refreshToken")).toBe(
        "expired-refresh",
      );
    });

    it("returns null without calling authApi.refresh when no refresh token is stored", async () => {
      const result = await useAuthStore.getState().refreshSession();

      expect(result).toBeNull();
      expect(mockedAuthApi.refresh).not.toHaveBeenCalled();
    });
  });

  describe("sessionExpired()", () => {
    it("clears SecureStore and sets signedOut without calling logout", async () => {
      await SecureStore.setItemAsync("pawcareright.auth.refreshToken", "refresh-1");
      await SecureStore.setItemAsync("pawcareright.auth.accessToken", "access-1");
      useAuthStore.setState({ status: "signedIn", accessToken: "access-1" });

      await useAuthStore.getState().sessionExpired();

      const state = useAuthStore.getState();
      expect(state.status).toBe("signedOut");
      expect(state.user).toBeNull();
      expect(state.householdId).toBeNull();
      expect(state.accessToken).toBeNull();
      expect(await SecureStore.getItemAsync("pawcareright.auth.refreshToken")).toBeNull();
      expect(await SecureStore.getItemAsync("pawcareright.auth.accessToken")).toBeNull();
      expect(mockedAuthApi.logout).not.toHaveBeenCalled();
    });
  });

  describe("socialSignIn()", () => {
    it("saves tokens and transitions to signedIn", async () => {
      mockedAuthApi.social.mockResolvedValue(tokens);

      await useAuthStore.getState().socialSignIn("apple", "identity-token");

      expect(mockedAuthApi.social).toHaveBeenCalledWith("apple", "identity-token");
      expect(useAuthStore.getState().status).toBe("signedIn");
      expect(useAuthStore.getState().user).toEqual(tokens.user);
    });
  });

  describe("signOut()", () => {
    it("clears SecureStore and resets to signedOut even when logout fails", async () => {
      await SecureStore.setItemAsync("pawcareright.auth.refreshToken", "refresh-1");
      mockedAuthApi.logout.mockRejectedValue(new Error("network down"));
      useAuthStore.setState({ status: "signedIn", accessToken: "access-1" });

      await useAuthStore.getState().signOut();

      const state = useAuthStore.getState();
      expect(state.status).toBe("signedOut");
      expect(state.accessToken).toBeNull();
      expect(state.pushAsked).toBe(false);
      expect(await SecureStore.getItemAsync("pawcareright.auth.refreshToken")).toBeNull();
    });
  });

  describe("markPushAsked()", () => {
    it("sets pushAsked to true", () => {
      useAuthStore.getState().markPushAsked();
      expect(useAuthStore.getState().pushAsked).toBe(true);
    });
  });
});
