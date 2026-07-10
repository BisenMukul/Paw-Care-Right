import { petIdSchema } from "./branded-ids";

describe("petIdSchema", () => {
  it("parses a valid uuid and returns the branded value", () => {
    const uuid = "123e4567-e89b-12d3-a456-426614174000";
    expect(petIdSchema.parse(uuid)).toEqual(uuid);
  });

  it("rejects a non-uuid string", () => {
    expect(() => petIdSchema.parse("not-a-uuid")).toThrow();
  });
});
