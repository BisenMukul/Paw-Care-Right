import { render, fireEvent, screen, waitFor } from "@testing-library/react-native";

import DoneScreen from "../app/add-pet/done";
import { useAddPetStore } from "../src/pets/add-pet-store";
import { strings } from "../src/strings";

// The wizard's skip-path AC (T024 plan §Tests): a draft seeded with only
// species+name must complete via exactly that create payload, and the
// create step must be idempotent under retry / re-run. `expo-router`,
// `@tanstack/react-query`'s `useQueryClient`, and the app-level pets-api
// module are mocked so the orchestration can be driven headless.
const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
}));

const mockInvalidateQueries = jest.fn();

jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

const mockMutateAsync = jest.fn();
const mockUploadPetPhoto = jest.fn();

jest.mock("../src/api/pets-api", () => ({
  petsKeys: { all: ["pets"] },
  useCreatePet: () => ({ mutateAsync: mockMutateAsync }),
  uploadPetPhoto: (petId: string, localUri: string) => mockUploadPetPhoto(petId, localUri),
}));

function seedMinimalDraft() {
  useAddPetStore.getState().reset();
  useAddPetStore.getState().setField("species", "DOG");
  useAddPetStore.getState().setField("name", "Rex");
}

describe("add-pet done screen (submit + progress orchestration)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    seedMinimalDraft();
  });

  it("[skip-path AC] completes with only {species,name}: exact create payload, no photo upload, invalidate + navigate", async () => {
    mockMutateAsync.mockResolvedValue({ id: "pet1" });

    await render(<DoneScreen />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalled();
    });

    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    expect(mockMutateAsync).toHaveBeenCalledWith({ species: "DOG", name: "Rex" });
    expect(mockUploadPetPhoto).not.toHaveBeenCalled();
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["pets"] });
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: "/pets/[id]",
      params: { id: "pet1", localPhoto: "" },
    });

    const state = useAddPetStore.getState();
    expect(state.draft.species).toBeNull();
    expect(state.draft.name).toBe("");
    expect(state.draft.createdPetId).toBeNull();
  });

  it("shows a retryable error on create failure and keeps the draft intact; retry is idempotent", async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error("network down"));

    await render(<DoneScreen />);

    await waitFor(() => {
      expect(screen.getByTestId("add-pet-error")).toBeTruthy();
    });
    expect(screen.getByText(strings.addPet.done.createError)).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();

    // Draft is untouched by the failed attempt.
    const afterError = useAddPetStore.getState();
    expect(afterError.draft.species).toBe("DOG");
    expect(afterError.draft.name).toBe("Rex");
    expect(afterError.draft.createdPetId).toBeNull();

    mockMutateAsync.mockResolvedValueOnce({ id: "pet1" });
    await fireEvent.press(screen.getByTestId("add-pet-retry"));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalled();
    });

    // Exactly one failed attempt + one successful retry — a single pet was
    // ever created (idempotent: no duplicate create for the same draft).
    expect(mockMutateAsync).toHaveBeenCalledTimes(2);
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: "/pets/[id]",
      params: { id: "pet1", localPhoto: "" },
    });
  });

  it("[idempotent resume] does not re-create when the draft already carries a createdPetId", async () => {
    useAddPetStore.getState().setCreatedPetId("pet-existing");

    await render(<DoneScreen />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalled();
    });

    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["pets"] });
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: "/pets/[id]",
      params: { id: "pet-existing", localPhoto: "" },
    });
  });

  it("navigates even when the (non-fatal) photo upload fails", async () => {
    useAddPetStore.getState().setField("photoUri", "file:///out.jpg");
    mockMutateAsync.mockResolvedValue({ id: "pet1" });
    mockUploadPetPhoto.mockRejectedValue(new Error("upload failed"));

    await render(<DoneScreen />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalled();
    });

    expect(mockUploadPetPhoto).toHaveBeenCalledWith("pet1", "file:///out.jpg");
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["pets"] });
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: "/pets/[id]",
      params: { id: "pet1", localPhoto: "file:///out.jpg" },
    });

    const state = useAddPetStore.getState();
    expect(state.draft.createdPetId).toBeNull();
  });
});
