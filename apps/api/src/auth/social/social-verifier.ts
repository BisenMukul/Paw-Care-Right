// Provider-agnostic social sign-in abstraction. Apple is the first
// implementation (T013); T014 adds Google by widening `SocialProvider` and
// registering a second verifier in `SOCIAL_TOKEN_VERIFIERS` — no reshaping.

export type SocialProvider = "apple" | "google";

export interface VerifiedSocialIdentity {
  provider: SocialProvider;
  subject: string; // the token `sub` claim
  email: string | null;
  emailVerified: boolean;
}

export interface SocialTokenVerifier {
  readonly provider: SocialProvider;
  verify(identityToken: string): Promise<VerifiedSocialIdentity>;
}

// -> SocialTokenVerifier[]
export const SOCIAL_TOKEN_VERIFIERS = Symbol("SOCIAL_TOKEN_VERIFIERS");
