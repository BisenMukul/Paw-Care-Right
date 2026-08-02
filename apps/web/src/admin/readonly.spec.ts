import fs from "node:fs";
import path from "node:path";

/**
 * T111 step 26: static scan proving the web half of the admin surface adds
 * no write path -- no server action, no non-GET form/fetch method, no
 * `NEXT_PUBLIC_` name (secrets must never reach client JS), and no
 * `"use client"` anywhere under the admin surface (every admin
 * page/component is a server component).
 */
const WEB_ROOT = path.join(__dirname, "..", "..");
const SCAN_DIRS = [
  path.join(WEB_ROOT, "app", "admin"),
  path.join(WEB_ROOT, "src", "components", "admin"),
  path.join(WEB_ROOT, "src", "admin"),
];

function collectFiles(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) {
    return acc;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(full, acc);
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith(".spec.ts") && !entry.name.endsWith(".spec.tsx")) {
      acc.push(full);
    }
  }
  return acc;
}

const ALL_FILES = SCAN_DIRS.flatMap((dir) => collectFiles(dir));

const FORBIDDEN_PATTERNS: readonly { name: string; pattern: RegExp }[] = [
  { name: 'use server directive', pattern: /["']use server["']/ },
  { name: "action={ prop", pattern: /action=\{/ },
  { name: 'method="post"/"POST" attribute', pattern: /method=["'](post|POST)["']/ },
  { name: 'method: "POST"|"PUT"|"PATCH"|"DELETE" fetch init', pattern: /method:\s*["'](POST|PUT|PATCH|DELETE)["']/ },
  { name: "revalidatePath/revalidateTag", pattern: /revalidatePath|revalidateTag/ },
];

describe("apps/web admin surface is read-only (static scan)", () => {
  it("visited a non-trivial number of files (non-vacuity)", () => {
    expect(ALL_FILES.length).toBeGreaterThanOrEqual(8);
  });

  for (const { name, pattern } of FORBIDDEN_PATTERNS) {
    it(`no admin file contains: ${name}`, () => {
      const offenders = ALL_FILES.filter((file) => pattern.test(fs.readFileSync(file, "utf-8")));
      expect(offenders).toEqual([]);
    });

    it(`positive control: the "${name}" pattern DOES match a planted fixture`, () => {
      const fixtures: Record<string, string> = {
        "use server directive": '"use server";',
        "action={ prop": '<form action={submit}>',
        'method="post"/"POST" attribute': '<form method="post">',
        'method: "POST"|"PUT"|"PATCH"|"DELETE" fetch init': 'fetch(url, { method: "POST" })',
        "revalidatePath/revalidateTag": "revalidatePath('/admin')",
      };
      expect(pattern.test(fixtures[name]!)).toBe(true);
    });
  }

  it('every <form in an admin file carries method="get"', () => {
    for (const file of ALL_FILES) {
      const source = fs.readFileSync(file, "utf-8");
      const formTags = [...source.matchAll(/<form\b[^>]*>/g)].map((match) => match[0]);
      for (const tag of formTags) {
        expect(tag).toContain('method="get"');
      }
    }
  });

  it("no admin file contains NEXT_PUBLIC_ (secrets must never reach client JS)", () => {
    const offenders = ALL_FILES.filter((file) => fs.readFileSync(file, "utf-8").includes("NEXT_PUBLIC_"));
    expect(offenders).toEqual([]);
  });

  it('no admin file contains "use client"', () => {
    const offenders = ALL_FILES.filter((file) => /["']use client["']/.test(fs.readFileSync(file, "utf-8")));
    expect(offenders).toEqual([]);
  });
});
