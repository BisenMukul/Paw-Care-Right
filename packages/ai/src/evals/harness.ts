import { FakeTextProvider } from "../providers/fake";
import type { TextProvider } from "../providers/types";

import { defaultFakeResponseText, runCase } from "./pipeline";
import { aggregate, evaluateThresholds, scoreCase } from "./score";
import type { CaseResult, HarnessResult, LoadedCase, RunMode } from "./types";

/**
 * Provider-injectable, file-I/O-free harness orchestration (plan step 8).
 * `runHarness` is what `run.ts` (and `harness.spec.ts`) call; it never
 * touches the filesystem and never calls `process.exit` — those concerns
 * live in the CLI entrypoint (`run.ts`) only.
 */

export interface RunHarnessOptions {
  cases: LoadedCase[];
  mode: RunMode;
  sharedProvider?: TextProvider;
}

/**
 * Returns `"real"` ONLY when a genuine (non-placeholder) Ollama Cloud key is
 * configured for the ollama text provider; otherwise `"fake"` — CI has no
 * such key, so it always resolves to `"fake"` and stays deterministic (plan
 * "R-provider").
 */
export function resolveMode(env: NodeJS.ProcessEnv): RunMode {
  const provider = env.AI_TEXT_PROVIDER;
  const key = env.OLLAMA_CLOUD_API_KEY;

  const hasGenuineKey = typeof key === "string" && key.trim().length > 0 && !key.startsWith("example-");
  if (provider === "ollama" && hasGenuineKey) {
    return "real";
  }
  return "fake";
}

/**
 * Resolves the `TextProvider` to use for one case: a fresh, deterministic
 * `FakeTextProvider` per case in fake mode (seeded from the case's
 * `fakeResponse`, or the safe-fallback default when omitted), or the single
 * shared real provider in real mode.
 */
export function providerForCase(mode: RunMode, caseDef: LoadedCase, sharedProvider?: TextProvider): TextProvider {
  if (mode === "real") {
    if (!sharedProvider) {
      throw new Error("providerForCase: real mode requires a sharedProvider");
    }
    return sharedProvider;
  }

  return new FakeTextProvider({
    canned: {
      text: caseDef.fakeResponse ?? defaultFakeResponseText(),
      model: "fake-eval-provider",
      usage: { latencyMs: 1 },
    },
  });
}

/** Runs every case through the pipeline, scores it, and aggregates + evaluates thresholds. */
export async function runHarness(opts: RunHarnessOptions): Promise<HarnessResult> {
  const caseResults: CaseResult[] = [];

  for (const caseDef of opts.cases) {
    const provider = providerForCase(opts.mode, caseDef, opts.sharedProvider);
    // Cases run sequentially (not Promise.all) for deterministic, easy-to-audit reports.
    const outcome = await runCase(caseDef, provider);
    caseResults.push(scoreCase(caseDef, outcome));
  }

  const agg = aggregate(caseResults);
  const { thresholds, thresholdsPassed } = evaluateThresholds(caseResults, agg);

  return { mode: opts.mode, cases: caseResults, aggregate: agg, thresholds, thresholdsPassed };
}
