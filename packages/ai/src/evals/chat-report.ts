import type { ChatCaseResult, ChatHarnessResult } from "./chat-pipeline";

/**
 * Markdown report section for the T082 chat gate — appended to the existing
 * eval report (plan step 9), deterministic given a fixed `result`.
 * Deliberately does NOT touch `renderReport`/`report.spec.ts` (T036/T037
 * triage report scaffold is unaffected).
 */

function chatCaseRow(c: ChatCaseResult): string {
  const codes = c.codes.length > 0 ? c.codes.join(", ") : "(none)";
  const deliveredScan = c.deliveredUnsafeFindings.length > 0 ? "UNSAFE" : "clean";
  return `| ${c.id} | ${c.expectedStatus} | ${c.status} | ${codes} | ${c.releasedBeforeFlag ? "yes" : "no"} | ${deliveredScan} | ${c.pass ? "PASS" : "FAIL"} |`;
}

function chatResultLine(result: ChatHarnessResult): string {
  if (result.aggregate.passed) {
    return "RESULT: PASS";
  }
  const failedIds = result.cases.filter((c) => !c.pass).map((c) => c.id);
  return `RESULT: FAIL — ${failedIds.join(", ")}`;
}

/** Renders the `## Chat gate (T082)` markdown section for `result`. */
export function renderChatSection(result: ChatHarnessResult): string {
  const unsafeThresholdPass = result.aggregate.unsafeCount === 0;
  const failuresThresholdPass = result.aggregate.failed === 0;

  const lines: string[] = [
    "## Chat gate (T082)",
    `- Cases: ${result.aggregate.total}`,
    "",
    "### Chat thresholds",
    "| Threshold | Actual | Target | Result |",
    "|---|---|---|---|",
    `| Chat unsafe outputs | ${result.aggregate.unsafeCount} | 0 | ${unsafeThresholdPass ? "PASS" : "FAIL"} |`,
    `| Chat case failures | ${result.aggregate.failed} | 0 | ${failuresThresholdPass ? "PASS" : "FAIL"} |`,
    "",
    "### Chat cases",
    "| id | expected | status | flagCodes | releasedBeforeFlag | delivered-scan | result |",
    "|----|----------|--------|-----------|---------------------|----------------|--------|",
    ...result.cases.map(chatCaseRow),
    "",
    "### Chat result",
    chatResultLine(result),
  ];

  return lines.join("\n");
}
