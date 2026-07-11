import { createMMKV } from "react-native-mmkv";

import { buildCreatePetPayload, useAddPetStore } from "../src/pets/add-pet-store";

// Store + payload unit coverage (T024 plan §Tests): draft field setting, step
// nav, reset, `createdPetId` idempotency, and persist→rehydrate against the
// mocked MMKV storage adapter (`react-native-mmkv` is mocked globally in
// `jest.setup.ts` — a shared in-memory map stands in for the native module).
describe("useAddPetStore", () => {
  beforeEach(() => {
    useAddPetStore.getState().reset();
  });

  describe("draft field setting", () => {
    it("updates individual draft fields via setField without touching others", () => {
      useAddPetStore.getState().setField("species", "DOG");
      useAddPetStore.getState().setField("name", "Rex");
      useAddPetStore.getState().setField("breedSlug", "labrador");
      useAddPetStore.getState().setField("breedName", "Labrador");
      useAddPetStore.getState().setField("sex", "MALE");
      useAddPetStore.getState().setField("neutered", true);
      useAddPetStore.getState().setField("birthDate", "2022-05-01");
      useAddPetStore.getState().setField("weightGrams", 12000);
      useAddPetStore.getState().setField("photoUri", "file:///out.jpg");

      expect(useAddPetStore.getState().draft).toEqual({
        species: "DOG",
        name: "Rex",
        breedSlug: "labrador",
        breedName: "Labrador",
        sex: "MALE",
        neutered: true,
        birthDate: "2022-05-01",
        ageEstimateMonths: null,
        weightGrams: 12000,
        photoUri: "file:///out.jpg",
        createdPetId: null,
      });
    });
  });

  describe("step navigation", () => {
    it("tracks the current step index via setStep", () => {
      expect(useAddPetStore.getState().stepIndex).toBe(0);

      useAddPetStore.getState().setStep(2);
      expect(useAddPetStore.getState().stepIndex).toBe(2);

      useAddPetStore.getState().setStep(4);
      expect(useAddPetStore.getState().stepIndex).toBe(4);
    });
  });

  describe("reset()", () => {
    it("restores the initial draft (incl. createdPetId) and stepIndex 0", () => {
      useAddPetStore.getState().setField("species", "DOG");
      useAddPetStore.getState().setField("name", "Rex");
      useAddPetStore.getState().setStep(3);
      useAddPetStore.getState().setCreatedPetId("pet-1");

      useAddPetStore.getState().reset();

      const state = useAddPetStore.getState();
      expect(state.stepIndex).toBe(0);
      expect(state.draft).toEqual({
        species: null,
        name: "",
        breedSlug: null,
        breedName: null,
        sex: null,
        neutered: null,
        birthDate: null,
        ageEstimateMonths: null,
        weightGrams: null,
        photoUri: null,
        createdPetId: null,
      });
    });
  });

  describe("createdPetId idempotency", () => {
    it("setCreatedPetId only touches createdPetId, leaving the rest of the draft intact", () => {
      useAddPetStore.getState().setField("species", "DOG");
      useAddPetStore.getState().setField("name", "Rex");

      useAddPetStore.getState().setCreatedPetId("pet-1");
      expect(useAddPetStore.getState().draft.createdPetId).toBe("pet-1");
      expect(useAddPetStore.getState().draft.name).toBe("Rex");

      // A repeated call (e.g. a Retry that re-reads an already-set id) is a
      // no-op overwrite with the same id — the done screen is what actually
      // avoids re-invoking create, this just confirms the setter is safe to
      // call more than once.
      useAddPetStore.getState().setCreatedPetId("pet-1");
      expect(useAddPetStore.getState().draft.createdPetId).toBe("pet-1");
    });
  });

  describe("persist -> rehydrate", () => {
    it("resumes a persisted draft after a simulated app restart", async () => {
      useAddPetStore.getState().setField("species", "DOG");
      useAddPetStore.getState().setField("name", "Rex");

      const mmkv = createMMKV();
      const persistedRaw = mmkv.getString("pawcareright.add-pet-draft");
      expect(persistedRaw).toBeTruthy();
      expect(persistedRaw).toContain("Rex");

      // Change the in-memory draft within this "session" (this also
      // persists — restored below before rehydrating, to simulate the app
      // being force-killed before that later change was ever read back).
      useAddPetStore.getState().setField("name", "Changed-in-memory");
      expect(useAddPetStore.getState().draft.name).toBe("Changed-in-memory");

      // Simulate relaunch: storage still holds the earlier "Rex" snapshot.
      mmkv.set("pawcareright.add-pet-draft", persistedRaw as string);
      await useAddPetStore.persist.rehydrate();

      const state = useAddPetStore.getState();
      expect(state.draft.name).toBe("Rex");
      expect(state.draft.species).toBe("DOG");
    });
  });
});

describe("buildCreatePetPayload", () => {
  const baseDraft = {
    species: null,
    name: "",
    breedSlug: null,
    breedName: null,
    sex: null,
    neutered: null,
    birthDate: null,
    ageEstimateMonths: null,
    weightGrams: null,
    photoUri: null,
    createdPetId: null,
  } as const;

  it("builds the minimal {species,name} payload with no extra keys", () => {
    const payload = buildCreatePetPayload({ ...baseDraft, species: "DOG", name: "Rex" });

    expect(payload).toEqual({ species: "DOG", name: "Rex" });
  });

  it("includes ageEstimateMonths and omits birthDate when only age is set", () => {
    const payload = buildCreatePetPayload({
      ...baseDraft,
      species: "CAT",
      name: "Whiskers",
      ageEstimateMonths: 6,
    });

    expect(payload).toEqual({ species: "CAT", name: "Whiskers", ageEstimateMonths: 6 });
    expect(payload.birthDate).toBeUndefined();
  });

  it("throws (server-mirrored XOR guard) when both birthDate and ageEstimateMonths are set", () => {
    expect(() =>
      buildCreatePetPayload({
        ...baseDraft,
        species: "DOG",
        name: "Rex",
        birthDate: "2022-05-01",
        ageEstimateMonths: 6,
      }),
    ).toThrow();
  });
});
