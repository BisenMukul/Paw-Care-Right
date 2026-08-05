/**
 * T095 plan step 9 — single source of truth for `expo-image`'s `cachePolicy`
 * prop across the app. Two policies, chosen by where the bytes come from:
 *
 * - REMOTE (network) images — `timeline-photo-strip`, `timeline-photo-viewer`
 *   — use `"memory-disk"`: the disk tier survives an app restart, so
 *   scrolling back into the timeline never re-downloads a photo the user
 *   already viewed.
 * - LOCAL `file://` previews — `add-pet/photo`, `photo-prompt-question`,
 *   `health-log-photo-picker`, and `pet-header-card` (its `localPhoto` is a
 *   local file handed through router params from the add-pet wizard, not a
 *   network URL — there is no `photoKey` -> URL resolver wired to it today,
 *   see that component's doc comment) — use `"memory"`: the bytes are
 *   already sitting on local disk (the picker/compressor wrote them there),
 *   so a disk-tier cache copy would be pure duplication with no benefit.
 */
export const REMOTE_IMAGE_CACHE_POLICY = "memory-disk" as const;
export const LOCAL_IMAGE_CACHE_POLICY = "memory" as const;
