import { createSafeStorage } from "./safe-storage";

describe("createSafeStorage", () => {
  it("falls back to an in-memory store when MMKV is unavailable", () => {
    const storage = createSafeStorage({
      createMmkv: () => {
        throw new Error("native module unavailable");
      },
    });

    storage.setItem("pet", "mia");

    expect(storage.getItem("pet")).toBe("mia");

    storage.removeItem("pet");

    expect(storage.getItem("pet")).toBeNull();
  });
});
