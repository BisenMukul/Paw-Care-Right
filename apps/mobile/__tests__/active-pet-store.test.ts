import { createMMKV } from "react-native-mmkv";

import { useActivePetStore } from "../src/pets/active-pet-store";

// Store unit + MMKV persist→rehydrate coverage (T027 plan §Tests), mirroring
// `add-pet-store.test.ts`'s persist assertions against the shared in-memory
// MMKV mock (`jest.setup.ts`).
describe("useActivePetStore", () => {
  beforeEach(() => {
    useActivePetStore.getState().clear();
  });

  it("sets and reads the active pet id", () => {
    useActivePetStore.getState().setActivePet("pet-B");
    expect(useActivePetStore.getState().activePetId).toBe("pet-B");
  });

  it("clear() resets the active pet id to null", () => {
    useActivePetStore.getState().setActivePet("pet-B");
    useActivePetStore.getState().clear();
    expect(useActivePetStore.getState().activePetId).toBeNull();
  });

  it("persists the active pet across a simulated reload", async () => {
    useActivePetStore.getState().setActivePet("pet-B");

    const mmkv = createMMKV();
    const persistedRaw = mmkv.getString("pawcareright.active-pet");
    expect(persistedRaw).toBeTruthy();
    expect(persistedRaw).toContain("pet-B");

    // Change in-memory within this "session" (also persists — restored
    // below before rehydrating, simulating a force-kill before this later
    // change was ever read back).
    useActivePetStore.getState().setActivePet("pet-other");
    expect(useActivePetStore.getState().activePetId).toBe("pet-other");

    // Simulate relaunch: storage still holds the earlier "pet-B" snapshot.
    mmkv.set("pawcareright.active-pet", persistedRaw as string);
    await useActivePetStore.persist.rehydrate();

    expect(useActivePetStore.getState().activePetId).toBe("pet-B");
  });
});
