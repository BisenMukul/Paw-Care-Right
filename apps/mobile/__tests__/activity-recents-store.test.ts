import { createMMKV } from "react-native-mmkv";
import { renderHook } from "@testing-library/react-native";

import { useActivityRecents, useActivityRecentsStore } from "../src/health-logs/activity-recents-store";

describe("useActivityRecentsStore", () => {
  beforeEach(() => {
    useActivityRecentsStore.setState({ byPet: {} });
  });

  it("addRecent prepends a new combo, newest first", () => {
    useActivityRecentsStore.getState().addRecent("pet1", { activityType: "FOOD", quantity: 1, unit: "meals" });
    useActivityRecentsStore.getState().addRecent("pet1", { activityType: "WALK", quantity: 20, unit: "min" });

    expect(useActivityRecentsStore.getState().byPet.pet1).toEqual([
      { activityType: "WALK", quantity: 20, unit: "min" },
      { activityType: "FOOD", quantity: 1, unit: "meals" },
    ]);
  });

  it("dedupes an exact-combo repeat by moving it to the front rather than double-listing", () => {
    useActivityRecentsStore.getState().addRecent("pet1", { activityType: "FOOD", quantity: 1, unit: "meals" });
    useActivityRecentsStore.getState().addRecent("pet1", { activityType: "WALK", quantity: 20, unit: "min" });
    useActivityRecentsStore.getState().addRecent("pet1", { activityType: "FOOD", quantity: 1, unit: "meals" });

    const recents = useActivityRecentsStore.getState().byPet.pet1 ?? [];
    expect(recents).toHaveLength(2);
    expect(recents[0]).toEqual({ activityType: "FOOD", quantity: 1, unit: "meals" });
  });

  it("a different quantity/unit for the same activityType is a DISTINCT combo, not deduped", () => {
    useActivityRecentsStore.getState().addRecent("pet1", { activityType: "FOOD", quantity: 1, unit: "meals" });
    useActivityRecentsStore.getState().addRecent("pet1", { activityType: "FOOD", quantity: 2, unit: "meals" });

    expect(useActivityRecentsStore.getState().byPet.pet1).toHaveLength(2);
  });

  it("caps a pet's recents at 3, dropping the oldest", () => {
    useActivityRecentsStore.getState().addRecent("pet1", { activityType: "FOOD", quantity: 1, unit: "meals" });
    useActivityRecentsStore.getState().addRecent("pet1", { activityType: "WATER", quantity: 1, unit: "bowls" });
    useActivityRecentsStore.getState().addRecent("pet1", { activityType: "WALK", quantity: 20, unit: "min" });
    useActivityRecentsStore.getState().addRecent("pet1", { activityType: "PLAY", quantity: 15, unit: "min" });

    const recents = useActivityRecentsStore.getState().byPet.pet1 ?? [];
    expect(recents).toHaveLength(3);
    expect(recents.map((entry) => entry.activityType)).toEqual(["PLAY", "WALK", "WATER"]);
  });

  it("keeps different pets' recents independent", () => {
    useActivityRecentsStore.getState().addRecent("pet1", { activityType: "FOOD", quantity: 1, unit: "meals" });
    useActivityRecentsStore.getState().addRecent("pet2", { activityType: "WALK", quantity: 20, unit: "min" });

    expect(useActivityRecentsStore.getState().byPet.pet1).toHaveLength(1);
    expect(useActivityRecentsStore.getState().byPet.pet2).toHaveLength(1);
  });

  it("persists across a simulated reload (safe-storage/MMKV pattern)", async () => {
    useActivityRecentsStore.getState().addRecent("pet1", { activityType: "GROOMING", unit: "brush" });

    const mmkv = createMMKV();
    const persistedRaw = mmkv.getString("pawcareright.activity-recents");
    expect(persistedRaw).toBeTruthy();
    expect(persistedRaw).toContain("GROOMING");

    useActivityRecentsStore.setState({ byPet: {} });
    expect(useActivityRecentsStore.getState().byPet.pet1).toBeUndefined();

    mmkv.set("pawcareright.activity-recents", persistedRaw as string);
    await useActivityRecentsStore.persist.rehydrate();

    expect(useActivityRecentsStore.getState().byPet.pet1).toEqual([{ activityType: "GROOMING", unit: "brush" }]);
  });
});

describe("useActivityRecents", () => {
  beforeEach(() => {
    useActivityRecentsStore.setState({ byPet: {} });
  });

  it("returns [] for a pet with no recents yet", async () => {
    const { result } = await renderHook(() => useActivityRecents("pet1"));
    expect(result.current).toEqual([]);
  });

  it("returns the pet's recents", async () => {
    useActivityRecentsStore.getState().addRecent("pet1", { activityType: "FOOD", quantity: 1, unit: "meals" });
    const { result } = await renderHook(() => useActivityRecents("pet1"));
    expect(result.current).toEqual([{ activityType: "FOOD", quantity: 1, unit: "meals" }]);
  });
});
