import { deriveMainKey, deriveThumbKey, isKeyInPetNamespace, originalKeyPrefix } from "../src/photos/photos.constants";
import { FUZZ_SEED, hostilePhotoKeys, mulberry32 } from "./fuzz/seeded-corpus";

/**
 * T096 Phase D (pure, no Nest app, no infra): property-style pinning of the
 * key-confinement guard (`isKeyInPetNamespace`) and the rendition-derivation
 * helpers, over a seeded corpus. Mirrors `photos.constants.spec.ts`'s
 * example-based cases but sweeps a much larger, deterministic space.
 *
 * `hostilePhotoKeys` splits its entries into two groups (see its own
 * doc-comment): entries with `confinedButNeverUploaded: false` carry a real
 * path-segment escape and MUST be rejected (`isKeyInPetNamespace` -> false).
 * Entries with `confinedButNeverUploaded: true` (a fully-percent-encoded
 * string, a NUL byte, a 4KB filename, a Unicode two-dot-leader lookalike)
 * contain neither a real `/` nor a literal `..` in the remainder -- the
 * *only* two things that could let a flat, `/`-delimited object-store key
 * escape a single-segment namespace -- so they are, correctly, confined
 * single-segment keys under this pet's own prefix; they were simply never
 * uploaded, which is the pre-existing, already-tested "well-formed but
 * never-uploaded key -> 404" class (`photos.e2e-spec.ts`), not a namespace
 * escape. This was verified empirically (not assumed) against the real
 * `isKeyInPetNamespace` implementation before this file was written.
 */
describe("photo key confinement (seeded property fuzz)", () => {
  const rng = mulberry32(FUZZ_SEED);

  function randomUuidLike(): string {
    const hex = (n: number): string =>
      Array.from({ length: n }, () => "0123456789abcdef"[Math.floor(rng() * 16)]).join("");
    return `${hex(8)}-${hex(4)}-4${hex(3)}-8${hex(3)}-${hex(12)}`;
  }

  it(`accepted keys are always confined to the pet's own namespace (seed=${FUZZ_SEED})`, () => {
    let acceptedCount = 0;

    for (let i = 0; i < 500; i += 1) {
      const petId = randomUuidLike();
      const filename = `${randomUuidLike()}.jpg`;
      const key = `${originalKeyPrefix(petId)}${filename}`;

      const accepted = isKeyInPetNamespace(petId, key);
      expect(accepted).toBe(true); // every generated key here is legitimate by construction
      acceptedCount += 1;

      const mainKey = deriveMainKey(key);
      const thumbKey = deriveThumbKey(key);

      for (const derived of [key, mainKey, thumbKey]) {
        expect(derived.startsWith(`pets/${petId}/`)).toBe(true);
        expect(derived.split("/")).toHaveLength(4);
        expect(derived.includes("..")).toBe(false);
        // POSIX-normalisation-invariant: no `.`/`..`/empty segment anywhere.
        expect(derived.split("/").some((segment) => segment === "." || segment === "" || segment === "..")).toBe(
          false,
        );
      }
    }

    // Non-vacuity: the property loop actually exercised something.
    expect(acceptedCount).toBe(500);
  });

  it("no hostile corpus entry with a real path-segment escape is ever accepted", () => {
    const petId = randomUuidLike();
    const entries = hostilePhotoKeys(petId, rng).filter((entry) => !entry.confinedButNeverUploaded);

    // Non-vacuity anchor: a guard that rejects everything is not a guard --
    // confirm at least one legitimate key still passes.
    expect(isKeyInPetNamespace(petId, `${originalKeyPrefix(petId)}legit-${randomUuidLike()}.jpg`)).toBe(true);
    expect(entries.length).toBeGreaterThan(0);

    for (const entry of entries) {
      expect(isKeyInPetNamespace(petId, entry.key)).toBe(false);
    }
  });

  it("the 'confined but never uploaded' corpus subset is genuinely confined (documents the empirical finding, not a defect)", () => {
    const petId = randomUuidLike();
    const entries = hostilePhotoKeys(petId, rng).filter((entry) => entry.confinedButNeverUploaded);

    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(isKeyInPetNamespace(petId, entry.key)).toBe(true);
      // Still confined to exactly this pet's namespace -- no cross-tenant
      // reach, regardless of how unusual the segment's content is.
      expect(entry.key.startsWith(originalKeyPrefix(petId))).toBe(true);
    }
  });

  it("derived rendition keys never escape via the replace() and always end in .jpg", () => {
    const petId = randomUuidLike();
    const pngKey = `${originalKeyPrefix(petId)}${randomUuidLike()}.png`;
    const webpKey = `${originalKeyPrefix(petId)}${randomUuidLike()}.webp`;

    for (const key of [pngKey, webpKey]) {
      expect(isKeyInPetNamespace(petId, key)).toBe(true);

      const mainKey = deriveMainKey(key);
      const thumbKey = deriveThumbKey(key);

      expect(mainKey.startsWith(`pets/${petId}/main/`)).toBe(true);
      expect(thumbKey.startsWith(`pets/${petId}/thumb/`)).toBe(true);
      expect(mainKey.endsWith(".jpg")).toBe(true);
      expect(thumbKey.endsWith(".jpg")).toBe(true);
      expect(mainKey.includes("/original/")).toBe(false);
      expect(thumbKey.includes("/original/")).toBe(false);
    }
  });

  it("deriveRenditionKey replaces only the first /original/ segment (defense in depth, M10)", () => {
    // `isKeyInPetNamespace` already rejects any key with more than one
    // `/`-delimited segment, and `Pet.id` is server-generated
    // (`@default(uuid())`), so a real caller can never reach
    // `deriveMainKey`/`deriveThumbKey` with a key containing a second
    // "/original/" substring. `deriveRenditionKey` is nonetheless a bare
    // string function with no guard of its own -- this pins that it uses a
    // single (first-occurrence) `.replace()`, not a global `.replaceAll()`,
    // so a second "/original/" occurrence later in the string (e.g. inside
    // an attacker-supplied filename, were the upstream guard ever bypassed
    // or reordered) is left untouched rather than also being rewritten.
    const petId = randomUuidLike();
    const adversarialKey = `${originalKeyPrefix(petId)}nested/original/x.jpg`;

    const mainKey = deriveMainKey(adversarialKey);
    const thumbKey = deriveThumbKey(adversarialKey);

    expect(mainKey).toBe(`pets/${petId}/main/nested/original/x.jpg`);
    expect(thumbKey).toBe(`pets/${petId}/thumb/nested/original/x.jpg`);
  });
});
