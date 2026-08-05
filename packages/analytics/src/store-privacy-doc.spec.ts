import * as fs from "node:fs";
import * as path from "node:path";

/**
 * T092 (store privacy declarations prep) plan D5 — the drift guard.
 *
 * The card's acceptance criterion is a CORRESPONDENCE claim ("cross-checked
 * list matches PostHog/Sentry/RC data actually sent"), which decays silently
 * the moment someone adds an event/property to `AnalyticsEventMap` without
 * updating `docs/store-privacy.md`'s Appendix A. This spec converts that
 * one-off manual check into a permanent one: pure source-text parsing
 * (`node:fs`/`node:path` only, no new deps, no runtime code), asserting
 * set-equality in BOTH directions so a silently-added OR silently-removed
 * event/property fails loudly rather than passing by accident.
 *
 * Lives in `packages/analytics` (not `docs/`) because this package owns both
 * the event map (`./events.ts`) and the Sentry scrubbers the doc cites — the
 * guard sits next to the thing it guards.
 */

const repoRoot = path.resolve(__dirname, "../../..");
const docPath = path.resolve(repoRoot, "docs/store-privacy.md");
const eventsPath = path.resolve(__dirname, "./events.ts");

const REQUIRED_SECTION_ANCHORS = [
  "## 2. Data inventory",
  "## 3. Third-party recipients",
  "## 4. Apple privacy nutrition labels",
  "## 5. Google Play Data Safety",
  "## 6. What we do NOT collect",
  "## 7. User controls and retention (T091)",
  "## 8. Discrepancies and open items",
  "## 9. How to re-verify",
  "## Appendix A",
];

const ANCHOR_TOKEN_RE = /^(apps|packages|docs)\/[\w./-]+\.(ts|tsx|prisma|md)(:\d+(-\d+)?)?$/;

/**
 * Source side of the parsing contract: the `AnalyticsEventMap` interface
 * body in `events.ts`. A top-level event is a `  name: {` line (2-space
 * indent); its properties are the following `    name?: ...` lines
 * (4-space indent, `?` stripped) until the closing `  };`.
 */
function parseEventMapFromSource(source: string): Map<string, Set<string>> {
  const lines = source.split("\n");
  const startIndex = lines.findIndex((line) => line === "export interface AnalyticsEventMap {");
  if (startIndex === -1) {
    throw new Error("store-privacy-doc.spec: could not find 'export interface AnalyticsEventMap {' in events.ts");
  }

  const endIndex = lines.findIndex((line, index) => index > startIndex && line === "}");
  if (endIndex === -1) {
    throw new Error("store-privacy-doc.spec: could not find the closing '}' of AnalyticsEventMap in events.ts");
  }

  const events = new Map<string, Set<string>>();
  let currentEvent: string | null = null;
  let currentProps: Set<string> | null = null;

  for (let i = startIndex + 1; i < endIndex; i += 1) {
    const line = lines[i] as string;

    const eventMatch = /^ {2}(\w+): \{$/.exec(line);
    if (eventMatch) {
      currentEvent = eventMatch[1] as string;
      currentProps = new Set<string>();
      events.set(currentEvent, currentProps);
      continue;
    }

    if (line === "  };") {
      currentEvent = null;
      currentProps = null;
      continue;
    }

    if (currentProps) {
      const propMatch = /^ {4}(\w+)\??:/.exec(line);
      if (propMatch) {
        currentProps.add(propMatch[1] as string);
      }
    }
  }

  return events;
}

/**
 * Doc side of the parsing contract: the table between the
 * `BEGIN:posthog-events` / `END:posthog-events` markers. Column 1's single
 * backticked token is the event name; every backticked token in column 2 is
 * a property name. Header + separator rows are skipped.
 */
function parseAppendixFromDoc(doc: string): Map<string, Set<string>> {
  const beginIndex = doc.indexOf("<!-- BEGIN:posthog-events -->");
  const endIndex = doc.indexOf("<!-- END:posthog-events -->");
  if (beginIndex === -1 || endIndex === -1 || endIndex < beginIndex) {
    throw new Error("store-privacy-doc.spec: could not find BEGIN/END:posthog-events anchors in the doc");
  }

  const block = doc.slice(beginIndex, endIndex);
  const rows = block
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && line.endsWith("|"));

  const events = new Map<string, Set<string>>();

  for (const row of rows) {
    const cells = row
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());

    if (cells.length < 2) {
      continue;
    }

    // Skip the header row ("Event | Properties sent | Emitted from") and
    // the separator row ("---|---|---") -- neither column 1 cell contains a
    // backticked token.
    const nameMatch = /^`([^`]+)`$/.exec(cells[0] as string);
    if (!nameMatch) {
      continue;
    }

    const propertiesCell = cells[1] as string;
    const propTokens = [...propertiesCell.matchAll(/`([^`]+)`/g)].map((m) => m[1] as string);

    events.set(nameMatch[1] as string, new Set(propTokens));
  }

  return events;
}

/** Extracts every backticked repo-relative code-anchor path cited in the doc, deduped, with the `:line` suffix stripped. */
function extractCitedAnchorPaths(doc: string): string[] {
  const tokens = [...doc.matchAll(/`([^`]+)`/g)].map((m) => m[1] as string);
  const paths = new Set<string>();

  for (const token of tokens) {
    if (ANCHOR_TOKEN_RE.test(token)) {
      const barePath = token.split(":")[0] as string;
      paths.add(barePath);
    }
  }

  return [...paths];
}

describe("store-privacy-doc.spec (T092 D5 drift guard)", () => {
  const doc = fs.readFileSync(docPath, "utf8");
  const source = fs.readFileSync(eventsPath, "utf8");

  it("the doc contains every required section anchor", () => {
    const missing = REQUIRED_SECTION_ANCHORS.filter((heading) => !doc.includes(heading));
    expect(missing).toEqual([]);
  });

  it("every code anchor cited in the doc resolves to a file that exists", () => {
    const citedPaths = extractCitedAnchorPaths(doc);

    // Non-vacuity (M3): an emptied or anchor-less doc must fail loudly, not
    // trivially "pass" an empty comparison.
    expect(citedPaths.length).toBeGreaterThan(0);

    const missing = citedPaths.filter((p) => !fs.existsSync(path.resolve(repoRoot, p)));
    expect(missing).toEqual([]);
  });

  it("Appendix A.1 lists exactly the events in AnalyticsEventMap", () => {
    const sourceEvents = parseEventMapFromSource(source);
    const docEvents = parseAppendixFromDoc(doc);

    // Non-vacuity (M1/M3): both parses must find something before any
    // comparison is meaningful.
    expect(sourceEvents.size).toBeGreaterThan(0);
    expect(docEvents.size).toBeGreaterThan(0);

    const sourceNames = new Set(sourceEvents.keys());
    const docNames = new Set(docEvents.keys());

    // Both directions explicitly: a new source event with no doc row, AND a
    // stale doc row with no source event, must each fail.
    const missingFromDoc = [...sourceNames].filter((name) => !docNames.has(name));
    const extraInDoc = [...docNames].filter((name) => !sourceNames.has(name));

    expect(missingFromDoc).toEqual([]);
    expect(extraInDoc).toEqual([]);
  });

  it("Appendix A.1 lists exactly the properties each event sends", () => {
    const sourceEvents = parseEventMapFromSource(source);
    const docEvents = parseAppendixFromDoc(doc);

    expect(sourceEvents.size).toBeGreaterThan(0);
    expect(docEvents.size).toBeGreaterThan(0);

    for (const [eventName, sourceProps] of sourceEvents) {
      // Non-vacuity (M2): the per-event source property set must be
      // non-empty before comparing (every event in this map has >=1 prop
      // today; a future zero-prop event would make this assertion
      // meaningless for that one event, so it is scoped per-event).
      expect(sourceProps.size).toBeGreaterThan(0);

      const docProps = docEvents.get(eventName);
      expect(docProps).toBeDefined();

      const missingFromDoc = [...sourceProps].filter((p) => !docProps?.has(p));
      const extraInDoc = [...(docProps ?? [])].filter((p) => !sourceProps.has(p));

      expect({ event: eventName, missingFromDoc }).toEqual({ event: eventName, missingFromDoc: [] });
      expect({ event: eventName, extraInDoc }).toEqual({ event: eventName, extraInDoc: [] });
    }
  });

  it("Appendix A names the Sentry and consent guards that make its absence claims true", () => {
    const requiredIdentifiers = [
      { name: "scrubSentryEvent", file: path.resolve(repoRoot, "packages/analytics/src/sentry/scrub.ts") },
      { name: "scrubBreadcrumb", file: path.resolve(repoRoot, "packages/analytics/src/sentry/scrub.ts") },
      { name: "sendDefaultPii", file: path.resolve(repoRoot, "packages/analytics/src/sentry/options.ts") },
      {
        name: "captureForUser",
        file: path.resolve(repoRoot, "apps/api/src/analytics/analytics.service.ts"),
      },
    ];

    for (const { name, file } of requiredIdentifiers) {
      // The doc must mention the identifier...
      expect(doc.includes(name)).toBe(true);

      // ...AND the identifier must still be defined in the file the doc
      // attributes it to (M5: a rename breaks this half even if the doc
      // text is untouched, making this a real two-sided cross-check).
      const fileContents = fs.readFileSync(file, "utf8");
      const identifierRe = new RegExp(`\\b${name}\\b`);
      expect(identifierRe.test(fileContents)).toBe(true);
    }
  });
});
