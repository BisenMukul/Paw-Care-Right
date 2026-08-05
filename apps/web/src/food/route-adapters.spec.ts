import fs from "node:fs";
import path from "node:path";

// Source-text assertions only (R9): importing `app/**/page.tsx` would pull
// `next/navigation` (ESM) into Jest's CJS environment. The build-output
// test exercises the real adapters end-to-end; this test pins their shape.

const ROUTES: Array<{ segment: string; relPath: string[] }> = [
  { segment: "can-dogs-eat", relPath: ["can-dogs-eat", "[item]", "page.tsx"] },
  { segment: "can-cats-eat", relPath: ["can-cats-eat", "[item]", "page.tsx"] },
];

function readRoute(relPath: string[]): string {
  const fullPath = path.join(__dirname, "..", "..", "app", ...relPath);
  return fs.readFileSync(fullPath, "utf-8");
}

describe("route adapters — source shape (D2/D3/D9)", () => {
  it("both page files exist at the literal route paths", () => {
    for (const route of ROUTES) {
      const fullPath = path.join(__dirname, "..", "..", "app", ...route.relPath);
      expect(fs.existsSync(fullPath)).toBe(true);
    }
  });

  it("both export dynamicParams = false, generateStaticParams, generateMetadata, a default export", () => {
    for (const route of ROUTES) {
      const source = readRoute(route.relPath);
      expect(source).toMatch(/export const dynamicParams = false;/);
      expect(source).toMatch(/export function generateStaticParams/);
      expect(source).toMatch(/export async function generateMetadata/);
      expect(source).toMatch(/export default async function Page/);
    }
  });

  it("each adapter references its own segment constant and delegates to buildFoodPageModel", () => {
    for (const route of ROUTES) {
      const source = readRoute(route.relPath);
      expect(source).toContain(`"${route.segment}"`);
      expect(source).toMatch(/buildFoodPageModel\(/);
      // Every reference to buildFoodPageModel in this file uses this route's
      // own segment literal, never the other route's.
      const otherSegment = ROUTES.find((r) => r.segment !== route.segment)!.segment;
      expect(source).not.toContain(`"${otherSegment}"`);
    }
  });

  it("neither adapter contains 'use client'", () => {
    for (const route of ROUTES) {
      const source = readRoute(route.relPath);
      expect(source).not.toContain("use client");
    }
  });

  it("neither adapter renders openGraph.images (no asset exists)", () => {
    for (const route of ROUTES) {
      const source = readRoute(route.relPath);
      expect(source).not.toContain("images:");
    }
  });
});
