// Auth module constants. Centralized here so token TTLs, Redis key
// prefixes, and rate-limit/attempt caps are defined exactly once.

export const ACCESS_TOKEN_TTL = "15m";
export const REFRESH_TOKEN_TTL_DAYS = 30;
export const OTP_TTL_SECONDS = 600;
export const OTP_CODE_LENGTH = 6;
export const OTP_MAX_ATTEMPTS = 5;
export const RATE_LIMIT_MAX = 5;
export const RATE_LIMIT_WINDOW_SECONDS = 60;
export const OTP_KEY_PREFIX = "pawcareright:otp:";
export const RATE_LIMIT_KEY_PREFIX = "pawcareright:rl:otp:";
export const DEFAULT_LOCALE = "en";
export const DEFAULT_REGION = "US";
export const DEFAULT_HOUSEHOLD_NAME = "My Household";
