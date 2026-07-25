import { attributeBytes, decodeVlqMappings, groupByPackage } from "../src/perf/source-map-attribution";

/**
 * Local base64-VLQ encoder used ONLY to build hand-crafted mapping fixtures
 * for these tests -- the production module (`source-map-attribution.ts`) is
 * decode-only by design (T095 plan step 14), so this encoder deliberately
 * lives here, not in `src/`.
 */
const BASE64_VLQ_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function encodeOneVlqValue(value: number): string {
  let vlq = value < 0 ? (-value << 1) + 1 : value << 1;
  let result = "";
  do {
    let digit = vlq & 31;
    vlq >>>= 5;
    if (vlq > 0) {
      digit |= 32;
    }
    result += BASE64_VLQ_CHARS[digit];
  } while (vlq > 0);
  return result;
}

function encodeSegment(fields: number[]): string {
  return fields.map(encodeOneVlqValue).join("");
}

describe("decodeVlqMappings", () => {
  it("decodes a negative delta", () => {
    // -5 encodes to the single char "L" (see module header derivation in the plan).
    expect(decodeVlqMappings("L")).toEqual([[[-5]]]);
  });

  it("decodes a value requiring a continuation group (>5 significant bits)", () => {
    // 200 requires two VLQ groups ("wM").
    expect(decodeVlqMappings(encodeSegment([200]))).toEqual([[[200]]]);
  });

  it("decodes multi-field segments across multiple lines and segments", () => {
    const mappings = `${encodeSegment([0, 0, 0, 0])},${encodeSegment([5, 1, 0, 0])};${encodeSegment([0, 1, 0, 0])}`;
    expect(decodeVlqMappings(mappings)).toEqual([
      [
        [0, 0, 0, 0],
        [5, 1, 0, 0],
      ],
      [[0, 1, 0, 0]],
    ]);
  });

  it("decodes an empty line (no segments) as an empty array", () => {
    expect(decodeVlqMappings(";")).toEqual([[], []]);
  });

  it("round-trips a hand-built negative multi-bit value", () => {
    // -200 also needs a continuation group and exercises the sign bit together with it.
    expect(decodeVlqMappings(encodeSegment([-200]))).toEqual([[[-200]]]);
  });
});

describe("attributeBytes", () => {
  it("assigns each generated span to its source across a 2-line, 3-segment fixture", () => {
    const sources = ["src/a.ts", "src/b.ts", "src/c.ts"];
    const generatedCode = "aaaaabbbbb\nccccc";
    const mappings = [
      `${encodeSegment([0, 0, 0, 0])},${encodeSegment([5, 1, 0, 0])}`,
      `${encodeSegment([0, 1, 0, 0])}`,
    ].join(";");

    const result = attributeBytes({ mappings, sources, generatedCode });

    expect(result).toEqual([
      { source: "src/a.ts", bytes: 5 },
      { source: "src/b.ts", bytes: 5 },
      { source: "src/c.ts", bytes: 5 },
    ]);

    const totalAttributed = result.reduce((sum, row) => sum + row.bytes, 0);
    const totalGenerated = generatedCode.split("\n").reduce((sum, line) => sum + line.length, 0);
    expect(totalAttributed).toBe(totalGenerated);
  });

  it("attributes an unmapped span (segment with no source fields) to the (unmapped) bucket", () => {
    const sources = ["src/a.ts"];
    const generatedCode = "aaaaXXXXX";
    // First segment (col 0) maps to src/a.ts; second segment (col 5) has only
    // a generatedColumn field -- no source -- so its span is unmapped.
    const mappings = `${encodeSegment([0, 0, 0, 0])},${encodeSegment([5])}`;

    const result = attributeBytes({ mappings, sources, generatedCode });

    expect(result).toEqual([
      { source: "src/a.ts", bytes: 5 },
      { source: "(unmapped)", bytes: 4 },
    ]);
    const totalAttributed = result.reduce((sum, row) => sum + row.bytes, 0);
    expect(totalAttributed).toBe(generatedCode.length);
  });
});

describe("groupByPackage", () => {
  it("buckets a pnpm-nested node_modules path by its real package name", () => {
    const rows = [
      { source: "/node_modules/.pnpm/react-native-svg@15.15.4_react@19.2.3/node_modules/react-native-svg/lib/index.js", bytes: 100 },
    ];
    expect(groupByPackage(rows)).toEqual([{ source: "react-native-svg", bytes: 100 }]);
  });

  it("keeps a scoped package's scope together", () => {
    const rows = [
      { source: "/node_modules/.pnpm/@expo+vector-icons@15.1.1/node_modules/@expo/vector-icons/build/vendor/x.js", bytes: 50 },
    ];
    expect(groupByPackage(rows)).toEqual([{ source: "@expo/vector-icons", bytes: 50 }]);
  });

  it("buckets a workspace packages/ path to its @pawcareright/<workspace> label", () => {
    const rows = [{ source: "../../packages/types/src/a.ts", bytes: 30 }];
    expect(groupByPackage(rows)).toEqual([{ source: "@pawcareright/types", bytes: 30 }]);
  });

  it("buckets an app-relative source (no node_modules, no packages/) to apps/mobile", () => {
    const rows = [{ source: "./src/pets/pet-age.ts", bytes: 20 }];
    expect(groupByPackage(rows)).toEqual([{ source: "apps/mobile", bytes: 20 }]);
  });

  it("merges multiple sources from the same package and sorts descending by bytes", () => {
    const rows = [
      { source: "./src/a.ts", bytes: 10 },
      { source: "/node_modules/.pnpm/x@1.0.0/node_modules/x/y.js", bytes: 200 },
      { source: "./src/b.ts", bytes: 5 },
    ];
    expect(groupByPackage(rows)).toEqual([
      { source: "x", bytes: 200 },
      { source: "apps/mobile", bytes: 15 },
    ]);
  });
});
