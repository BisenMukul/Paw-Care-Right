/**
 * DI tokens for the chat module's provider seam (T081). Mirrors the
 * `TRIAGE_TEXT_PROVIDER`/`TRIAGE_TEXT_MODEL_ID` symbol-token pattern in
 * `apps/api/src/workers/check-runner.tokens.ts`. No logic here.
 */
export const CHAT_TEXT_PROVIDER = Symbol("CHAT_TEXT_PROVIDER");
export const CHAT_TEXT_MODEL_ID = Symbol("CHAT_TEXT_MODEL_ID");
