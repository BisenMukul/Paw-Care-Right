/* eslint-disable no-console -- CLI entrypoint: stdout summary is the legitimate UI here (plan "R-entry"), matching evals/run.ts:1. */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  breedGuideRowSchema,
  catBreeds,
  dogBreeds,
  TOP_CAT_BREED_GUIDE_SLUGS,
  TOP_DOG_BREED_GUIDE_SLUGS,
  type Breed,
  type BreedGuideRow,
  type BreedSpecies,
} from "@pawcareright/data";

import { loadAiEnv } from "../env.schema";
import { resolveMode } from "../evals/harness";
import { findRepoRoot } from "../evals/paths";
import { getTextProvider } from "../registry";
import type { TextProvider } from "../providers/types";

import { draftBreedGuideRow, mergeBreedGuides, type DraftBreedGuideRowResult } from "./breed-guide-draft";

/** `packages/data/src/breed-guides` — the only directory this CLI ever reads/writes. */
function breedGuidesDir(repoRoot: string): string {
  return join(repoRoot, "packages", "data", "src", "breed-guides");
}

/** Reads one species JSON file as an array of `BreedGuideRow`; a missing file reads as `[]`. */
function readExistingRows(filePath: string): BreedGuideRow[] {
  if (!existsSync(filePath)) {
    return [];
  }
  const raw: unknown = JSON.parse(readFileSync(filePath, "utf8"));
  const list = Array.isArray(raw) ? raw : [];
  return list.map((row) => breedGuideRowSchema.parse(row));
}

function findBreedOrExit(slug: string, breeds: readonly Breed[], species: BreedSpecies): Breed {
  const breed = breeds.find((b) => b.slug === slug);
  if (!breed) {
    console.error(`generate-breed-guides: pinned slug "${slug}" (${species}) not found in the breeds dataset`);
    process.exit(1);
  }
  return breed;
}

interface SpeciesRunResult {
  rows: BreedGuideRow[];
  written: number;
  skippedReviewed: number;
  providerRejected: number;
}

async function draftSpecies(
  slugs: readonly string[],
  breeds: readonly Breed[],
  species: BreedSpecies,
  existing: readonly BreedGuideRow[],
  provider: TextProvider | undefined,
  model: string,
): Promise<SpeciesRunResult> {
  const existingBySlug = new Map(existing.map((row) => [row.slug, row]));
  const results: DraftBreedGuideRowResult[] = [];

  for (const slug of slugs) {
    const breed = findBreedOrExit(slug, breeds, species);
    // Sequential (not Promise.all) drafting keeps CLI output deterministic and easy to audit,
    // mirroring evals/harness.ts's sequential runHarness loop.
    const result = await draftBreedGuideRow(breed, provider, model);
    results.push(result);
  }

  const rows = mergeBreedGuides(existing, results.map((r) => r.row));

  let skippedReviewed = 0;
  for (const slug of slugs) {
    if (existingBySlug.get(slug)?.reviewed === true) {
      skippedReviewed += 1;
    }
  }

  const providerRejected = results.filter((r) => r.rejectedReason !== undefined).length;

  return { rows, written: slugs.length - skippedReviewed, skippedReviewed, providerRejected };
}

/**
 * CLI entrypoint (plan "CLI behaviour"): `findRepoRoot` -> read the two JSON
 * files (missing file ⇒ `[]`) -> for each pinned slug resolve its `Breed`
 * (missing slug ⇒ hard error, non-zero exit) -> `draftBreedGuideRow`
 * (provider mode via the existing `resolveMode`, template mode otherwise;
 * any provider rejection or throw already falls back to the template draft
 * and is counted) -> `mergeBreedGuides` per species -> write
 * `JSON.stringify(rows, null, 2) + "\n"` -> print
 * written/skipped(reviewed)/provider-rejected counts. Never flips
 * `reviewed`, never deletes a row, never touches a file outside
 * `packages/data/src/breed-guides/`.
 */
export async function main(): Promise<void> {
  const repoRoot = findRepoRoot();
  const dir = breedGuidesDir(repoRoot);
  const dogsPath = join(dir, "dogs.json");
  const catsPath = join(dir, "cats.json");

  const existingDogs = readExistingRows(dogsPath);
  const existingCats = readExistingRows(catsPath);

  const mode = resolveMode(process.env);
  const provider: TextProvider | undefined = mode === "real" ? getTextProvider() : undefined;
  const model = loadAiEnv(process.env).AI_TEXT_MODEL;

  const dogResult = await draftSpecies(TOP_DOG_BREED_GUIDE_SLUGS, dogBreeds, "DOG", existingDogs, provider, model);
  const catResult = await draftSpecies(TOP_CAT_BREED_GUIDE_SLUGS, catBreeds, "CAT", existingCats, provider, model);

  writeFileSync(dogsPath, `${JSON.stringify(dogResult.rows, null, 2)}\n`, "utf8");
  writeFileSync(catsPath, `${JSON.stringify(catResult.rows, null, 2)}\n`, "utf8");

  const written = dogResult.written + catResult.written;
  const skippedReviewed = dogResult.skippedReviewed + catResult.skippedReviewed;
  const providerRejected = dogResult.providerRejected + catResult.providerRejected;

  console.log(
    `generate-breed-guides: mode=${mode} written=${written} skipped(reviewed)=${skippedReviewed} provider-rejected=${providerRejected}`,
  );
}

main().catch((err: unknown) => {
  console.error("generate-breed-guides crashed:", err);
  process.exit(1);
});
