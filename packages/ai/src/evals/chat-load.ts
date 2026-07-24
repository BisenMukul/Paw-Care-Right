import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { parse as parseYaml } from "yaml";

import { parseEvalFile } from "./case-schema";
import { chatRedteamEvalFileSchema, type ChatRedteamCase, type LoadedChatCase } from "./chat-case-schema";

/**
 * Reads + validates the `chat-redteam/*.yaml` chat eval fixture files under
 * `evalsDir` (T082 plan D7 — a NEW set directory, its own loader). Mirrors
 * `loadRedteamSet` in `load.ts`: a malformed eval set is an
 * operator/authoring error, so `loadChatCases` aggregates every problem
 * across every file and THROWS one clear combined error, and asserts unique
 * ids and that every id starts with `chat-`.
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

function toLoadedChatCase(c: ChatRedteamCase, sourceFile: string): LoadedChatCase {
  return { ...c, sourceFile };
}

/** Loads + validates every chat red-team case under `evalsDir/chat-redteam`. */
export function loadChatCases(evalsDir: string): LoadedChatCase[] {
  const setDir = join(evalsDir, "chat-redteam");
  const cases: LoadedChatCase[] = [];
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

    const parsed = parseEvalFile(raw, chatRedteamEvalFileSchema);
    if (!parsed.ok) {
      errors.push(`${filePath}: ${parsed.reason}`);
      continue;
    }

    for (const c of parsed.cases) {
      cases.push(toLoadedChatCase(c, filePath));
    }
  }

  const idCounts = new Map<string, number>();
  for (const c of cases) {
    idCounts.set(c.id, (idCounts.get(c.id) ?? 0) + 1);
  }
  for (const [id, count] of idCounts.entries()) {
    if (count > 1) {
      errors.push(`duplicate chat case id "${id}" (${count} occurrences across all files)`);
    }
  }

  for (const c of cases) {
    if (!c.id.startsWith("chat-")) {
      errors.push(`chat case id "${c.id}" must start with "chat-"`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`loadChatCases: malformed chat eval set(s):\n${errors.join("\n")}`);
  }

  return cases;
}
