/**
 * Chat module constants (T081). No business logic here.
 */

/** Newest N prior turns replayed into the prompt (oldest-first), before the current turn. */
export const CHAT_HISTORY_TURNS = 10;

/** The digest window read once per message via `Date.now()` in `ChatService` (plan step "Endpoint specs"). */
export const CHAT_DIGEST_WINDOW_DAYS = 90;

/** Hard provider timeout for the whole streamed answer (plan decision D1). */
export const CHAT_STREAM_TIMEOUT_MS = 60_000;

// T082 D8: release/scan boundary policy now lives in `@pawcareright/ai`'s
// `output-gate.ts` (`CHAT_RELEASE_BOUNDARY_CHARS` / `CHAT_SCAN_OVERLAP_CHARS`)
// — a copy here would be a silent fork of a safety constant.
