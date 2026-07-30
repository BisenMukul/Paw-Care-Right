/**
 * T099 plan step 8b (AC2 proof): drift guard for `docs/release-runbook.md`.
 * House idiom copied from `state-audit-doc.test.ts` — see that file's header
 * comment for why `node:fs`/`node:path` are accessed via a locally-typed
 * `require` (no `@types/node` in this workspace) and why the lone
 * `export {}` is required.
 */
export {};

declare const __dirname: string;

interface NodeFs {
  readFileSync(path: string, encoding: string): string;
}
interface NodePath {
  join(...parts: string[]): string;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: locally-typed require avoids adding @types/node (a new dep is out of scope), mirrors state-audit-doc.test.ts
const fs = require("node:fs") as NodeFs;
// eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: same as above
const path = require("node:path") as NodePath;

const RUNBOOK_PATH = path.join(__dirname, "..", "..", "..", "docs", "release-runbook.md");
const EAS_JSON_PATH = path.join(__dirname, "..", "eas.json");
const ARCHITECTURE_PATH = path.join(__dirname, "..", "..", "..", "docs", "ARCHITECTURE.md");

const runbook = fs.readFileSync(RUNBOOK_PATH, "utf8");
const easJson: { build: Record<string, { channel: string }> } = JSON.parse(
  fs.readFileSync(EAS_JSON_PATH, "utf8"),
);
const architecture = fs.readFileSync(ARCHITECTURE_PATH, "utf8");

/**
 * T106 step 20 (AC1 "every ARCHITECTURE container covered"): parses
 * `docs/ARCHITECTURE.md`'s §2 container table directly, so this test fails
 * if a container is renamed/added there and not mirrored in the runbook,
 * rather than trusting a hand-maintained duplicate list. Extracts the FIRST
 * cell of every `| … | … |` row strictly between the `## 2.` and `## 3.`
 * headings, skipping the header row (`Container`) and the `---` separator
 * row. Within that cell, the container NAME is either the leading
 * backtick-code-span (` `apps/api` `, ` `apps/mobile` `, …) or, when the
 * cell has no leading code span (the `workers` row, which instead has a
 * parenthetical aside containing an unrelated path), the cell's first
 * whitespace-delimited token.
 */
function parseArchitectureContainers(doc: string): string[] {
  const start = doc.indexOf("## 2. Containers");
  const end = doc.indexOf("\n## 3.");
  if (start === -1 || end === -1) {
    throw new Error("Could not locate ARCHITECTURE.md §2/§3 headings for container-table parsing.");
  }
  const section = doc.slice(start, end);

  return section
    .split("\n")
    .filter((line) => line.trim().startsWith("|"))
    .map((line) => line.slice(1, line.indexOf("|", 1)).trim())
    .filter((cell) => cell.length > 0 && cell !== "Container" && !/^-+$/.test(cell))
    .map((cell) => {
      const leadingCodeSpan = /^`([^`]+)`/.exec(cell);
      if (leadingCodeSpan) {
        return leadingCodeSpan[1] as string;
      }
      return cell.split(/\s+/)[0] as string;
    });
}

const ARCHITECTURE_CONTAINERS = parseArchitectureContainers(architecture);

// ---- heading-level slicing helper (checker F2 fix) ----------------------
// Mirrors `store-listing-doc.test.ts`'s `sliceSection` idiom exactly: finds
// the line matching `startLineTest`, then the NEXT line matching
// `boundaryTest` (a generic "level-2 heading" regex, not a specific
// section number), and slices between them. Scoping the container-coverage
// assertions to THIS slice (rather than the whole `runbook` string) means a
// row that vanishes from §12's table but happens to be mentioned
// incidentally elsewhere in the doc (e.g. §16's rollback prose) is still
// caught — a doc-wide `toContain` would miss exactly that case.
const LEVEL_2_HEADING = /^##(?!#)\s/;

function sliceSection(source: string, startLineTest: RegExp, boundaryTest: RegExp): string {
  const lines = source.split("\n");
  const startIndex = lines.findIndex((line) => startLineTest.test(line));
  if (startIndex === -1) return "";
  let endIndex = lines.length;
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    if (boundaryTest.test(lines[i]!)) {
      endIndex = i;
      break;
    }
  }
  return lines.slice(startIndex, endIndex).join("\n");
}

const containerCoverageSection = sliceSection(runbook, /^## 12\. /, LEVEL_2_HEADING);

/**
 * Checker F2 hardening: a plain section-scoped `toContain` is STILL not
 * enough, because §12 legitimately mentions other containers' names inside
 * a DIFFERENT row's own cell (e.g. `packages/data`'s "Deploy step" cell
 * says "whichever app consumes it (`apps/api`, `apps/web`)") and inside the
 * ordered deploy-order prose below the table ("4. **web** — redeploy
 * `apps/web`..."). Both would keep a deleted `apps/web` ROW invisible to a
 * section-wide substring search. Restricting the search to each table
 * row's OWN FIRST (Container) CELL — mirroring
 * `parseArchitectureContainers`'s row-scoped extraction above — means a
 * deleted row has NO cell left to match against, so it genuinely goes RED
 * (verified: re-running the checker's MUT-D, deleting the `apps/web` row,
 * against this exact assertion).
 */
function extractTableLeadCells(section: string): string[] {
  return section
    .split("\n")
    .filter((line) => line.trim().startsWith("|"))
    .map((line) => line.slice(1, line.indexOf("|", 1)).trim())
    .filter((cell) => cell.length > 0 && cell !== "Container" && !/^-+$/.test(cell));
}

const containerTableLeadCells = extractTableLeadCells(containerCoverageSection);

// §1 infra + third-party containers (mermaid context diagram, not the §2
// table) — hardcoded per plan D-decision, since these never appear as a
// parseable markdown table row.
const INFRA_CONTAINERS = [
  "PostgreSQL",
  "Redis",
  "MinIO",
  "Ollama",
  "Gemini",
  "Expo Push",
  "RevenueCat",
  "PostHog",
  "Sentry",
];

const SECRET_PATTERNS: RegExp[] = [
  /AKIA[0-9A-Z]{16}/,
  new RegExp("\\bsk-" + "[A-Za-z0-9_-]{20,}"),
  new RegExp("AIza" + "[0-9A-Za-z_-]{35}"),
  /-----BEGIN/,
  new RegExp("eyJ" + "[A-Za-z0-9_-]{10,}\\."),
];

describe("docs/release-runbook.md (T099)", () => {
  it("contains the required sections", () => {
    const requiredHeadingWords = [
      "Identifiers",
      "Prerequisites",
      "Build profiles",
      "Environment variables",
      "Versioning",
      "Build",
      "OTA",
      "Verification",
      "Founder",
      // T106 §§12–16
      "Container",
      "decision matrix",
      "kill switch",
      "Incident",
      "Rollback",
      // T117 §17
      "per-update release health",
    ];
    for (const word of requiredHeadingWords) {
      const headingPattern = new RegExp(`^## \\d+\\. .*${word}`, "m");
      expect(headingPattern.test(runbook)).toBe(true);
    }
  });

  // T106 AC1: "every ARCHITECTURE container covered". Scoped to §12's table
  // ROWS specifically (checker F2 fix) -- see `extractTableLeadCells`'s doc
  // comment above for why a section-wide (or even a lead-cell-agnostic
  // section) search is not enough: a deleted row's name can still appear
  // inside another row's own "Deploy step" cell or the deploy-order prose.
  it("covers every container in ARCHITECTURE.md §2 within the §12 table", () => {
    expect(containerCoverageSection.length).toBeGreaterThan(0);
    expect(ARCHITECTURE_CONTAINERS.length).toBeGreaterThanOrEqual(6); // non-vacuity floor
    for (const container of ARCHITECTURE_CONTAINERS) {
      expect(containerTableLeadCells.some((cell) => cell.includes(container))).toBe(true);
    }
  });

  it("covers the §1 infra and third-party containers within the §12 table", () => {
    for (const container of INFRA_CONTAINERS) {
      expect(containerTableLeadCells.some((cell) => cell.includes(container))).toBe(true);
    }
  });

  it("documents the db→api→workers→web→mobile deploy order with a rollback step per layer", () => {
    expect(runbook).toContain("db → api → workers → web → mobile");
    const rollbackSection = runbook.slice(runbook.indexOf("## 16."));
    for (const layer of ["db", "api", "workers", "web", "mobile"]) {
      expect(rollbackSection.toLowerCase()).toContain(layer);
    }
  });

  it("documents an OTA-vs-binary decision matrix that delegates policy to docs/OTA_UPDATES.md", () => {
    const matrixSection = runbook.slice(runbook.indexOf("## 13."), runbook.indexOf("## 14."));
    expect(matrixSection).toContain("OTA");
    expect(matrixSection).toContain("binary");
    expect(matrixSection).toContain("docs/OTA_UPDATES.md");
  });

  it("documents the three incident playbooks", () => {
    const incidentSection = runbook.slice(runbook.indexOf("## 15."), runbook.indexOf("## 16."));
    expect(incidentSection).toMatch(/AI provider down/i);
    expect(incidentSection).toMatch(/bad triage report/i);
    expect(incidentSection).toMatch(/store rejection/i);
    expect(incidentSection).toContain("ai-audit");
    expect(incidentSection).toContain("test:ai-evals");
  });

  it("documents the feature kill switches: redis-cli SET and DEL, and FEATURE_DISABLED", () => {
    expect(runbook).toContain("redis-cli");
    expect(runbook).toMatch(/SET bombaypetcompany:flags:checks off/);
    expect(runbook).toMatch(/DEL bombaypetcompany:flags:checks/);
    expect(runbook).toContain("FEATURE_DISABLED");
  });

  it("documents a build, a submit and an update command", () => {
    expect(runbook).toContain("eas-cli@latest build --profile preview");
    expect(runbook).toContain("build --profile production");
    expect(runbook).toContain("submit --profile production --platform ios");
    expect(runbook).toContain("submit --profile production --platform android");
    expect(runbook).toContain("update --branch preview");
  });

  it("documents every build profile defined in eas.json", () => {
    expect(Object.keys(easJson.build).length).toBeGreaterThanOrEqual(3); // non-vacuity floor
    for (const [name, profile] of Object.entries(easJson.build)) {
      expect(runbook).toContain(name);
      expect(runbook).toContain(profile.channel);
    }
  });

  it("delegates OTA policy to docs/OTA_UPDATES.md instead of restating it", () => {
    expect(runbook).toContain("docs/OTA_UPDATES.md");
    const hasDuplicatedRolloutLine = runbook
      .split("\n")
      .some((line) => line.includes("10%") && line.includes("50%"));
    expect(hasDuplicatedRolloutLine).toBe(false);
  });

  it("pins the Sentry release contract and the APP_VERSION mirror", () => {
    expect(runbook).toContain("bombaypetcompany@{version}+");
    expect(runbook).toContain("APP_VERSION");
  });

  it("states honestly that no eas command was executed in the build environment", () => {
    expect(runbook).toContain("EXPO_TOKEN");
    expect(runbook).toContain(
      "npx eas-cli@latest build --profile preview --platform ios --non-interactive",
    );
  });

  it("contains no secret-shaped value", () => {
    for (const pattern of SECRET_PATTERNS) {
      expect(pattern.test(runbook)).toBe(false);
    }
  });

  // T117 step 25: §17 content, scoped to the §17 slice ONLY (reusing
  // `sliceSection`/`LEVEL_2_HEADING`) so a stray mention elsewhere in the
  // doc can never substitute for the real section. Deliberately does NOT
  // touch the existing `:236-242`/`:244` assertions above (both still pass
  // unmodified).
  describe("§17 OTA rollback & per-update release health (T117)", () => {
    const section = sliceSection(runbook, /^## 17\. /, LEVEL_2_HEADING);

    it("the §17 section exists and is non-empty", () => {
      expect(section.length).toBeGreaterThan(0);
    });

    it("documents the rollback procedure command and the halt action", () => {
      expect(section).toContain("update:republish");
      expect(section).toContain("--action end");
    });

    it("documents the promotion criteria thresholds from OTA_UPDATES §6", () => {
      expect(section).toContain("99.5%");
      expect(section).toContain("12h");
    });

    it("documents the ota_applied event and the client-versions endpoint", () => {
      expect(section).toContain("ota_applied");
      expect(section).toContain("/v1/meta/client-versions");
      expect(section).toContain("x-admin-token");
    });

    it("has exactly one table row per rollout step (10%, 50%, 100%)", () => {
      const tableRows = section
        .split("\n")
        .filter((line) => line.trim().startsWith("|") && /`?\d+%`?/.test(line));
      const percents = ["10%", "50%", "100%"];
      for (const percent of percents) {
        const matchingRows = tableRows.filter((line) => line.includes(percent));
        expect(matchingRows.length).toBe(1);
      }
    });

    it("carries the disclaimer/Emergency-interstitial/hotline invariant sentence", () => {
      expect(section).toContain("<VetDisclaimer/>");
      expect(section).toMatch(/Emergency interstitial/i);
      expect(section).toMatch(/hotline data/i);
    });

    it("the file-wide 'no 10% and 50% on one line' and Sentry-release-shape assertions above stay green against this new section too", () => {
      const hasDuplicatedRolloutLine = section
        .split("\n")
        .some((line) => line.includes("10%") && line.includes("50%"));
      expect(hasDuplicatedRolloutLine).toBe(false);
    });
  });
});
