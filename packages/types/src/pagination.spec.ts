import { z } from "zod";
import { paginationQuerySchema, paginated } from "./pagination";

describe("paginationQuerySchema", () => {
  it("defaults limit to 20 and leaves cursor undefined when absent", () => {
    expect(paginationQuerySchema.parse({})).toEqual({ limit: 20 });
  });

  it("coerces limit from string to number", () => {
    expect(paginationQuerySchema.parse({ limit: "50" })).toEqual({ limit: 50 });
  });

  it("rejects a limit above the max (100)", () => {
    expect(() => paginationQuerySchema.parse({ limit: 101 })).toThrow();
  });

  it("rejects a limit below the min (1)", () => {
    expect(() => paginationQuerySchema.parse({ limit: 0 })).toThrow();
  });
});

describe("paginated", () => {
  const itemSchema = z.object({ id: z.string() });
  const schema = paginated(itemSchema);

  it("accepts a valid paginated response", () => {
    const input = { items: [{ id: "1" }, { id: "2" }], nextCursor: null };
    expect(schema.parse(input)).toEqual(input);
  });

  it("rejects a response missing items", () => {
    expect(() => schema.parse({ nextCursor: null })).toThrow();
  });
});
