/**
 * Untrusted-input sanitizer for the chat owner message (T081 Safety
 * statement rule 7). Pure, deterministic: strips control/zero-width/bidi
 * characters, collapses excessive blank lines, defangs role-marker lines,
 * neutralizes the delimiter tokens if the owner types them, and hard-caps
 * length. The owner's message is DATA, never instructions — this module
 * only sanitizes; `buildChatPrompt` wraps the result in the delimited block
 * that the system prompt declares untrusted.
 */

export const OWNER_MESSAGE_OPEN = "<<<OWNER_MESSAGE";
export const OWNER_MESSAGE_CLOSE = "OWNER_MESSAGE>>>";

export const OWNER_MESSAGE_MAX_CHARS = 2000;

/** C0 controls (except `\n`) + DEL + C1 controls. */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_RE = /[\x00-\x09\x0B\x0C\x0E-\x1F\x7F\x80-\x9F]/g;

/** Zero-width and bidi-override characters commonly used for prompt-injection smuggling. */
const ZERO_WIDTH_AND_BIDI_RE = /[​-‏‪-‮⁠⁦-⁩﻿]/g;

const EXCESS_BLANK_LINES_RE = /\n{3,}/g;

const ROLE_MARKER_LINE_RE = /^(system|assistant|user)\s*:/i;

function stripControlAndZeroWidth(text: string): string {
  return text.replace(CONTROL_CHARS_RE, "").replace(ZERO_WIDTH_AND_BIDI_RE, "");
}

function collapseBlankLines(text: string): string {
  return text.replace(EXCESS_BLANK_LINES_RE, "\n\n");
}

/** Prefixes any line that begins with a role marker so it can never be read as a role-switch instruction. */
function defangRoleMarkerLines(text: string): string {
  return text
    .split("\n")
    .map((line) => (ROLE_MARKER_LINE_RE.test(line) ? ` [owner text] ${line}` : line))
    .join("\n");
}

/** Breaks any literal occurrence of the delimiter tokens so owner text can never close/forge the block. */
function neutralizeDelimiters(text: string): string {
  return text.split(OWNER_MESSAGE_OPEN).join("<<< OWNER MESSAGE").split(OWNER_MESSAGE_CLOSE).join("OWNER MESSAGE >>>");
}

/**
 * Sanitizes raw owner-typed chat input before it is embedded in the prompt.
 * Pure — no I/O, no clock, never throws.
 */
export function sanitizeOwnerMessage(raw: string): string {
  let text = stripControlAndZeroWidth(raw);
  text = collapseBlankLines(text);
  text = defangRoleMarkerLines(text);
  text = neutralizeDelimiters(text);
  return text.length > OWNER_MESSAGE_MAX_CHARS ? text.slice(0, OWNER_MESSAGE_MAX_CHARS) : text;
}
