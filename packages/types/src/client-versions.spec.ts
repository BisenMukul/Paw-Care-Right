import { clientVersionRowSchema, clientVersionsResponseSchema } from "./client-versions";

function buildValidRow(): Record<string, unknown> {
  return {
    day: "2026-07-30",
    appVersion: "1.2.3",
    updateId: "update-1",
    deviceCount: 3,
  };
}

function buildValidResponse(): Record<string, unknown> {
  return {
    days: 30,
    generatedAt: "2026-07-30T00:00:00.000Z",
    rows: [buildValidRow()],
  };
}

describe("clientVersionRowSchema", () => {
  it("accepts a valid row", () => {
    expect(clientVersionRowSchema.parse(buildValidRow())).toEqual(buildValidRow());
  });

  it("accepts null appVersion/updateId (never reported)", () => {
    const row = { ...buildValidRow(), appVersion: null, updateId: null };
    expect(clientVersionRowSchema.parse(row)).toEqual(row);
  });

  it("rejects a negative deviceCount", () => {
    expect(() => clientVersionRowSchema.parse({ ...buildValidRow(), deviceCount: -1 })).toThrow();
  });

  it("rejects a non-integer deviceCount", () => {
    expect(() => clientVersionRowSchema.parse({ ...buildValidRow(), deviceCount: 1.5 })).toThrow();
  });

  it("rejects a missing day", () => {
    const row = buildValidRow();
    delete row.day;
    expect(() => clientVersionRowSchema.parse(row)).toThrow();
  });

  it("rejects an unrecognized extra key (.strict())", () => {
    expect(() => clientVersionRowSchema.parse({ ...buildValidRow(), extra: "nope" })).toThrow();
  });
});

describe("clientVersionsResponseSchema", () => {
  it("accepts a valid response", () => {
    expect(clientVersionsResponseSchema.parse(buildValidResponse())).toEqual(buildValidResponse());
  });

  it("accepts an empty rows array", () => {
    const response = { ...buildValidResponse(), rows: [] };
    expect(clientVersionsResponseSchema.parse(response)).toEqual(response);
  });

  it("rejects a non-positive days value", () => {
    expect(() => clientVersionsResponseSchema.parse({ ...buildValidResponse(), days: 0 })).toThrow();
  });

  it("rejects an invalid row nested inside rows", () => {
    const response = { ...buildValidResponse(), rows: [{ ...buildValidRow(), deviceCount: -1 }] };
    expect(() => clientVersionsResponseSchema.parse(response)).toThrow();
  });
});
