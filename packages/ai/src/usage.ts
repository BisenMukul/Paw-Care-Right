import type { ProviderUsage } from "./providers/types";

/**
 * Latency + cost/token capture plumbing shared by every provider. Cost is
 * plumbing only (pluggable `CostRates`, defaulting to 0) — real tariffs are
 * re-baselined later per docs/AI_PROVIDERS.md §4.
 */
export interface CostRates {
  costPerMInputUsd?: number;
  costPerMOutputUsd?: number;
}

export function startTimer(): { elapsedMs(): number } {
  const start = Date.now();
  return {
    elapsedMs(): number {
      return Date.now() - start;
    },
  };
}

export function computeUsage(input: {
  latencyMs: number;
  inputTokens?: number | undefined;
  outputTokens?: number | undefined;
  rates?: CostRates | undefined;
}): ProviderUsage {
  const { latencyMs, inputTokens, outputTokens, rates } = input;

  const totalTokens =
    inputTokens !== undefined || outputTokens !== undefined
      ? (inputTokens ?? 0) + (outputTokens ?? 0)
      : undefined;

  const costMicroUsd = computeCostMicroUsd(inputTokens, outputTokens, rates);

  const usage: ProviderUsage = { latencyMs, costMicroUsd };
  if (inputTokens !== undefined) {
    usage.inputTokens = inputTokens;
  }
  if (outputTokens !== undefined) {
    usage.outputTokens = outputTokens;
  }
  if (totalTokens !== undefined) {
    usage.totalTokens = totalTokens;
  }

  return usage;
}

function computeCostMicroUsd(
  inputTokens: number | undefined,
  outputTokens: number | undefined,
  rates: CostRates | undefined,
): number {
  if (!rates) {
    return 0;
  }

  const inputCostUsd = ((inputTokens ?? 0) / 1_000_000) * (rates.costPerMInputUsd ?? 0);
  const outputCostUsd = ((outputTokens ?? 0) / 1_000_000) * (rates.costPerMOutputUsd ?? 0);

  return Math.round((inputCostUsd + outputCostUsd) * 1_000_000);
}
