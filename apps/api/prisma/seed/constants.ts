/**
 * Fixed demo-seed identifiers (SEEDER-1 plan).
 *
 * All UUIDs share the "00000000-0000-4000-8000-0000000001xx" namespace —
 * deliberately distinct from the pre-existing dev fixture's
 * "00000000-0000-4000-8000-000000000001"/"...002" ids in `../seed.ts` — so
 * `wipeDemo` can delete-by-id exactly and NEVER touch the dev fixture (or
 * any other non-demo row). Nothing here is randomised; every value is a
 * plain literal so two runs of `buildDemo`/`persistDemo` produce byte-
 * identical rows (modulo server-generated child-row ids — see
 * `persist.ts`'s wipe-and-recreate strategy, plan Risk R3).
 */

// ---- users ----
export const OWNER_EMAIL = "owner@pawcareright.local";
export const FAMILY_EMAIL = "family@pawcareright.local";

export const OWNER_USER_ID = "00000000-0000-4000-8000-000000000110";
export const FAMILY_USER_ID = "00000000-0000-4000-8000-000000000111";

export const DEMO_LOCALE = "en";
export const DEMO_REGION = "US";

// ---- households ----
export const DEMO_HOUSEHOLD_ID = "00000000-0000-4000-8000-000000000120";
export const DEMO_HOUSEHOLD_NAME = "The Demo Household";

/**
 * `F`'s throwaway OWNED household (plan Risk R1): exists solely so
 * `provisionOrGetUser`/`AuthService.refresh` find an owned household for
 * `F` and OTP login does not 500. It carries zero memberships and never
 * surfaces on any screen (every data screen resolves scope via `F`'s
 * single real membership in `DEMO_HOUSEHOLD_ID`).
 */
export const FAMILY_EMPTY_HOUSEHOLD_ID = "00000000-0000-4000-8000-000000000121";
export const FAMILY_EMPTY_HOUSEHOLD_NAME = "Unused";

// ---- memberships ----
export const OWNER_MEMBERSHIP_ID = "00000000-0000-4000-8000-000000000140";
export const FAMILY_MEMBERSHIP_ID = "00000000-0000-4000-8000-000000000141";

// ---- pets ----
export const BUDDY_PET_ID = "00000000-0000-4000-8000-000000000130";
export const CLEO_PET_ID = "00000000-0000-4000-8000-000000000131";
export const LUNA_PET_ID = "00000000-0000-4000-8000-000000000132";

// ---- devices ----
export const OWNER_DEVICE_ID = "00000000-0000-4000-8000-000000000150";
export const FAMILY_DEVICE_ID = "00000000-0000-4000-8000-000000000151";
export const OWNER_PUSH_TOKEN = "ExponentPushToken[demo-owner]";
export const FAMILY_PUSH_TOKEN = "ExponentPushToken[demo-family]";

// ---- scheduling ----
export const DEMO_TIMEZONE = "America/New_York";
export const DEMO_COUNTRY = "US";

// ---- checks ----
export const DEMO_MODEL_ID = "demo-seed-fixture";
export const DEMO_PROMPT_VERSION = "v1";

// ---- subscription ----
export const DEMO_SUBSCRIPTION_RAW_EVENT_ID = "demo-seed-family-annual-purchase";
