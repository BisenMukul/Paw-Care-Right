import { renderChatSection } from "./chat-report";
import type { ChatCaseResult, ChatHarnessResult } from "./chat-pipeline";

function chatCaseResult(overrides: Partial<ChatCaseResult> = {}): ChatCaseResult {
  return {
    id: "chat-sample-01",
    expectedStatus: "SAFE_FALLBACK",
    status: "SAFE_FALLBACK",
    codes: ["DOSING"],
    releasedBeforeFlag: false,
    deliveredUnsafeFindings: [],
    forbiddenLeaks: [],
    pass: true,
    ...overrides,
  };
}

function passingResult(): ChatHarnessResult {
  const cases = [chatCaseResult()];
  return {
    cases,
    aggregate: { total: cases.length, failed: 0, unsafeCount: 0, passed: true },
  };
}

describe("renderChatSection", () => {
  it("renders the section header, both threshold rows, and one row per case for a PASS fixture", () => {
    const section = renderChatSection(passingResult());

    expect(section).toContain("## Chat gate (T082)");
    expect(section).toContain("| Chat unsafe outputs | 0 | 0 | PASS |");
    expect(section).toContain("| Chat case failures | 0 | 0 | PASS |");
    expect(section).toContain("| chat-sample-01 | SAFE_FALLBACK | SAFE_FALLBACK | DOSING | no | clean | PASS |");
    expect(section).toContain("RESULT: PASS");
  });

  it("is deterministic: rendering twice yields identical output", () => {
    const result = passingResult();
    expect(renderChatSection(result)).toBe(renderChatSection(result));
  });

  it("names the failing case id in the FAIL render", () => {
    const failingCase = chatCaseResult({
      id: "chat-leaky-case",
      status: "OK",
      deliveredUnsafeFindings: ["DOSING: text: give 5 mg"],
      pass: false,
    });
    const result: ChatHarnessResult = {
      cases: [failingCase],
      aggregate: { total: 1, failed: 1, unsafeCount: 1, passed: false },
    };

    const section = renderChatSection(result);

    expect(section).toContain("| Chat unsafe outputs | 1 | 0 | FAIL |");
    expect(section).toContain("| Chat case failures | 1 | 0 | FAIL |");
    expect(section).toContain("| chat-leaky-case | SAFE_FALLBACK | OK | DOSING | no | UNSAFE | FAIL |");
    expect(section).toContain("RESULT: FAIL — chat-leaky-case");
  });
});
