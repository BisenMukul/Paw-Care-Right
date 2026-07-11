import { randomInt } from "node:crypto";

/**
 * 32-symbol unambiguous alphabet (uppercase letters + digits, minus the
 * visually-confusable `I`, `O`, `0`, `1`) used to mint invite codes. 8 chars
 * over this alphabet is a ~1.1x10^12 code space — see plan Risk R3.
 */
export const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const INVITE_CODE_LENGTH = 8;
export const INVITE_CODE_REGEX = /^[A-HJ-NP-Z2-9]{8}$/;

/** Generates an 8-char invite code via unbiased `crypto.randomInt` sampling. */
export function generateInviteCode(): string {
  let code = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i += 1) {
    code += INVITE_CODE_ALPHABET[randomInt(0, INVITE_CODE_ALPHABET.length)];
  }
  return code;
}
