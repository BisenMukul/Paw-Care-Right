/**
 * T118 step 14 (T117 review Finding 3 fold-in): `use-push-registration.ts`
 * is NOT modified here -- this pins its CURRENT `POST /v1/devices` payload
 * shape so a future accidental field addition (T117 review's mutation C,
 * e.g. a stray `ownerEmail`) is caught immediately. The exact key set is
 * asserted via `Object.keys(body).sort()` rather than a loose
 * `expect.objectContaining`, because `objectContaining` would NOT catch an
 * extra property -- only a missing one.
 *
 * `apiClient` (`../src/api/client`) is mocked exactly like `checks-api.test.ts`
 * (`jest.mock("../src/api/client", ...)`). `expo-notifications` (granted
 * permission + `ExponentPushToken[test-token]`) and `expo-updates`
 * (`updateId: null` by default) come from the GLOBAL mocks in
 * `jest.setup.ts` -- they are not re-declared here except where a case
 * needs the OTA-update-id branch (see the `expo-updates` mutation below).
 *
 * `expo-constants` has NO global mock, and `usePushRegistration` returns
 * `"error"` early when `Constants.expoConfig.extra.eas.projectId` is
 * `undefined` -- so this file supplies its own minimal per-file mock.
 */
jest.mock("../src/api/client", () => ({
  apiClient: { post: jest.fn() },
}));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: "test-project-id" } } } },
}));

import { Platform } from "react-native";

import { apiClient } from "../src/api/client";
import { getAppVersion } from "../src/config";
import { usePushRegistration } from "../src/push/use-push-registration";

const mockedPost = apiClient.post as jest.Mock;

describe("usePushRegistration() payload shape (T117 F3 / T118 fold-in)", () => {
  beforeEach(() => {
    mockedPost.mockClear();
    mockedPost.mockResolvedValue(undefined);
  });

  afterEach(() => {
    // Restore the `expo-updates` global mock's `updateId` field to its
    // jest.setup.ts default so no later test (in this file or, since this
    // mutates the shared module-mock object, any test importing the same
    // mock instance within this run) inherits a leaked non-null value.
    const updates = jest.requireMock("expo-updates") as { updateId: string | null };
    updates.updateId = null;
  });

  // `usePushRegistration()` contains no React hook call (no `useState`,
  // `useEffect`, etc. -- it is a plain function returning a `register`
  // closure), so calling it directly and awaiting `.register()` outside of
  // a renderer is NOT a rules-of-hooks violation; it is exactly how a
  // caller (`push-rationale.tsx`) uses it.
  it("posts exactly {expoPushToken, platform, appVersion} on an embedded launch", async () => {
    const result = await usePushRegistration().register();

    expect(result).toBe("granted");
    expect(mockedPost).toHaveBeenCalledTimes(1);
    const [url, body] = mockedPost.mock.calls[0] as [string, Record<string, unknown>];
    expect(url).toBe("/v1/devices");
    expect(Object.keys(body).sort()).toEqual(["appVersion", "expoPushToken", "platform"]);
    expect(body.expoPushToken).toBe("ExponentPushToken[test-token]");
    expect(body.platform).toBe(Platform.OS);
    expect(body.appVersion).toBe(getAppVersion());
  });

  it("includes otaUpdateId only when the OTA update id is non-null", async () => {
    // `readOtaInfo` lazily `require`s "expo-updates" at CALL time
    // (`src/observability/ota-info.ts`), so mutating the already-mocked
    // module object (rather than re-declaring `jest.mock` here) is picked
    // up on the next `register()` call.
    const updates = jest.requireMock("expo-updates") as { updateId: string | null };
    updates.updateId = "update-xyz";

    const result = await usePushRegistration().register();

    expect(result).toBe("granted");
    const [, body] = mockedPost.mock.calls[0] as [string, Record<string, unknown>];
    expect(Object.keys(body).sort()).toEqual(["appVersion", "expoPushToken", "otaUpdateId", "platform"]);
    expect(body.otaUpdateId).toBe("update-xyz");
  });

  // T117 review mutation C: adding `ownerEmail` (or any other extra field)
  // to the post body must flip this red. The exact-key-set assertion above
  // already does that; this restates it as its own named case per the T118
  // plan's proof map (T22), and names the server-side backstop that makes
  // this a *coverage* fix rather than a live vulnerability fix:
  // `apps/api/src/app.setup.ts`'s `ValidationPipe({ whitelist: true,
  // forbidNonWhitelisted: true })` already 400s the whole registration
  // request if an unlisted property is present.
  it("rejects any additional property in the registration payload (T117 F3 / mutation C)", async () => {
    await usePushRegistration().register();

    const [, body] = mockedPost.mock.calls[0] as [string, Record<string, unknown>];
    expect(Object.keys(body).sort()).toEqual(["appVersion", "expoPushToken", "platform"]);
    expect(body).not.toHaveProperty("ownerEmail");
  });
});
