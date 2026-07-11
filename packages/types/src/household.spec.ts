import {
  acceptInviteInputSchema,
  acceptInviteResponseSchema,
  createInviteResponseSchema,
  householdMemberSchema,
  householdMeSchema,
  ROLES,
  roleSchema,
} from "./household";

describe("roleSchema", () => {
  it("accepts every value in ROLES", () => {
    for (const value of ROLES) {
      expect(roleSchema.safeParse(value).success).toBe(true);
    }
  });

  it("rejects an unknown role", () => {
    expect(roleSchema.safeParse("ADMIN").success).toBe(false);
  });
});

describe("createInviteResponseSchema", () => {
  const valid = {
    code: "AB3DEFGH",
    deepLink: "pawcareright://join/AB3DEFGH",
    expiresAt: "2024-01-08T00:00:00.000Z",
  };

  it("parses a valid fixture", () => {
    expect(createInviteResponseSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a missing code", () => {
    const { deepLink, expiresAt } = valid;
    expect(createInviteResponseSchema.safeParse({ deepLink, expiresAt }).success).toBe(false);
  });
});

describe("acceptInviteInputSchema", () => {
  it("parses a valid fixture", () => {
    expect(acceptInviteInputSchema.safeParse({ code: "AB3DEFGH" }).success).toBe(true);
  });

  it("rejects a missing code", () => {
    expect(acceptInviteInputSchema.safeParse({}).success).toBe(false);
  });
});

describe("acceptInviteResponseSchema", () => {
  const valid = {
    householdId: "223e4567-e89b-12d3-a456-426614174000",
    name: "The Smiths",
  };

  it("parses a valid fixture", () => {
    expect(acceptInviteResponseSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a non-uuid householdId", () => {
    expect(acceptInviteResponseSchema.safeParse({ ...valid, householdId: "not-a-uuid" }).success).toBe(
      false,
    );
  });
});

describe("householdMemberSchema", () => {
  const valid = {
    userId: "323e4567-e89b-12d3-a456-426614174000",
    email: "owner@example.com",
    role: "OWNER",
  };

  it("parses a valid fixture", () => {
    expect(householdMemberSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a bad role", () => {
    expect(householdMemberSchema.safeParse({ ...valid, role: "ADMIN" }).success).toBe(false);
  });
});

describe("householdMeSchema", () => {
  const valid = {
    id: "423e4567-e89b-12d3-a456-426614174000",
    name: "The Smiths",
    members: [
      { userId: "323e4567-e89b-12d3-a456-426614174000", email: "owner@example.com", role: "OWNER" },
    ],
  };

  it("parses a valid fixture", () => {
    expect(householdMeSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a malformed member in the list", () => {
    const result = householdMeSchema.safeParse({
      ...valid,
      members: [{ userId: "not-a-uuid", email: "owner@example.com", role: "OWNER" }],
    });
    expect(result.success).toBe(false);
  });
});
