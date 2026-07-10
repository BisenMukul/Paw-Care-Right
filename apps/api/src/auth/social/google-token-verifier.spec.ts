import { UnauthorizedException } from "@nestjs/common";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import type { JWK, JWTVerifyGetKey, KeyLike } from "jose";

import type { AppConfigService } from "../../config/app-config.service";
import { GOOGLE_ISSUERS, GoogleTokenVerifier } from "./google-token-verifier";

const TEST_CLIENT_ID = "pawcareright-dev.apps.googleusercontent.com";
const KEY_ID = "test-google-key-1";
const GOOGLE_DEFAULT_ISSUER: string = GOOGLE_ISSUERS[0] ?? "https://accounts.google.com";

describe("GoogleTokenVerifier", () => {
  let keyResolver: JWTVerifyGetKey;
  let signingKey: KeyLike;
  let otherSigningKey: KeyLike;

  beforeAll(async () => {
    const { privateKey, publicKey } = await generateKeyPair("RS256");
    signingKey = privateKey;

    const publicJwk = (await exportJWK(publicKey)) as JWK;
    publicJwk.kid = KEY_ID;
    publicJwk.use = "sig";
    publicJwk.alg = "RS256";

    keyResolver = createLocalJWKSet({ keys: [publicJwk] });

    // A key that is NOT in the JWKS above — used to simulate a tampered /
    // forged signature.
    const otherPair = await generateKeyPair("RS256");
    otherSigningKey = otherPair.privateKey;
  });

  function buildVerifier(): GoogleTokenVerifier {
    const config = { googleClientId: TEST_CLIENT_ID } as unknown as AppConfigService;
    return new GoogleTokenVerifier(keyResolver, config);
  }

  async function signToken(options: {
    key?: KeyLike;
    issuer?: string;
    audience?: string;
    subject?: string;
    email?: string;
    emailVerified?: boolean | string;
    expiresInSeconds?: number;
    kid?: string | undefined;
  }): Promise<string> {
    const {
      key = signingKey,
      issuer = GOOGLE_DEFAULT_ISSUER,
      audience = TEST_CLIENT_ID,
      subject = "google-subject-1",
      email,
      emailVerified,
      expiresInSeconds = 3600,
      kid = KEY_ID,
    } = options;

    const claims: Record<string, unknown> = {};
    if (email !== undefined) {
      claims.email = email;
    }
    if (emailVerified !== undefined) {
      claims.email_verified = emailVerified;
    }

    let builder = new SignJWT(claims)
      .setProtectedHeader(kid ? { alg: "RS256", kid } : { alg: "RS256" })
      .setIssuer(issuer)
      .setAudience(audience)
      .setSubject(subject)
      .setIssuedAt();

    if (expiresInSeconds < 0) {
      // setExpirationTime accepts a timestamp (seconds) for already-past times.
      builder = builder.setExpirationTime(Math.floor(Date.now() / 1000) + expiresInSeconds);
    } else {
      builder = builder.setExpirationTime(`${expiresInSeconds}s`);
    }

    return builder.sign(key);
  }

  it("has provider 'google'", () => {
    expect(buildVerifier().provider).toBe("google");
  });

  it("valid token returns the mapped identity", async () => {
    const token = await signToken({
      subject: "google-subject-1",
      email: "owner@example.com",
      emailVerified: true,
    });

    const identity = await buildVerifier().verify(token);

    expect(identity).toEqual({
      provider: "google",
      subject: "google-subject-1",
      email: "owner@example.com",
      emailVerified: true,
    });
  });

  it("accepts the second Google issuer form (no scheme)", async () => {
    const token = await signToken({
      issuer: "accounts.google.com",
      subject: "google-subject-1",
      email: "owner@example.com",
      emailVerified: true,
    });

    const identity = await buildVerifier().verify(token);

    expect(identity).toEqual({
      provider: "google",
      subject: "google-subject-1",
      email: "owner@example.com",
      emailVerified: true,
    });
  });

  it("maps email_verified boolean true to emailVerified:true", async () => {
    const token = await signToken({ email: "owner@example.com", emailVerified: true });

    const identity = await buildVerifier().verify(token);

    expect(identity.emailVerified).toBe(true);
  });

  it("maps email_verified boolean false to emailVerified:false", async () => {
    const token = await signToken({ email: "owner@example.com", emailVerified: false });

    const identity = await buildVerifier().verify(token);

    expect(identity.emailVerified).toBe(false);
  });

  it("does NOT coerce the string \"true\" — maps to emailVerified:false (strict boolean, unlike Apple)", async () => {
    const token = await signToken({ email: "owner@example.com", emailVerified: "true" });

    const identity = await buildVerifier().verify(token);

    expect(identity.emailVerified).toBe(false);
  });

  it("maps a missing email claim to email:null and emailVerified:false", async () => {
    const token = await signToken({});

    const identity = await buildVerifier().verify(token);

    expect(identity.email).toBeNull();
    expect(identity.emailVerified).toBe(false);
  });

  it("throws UnauthorizedException for a signature not matching the JWKS (tampered/forged)", async () => {
    const token = await signToken({ key: otherSigningKey });

    await expect(buildVerifier().verify(token)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("throws UnauthorizedException for the wrong audience", async () => {
    const token = await signToken({ audience: "com.someone-else.app" });

    await expect(buildVerifier().verify(token)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("throws UnauthorizedException for the wrong issuer", async () => {
    const token = await signToken({ issuer: "https://not-google.example.com" });

    await expect(buildVerifier().verify(token)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("throws UnauthorizedException for an expired token", async () => {
    const token = await signToken({ expiresInSeconds: -3600 });

    await expect(buildVerifier().verify(token)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("never logs the identity token, even on failure", async () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation();
    const errorSpy = jest.spyOn(console, "error").mockImplementation();
    const warnSpy = jest.spyOn(console, "warn").mockImplementation();
    const token = await signToken({ key: otherSigningKey });

    await expect(buildVerifier().verify(token)).rejects.toBeInstanceOf(UnauthorizedException);

    for (const spy of [logSpy, errorSpy, warnSpy]) {
      for (const call of spy.mock.calls) {
        expect(call.join(" ")).not.toContain(token);
      }
    }

    logSpy.mockRestore();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
