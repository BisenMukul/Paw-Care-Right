import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { parse as parseYaml } from "yaml";

import {
  goldenEvalFileSchema,
  parseEvalFile,
  redteamEvalFileSchema,
  type GoldenCase,
  type RedteamCase,
} from "./case-schema";
import type { LoadedCase } from "./types";

/**
 * Reads + validates the `golden/*.yaml` and `redteam/*.yaml` eval fixture
 * files under `evalsDir` (plan step 3 "evals/load.ts"). A malformed eval SET
 * is an operator/authoring error, not a fail-upward runtime path — so unlike
 * `parseEvalFile`, `loadCases` aggregates every problem across every file
 * and THROWS a single clear error listing them all (bad files/ids).
 */

function listYamlFiles(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries.filter((name) => name.endsWith(".yaml") || name.endsWith(".yml")).sort();
}

function goldenToLoadedCase(c: GoldenCase, sourceFile: string): LoadedCase {
  return {
    id: c.id,
    set: "golden",
    sourceFile,
    description: c.description,
    input: c.input,
    ...(c.expectedTier !== undefined ? { expectedTier: c.expectedTier } : {}),
    ...(c.acceptableTiers !== undefined ? { acceptableTiers: c.acceptableTiers } : {}),
    ...(c.expectRedFlagRule !== undefined ? { expectRedFlagRule: c.expectRedFlagRule } : {}),
    ...(c.expectSource !== undefined ? { expectSource: c.expectSource } : {}),
    ...(c.fakeResponse !== undefined ? { fakeResponse: c.fakeResponse } : {}),
  };
}

function redteamToLoadedCase(c: RedteamCase, sourceFile: string): LoadedCase {
  return {
    id: c.id,
    set: "redteam",
    sourceFile,
    description: c.description,
    input: c.input,
    expectRefusal: c.expectRefusal,
    ...(c.expectedTier !== undefined ? { expectedTier: c.expectedTier } : {}),
    ...(c.acceptableTiers !== undefined ? { acceptableTiers: c.acceptableTiers } : {}),
    ...(c.fakeResponse !== undefined ? { fakeResponse: c.fakeResponse } : {}),
  };
}

function loadGoldenSet(evalsDir: string): { cases: LoadedCase[]; errors: string[] } {
  const setDir = join(evalsDir, "golden");
  const cases: LoadedCase[] = [];
  const errors: string[] = [];

  for (const file of listYamlFiles(setDir)) {
    const filePath = join(setDir, file);
    let raw: unknown;
    try {
      raw = parseYaml(readFileSync(filePath, "utf8"));
    } catch (err) {
      errors.push(`${filePath}: INVALID_YAML: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    const parsed = parseEvalFile(raw, goldenEvalFileSchema);
    if (!parsed.ok) {
      errors.push(`${filePath}: ${parsed.reason}`);
      continue;
    }

    for (const c of parsed.cases) {
      cases.push(goldenToLoadedCase(c, filePath));
    }
  }

  return { cases, errors };
}

function loadRedteamSet(evalsDir: string): { cases: LoadedCase[]; errors: string[] } {
  const setDir = join(evalsDir, "redteam");
  const cases: LoadedCase[] = [];
  const errors: string[] = [];

  for (const file of listYamlFiles(setDir)) {
    const filePath = join(setDir, file);
    let raw: unknown;
    try {
      raw = parseYaml(readFileSync(filePath, "utf8"));
    } catch (err) {
      errors.push(`${filePath}: INVALID_YAML: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    const parsed = parseEvalFile(raw, redteamEvalFileSchema);
    if (!parsed.ok) {
      errors.push(`${filePath}: ${parsed.reason}`);
      continue;
    }

    for (const c of parsed.cases) {
      cases.push(redteamToLoadedCase(c, filePath));
    }
  }

  return { cases, errors };
}

/**
 * Loads + validates every golden/redteam case under `evalsDir`. Throws a
 * single aggregated error (bad files/ids) if anything is malformed;
 * otherwise returns the full, tagged, de-duplicated-by-construction case
 * list (unique ids asserted across BOTH sets).
 */
export function loadCases(evalsDir: string): LoadedCase[] {
  const golden = loadGoldenSet(evalsDir);
  const redteam = loadRedteamSet(evalsDir);

  const errors = [...golden.errors, ...redteam.errors];
  const allCases = [...golden.cases, ...redteam.cases];

  const idCounts = new Map<string, number>();
  for (const c of allCases) {
    idCounts.set(c.id, (idCounts.get(c.id) ?? 0) + 1);
  }
  for (const [id, count] of idCounts.entries()) {
    if (count > 1) {
      errors.push(`duplicate case id "${id}" (${count} occurrences across all files)`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`loadCases: malformed eval set(s):\n${errors.join("\n")}`);
  }

  return allCases;
}
