/**
 * Chat module constants (T081). No business logic here.
 */

/** Newest N prior turns replayed into the prompt (oldest-first), before the current turn. */
export const CHAT_HISTORY_TURNS = 10;

/** The digest window read once per message via `Date.now()` in `ChatService` (plan step "Endpoint specs"). */
export const CHAT_DIGEST_WINDOW_DAYS = 90;

/** Hard provider timeout for the whole streamed answer (plan decision D1). */
export const CHAT_STREAM_TIMEOUT_MS = 60_000;

/** Max un-released buffer (chars) before a forced boundary scan+release, even absent a sentence boundary. */
export const CHAT_RELEASE_BOUNDARY_CHARS = 160;
