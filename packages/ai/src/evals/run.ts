/* eslint-disable no-console -- CLI entrypoint: stdout summary is the legitimate UI here (plan "R-entry"), not app logging. */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { getTextProvider } from "../registry";
import type { TextProvider } from "../providers/types";

import { runChatCases, type ChatHarnessResult } from "./chat-pipeline";
import { renderChatSection } from "./chat-report";
import { loadChatCases } from "./chat-load";
import { resolveMode, runHarness } from "./harness";
import { loadCases } from "./load";
import { evalsDir, findRepoRoot, reportsDir } from "./paths";
import { renderReport } from "./report";
import type { HarnessResult, RunMode } from "./types";

/** `<ISO-compact>.md` filename (colons/dots stripped so it is filesystem-safe everywhere). */
function reportFilename(timestamp: string): string {
  return `${timestamp.replace(/[:.]/g, "-")}.md`;
}

function logSummary(result: HarnessResult, mode: RunMode, reportPath: string, latestPath: string): void {
  console.log(
    `AI eval harness: mode=${mode} cases=${result.aggregate.total} (golden ${result.aggregate.golden}, redteam ${result.aggregate.redteam}) thresholdsPassed=${result.thresholdsPassed}`,
  );
  console.log(`Report written: ${reportPath}`);
  console.log(`Latest report:  ${latestPath}`);

  if (!result.thresholdsPassed) {
    console.log("FAILED thresholds:");
    for (const threshold of result.thresholds.filter((t) => !t.pass)) {
      console.log(`  - ${threshold.key}: actual=${threshold.actual} target=${threshold.target}`);
    }
  }
}

/**
 * CLI entrypoint (plan step 8/"R-entry"): resolve mode -> `loadCases` ->
 * `runHarness` -> `renderReport` -> write `<timestamp>.md` + `latest.md` ->
 * print summary -> `process.exit(thresholdsPassed ? 0 : 1)`. T082 appends
 * the chat gate's `loadChatCases` -> `runChatCases` -> `renderChatSection`
 * run after the existing triage harness run — the triage counts/thresholds
 * and `renderReport` output are byte-identical to T081; the chat section is
 * additive, and the chat gate's own failures now also fail the process exit
 * code (a chat-case regression must show up in the report this CLI writes).
 */
export async function main(): Promise<void> {
  const repoRoot = findRepoRoot();
  const mode = resolveMode(process.env);

  const cases = loadCases(evalsDir(repoRoot));
  const sharedProvider: TextProvider | undefined = mode === "real" ? getTextProvider() : undefined;

  const result = await runHarness({
    cases,
    mode,
    ...(sharedProvider !== undefined ? { sharedProvider } : {}),
  });

  const chatCases = loadChatCases(evalsDir(repoRoot));
  const chatResult: ChatHarnessResult = await runChatCases(chatCases);

  const timestamp = new Date().toISOString();
  const report = `${renderReport(result, { timestamp })}\n\n${renderChatSection(chatResult)}`;

  const dir = reportsDir(repoRoot);
  mkdirSync(dir, { recursive: true });
  const reportPath = join(dir, reportFilename(timestamp));
  const latestPath = join(dir, "latest.md");
  writeFileSync(reportPath, report, "utf8");
  writeFileSync(latestPath, report, "utf8");

  logSummary(result, mode, reportPath, latestPath);
  console.log(`AI eval harness (chat gate): cases=${chatResult.aggregate.total} passed=${chatResult.aggregate.passed}`);

  process.exit(result.thresholdsPassed && chatResult.aggregate.passed ? 0 : 1);
}

main().catch((err: unknown) => {
  console.error("AI eval harness crashed:", err);
  process.exit(1);
});
