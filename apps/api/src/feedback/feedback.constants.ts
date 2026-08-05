/**
 * T104 plan D4/step 6: mirrors `apps/api/src/photos/photos.constants.ts`'s
 * fuzz-resistant namespace checks, adapted to a per-USER (not per-pet) S3
 * prefix -- `feedback/<userId>/<uuid>.jpg`.
 */

export const FEEDBACK_PREFIX = "feedback/";

/** Namespace every screenshot upload for `userId` must live under. */
export function feedbackKeyPrefix(userId: string): string {
  return `${FEEDBACK_PREFIX}${userId}/`;
}

/** `feedback/<userId>/<uuid>.jpg` -- the key the client PUTs the screenshot to. */
export function buildScreenshotKey(userId: string, uuid: string): string {
  return `${feedbackKeyPrefix(userId)}${uuid}.jpg`;
}

/** True iff `key` is a single flat object under this user's feedback
 *  namespace. Rejects a foreign prefix, path-traversal (`..`) and any extra
 *  `/` segment. */
export function isKeyInFeedbackNamespace(userId: string, key: string): boolean {
  const prefix = feedbackKeyPrefix(userId);
  if (!key.startsWith(prefix)) return false;
  const remainder = key.slice(prefix.length);
  if (remainder.length === 0) return false;
  if (remainder.includes("/")) return false;
  if (remainder.includes("..")) return false;
  return true;
}
