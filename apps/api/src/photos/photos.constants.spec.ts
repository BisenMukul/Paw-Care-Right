import { isKeyInPetNamespace, originalKeyPrefix } from "./photos.constants";

/**
 * Security-critical helper (T070 decision 1): the shared photo-key
 * namespace guard used by both `confirmUpload` and `viewUrls`. `startsWith`
 * alone would let a traversal key (`../../other-pet/...`) pass, so the
 * remainder after the prefix must additionally be a single flat segment --
 * non-empty, no `/`, no `..`.
 */
describe("isKeyInPetNamespace", () => {
  const petId = "pet-1";

  it("a valid flat key under this pet's original-upload namespace -> true", () => {
    expect(isKeyInPetNamespace(petId, `${originalKeyPrefix(petId)}8400e29b-9c1d-4c1a-9e1a-6b6b6b6b6b6b.jpg`)).toBe(
      true,
    );
  });

  it("a foreign-prefix key (another pet's namespace) -> false", () => {
    expect(isKeyInPetNamespace(petId, `${originalKeyPrefix("other-pet")}abc.jpg`)).toBe(false);
  });

  it("a path-traversal remainder (`../../other-pet/main/x.jpg`) -> false", () => {
    expect(isKeyInPetNamespace(petId, `${originalKeyPrefix(petId)}../../other-pet/main/x.jpg`)).toBe(false);
  });

  it("a remainder with an extra `/` segment (no `..`) -> false", () => {
    expect(isKeyInPetNamespace(petId, `${originalKeyPrefix(petId)}sub/x.jpg`)).toBe(false);
  });

  it("an empty remainder (bare prefix, no filename) -> false", () => {
    expect(isKeyInPetNamespace(petId, originalKeyPrefix(petId))).toBe(false);
  });

  it("the legitimate non-uuid key `never-uploaded.jpg` -> true (regression guard, decision 1)", () => {
    expect(isKeyInPetNamespace(petId, `${originalKeyPrefix(petId)}never-uploaded.jpg`)).toBe(true);
  });
});
