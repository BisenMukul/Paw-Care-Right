import * as Haptics from "expo-haptics";

import { haptics } from "../src/haptics";

/**
 * Founder-crash regression pin: on a dev client built BEFORE expo-haptics
 * was a dependency, the SDK REJECTS with UnavailabilityError ("Haptic
 * .impactAsync is not available on android"). The wrapper must swallow
 * both sync throws and promise rejections -- an "Uncaught (in promise)"
 * from a nice-to-have haptic is a defect.
 */

const mockImpact = Haptics.impactAsync as jest.Mock;
const mockNotification = Haptics.notificationAsync as jest.Mock;

describe("haptics wrapper", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("selection() fires a light impact", () => {
    haptics.selection();
    expect(mockImpact).toHaveBeenCalledWith("light");
  });

  it("success() fires a success notification", () => {
    haptics.success();
    expect(mockNotification).toHaveBeenCalledWith("success");
  });

  it("swallows a PROMISE REJECTION from an unavailable native module (founder crash)", async () => {
    mockImpact.mockRejectedValueOnce(new Error("Haptic.impactAsync is not available on android"));
    mockNotification.mockRejectedValueOnce(new Error("Haptic.notificationAsync is not available on android"));

    expect(() => haptics.selection()).not.toThrow();
    expect(() => haptics.success()).not.toThrow();

    // Flush microtasks: an unhandled rejection here would fail the test run.
    await new Promise<void>((resolve) => setImmediate(() => resolve()));
  });

  it("swallows a SYNC throw from the module", () => {
    mockImpact.mockImplementationOnce(() => {
      throw new Error("sync unavailability");
    });

    expect(() => haptics.selection()).not.toThrow();
  });
});
