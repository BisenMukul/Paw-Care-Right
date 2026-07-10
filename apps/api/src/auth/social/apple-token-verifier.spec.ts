import { UnauthorizedException } from "@nestjs/common";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import type { JWK, JWTVerifyGetKey, KeyLike } from "jose";

import type { AppConfigService } from "../../config/app-config.service";
import { APPLE_ISSUER, AppleTokenVerifier } from "./apple-token-verifier";

const TEST_CLIENT_ID = "com.pawcareright.app";
const KEY_ID = "test-key-1";

describe("AppleTokenVerifier", () => {
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

  function buildVerifier(): AppleTokenVerifier {
    const config = { appleClientId: TEST_CLIENT_ID } as unknown as AppConfigService;
    return new AppleTokenVerifier(keyResolver, config);
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
      issuer = APPLE_ISSUER,
      audience = TEST_CLIENT_ID,
      subject = "apple-subject-1",
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

  it("has provider 'apple'", () => {
    expect(buildVerifier().provider).toBe("apple");
  });

  it("valid token returns the mapped identity", async () => {
    const token = await signToken({
      subject: "apple-subject-1",
      email: "owner@example.com",
      emailVerified: true,
    });

    const identity = await buildVerifier().verify(token);

    expect(identity).toEqual({
      provider: "apple",
      subject: "apple-subject-1",
      email: "owner@example.com",
      emailVerified: true,
    });
  });

  it("treats email_verified as the string \"true\" as verified", async () => {
    const token = await signToken({ email: "owner@example.com", emailVerified: "true" });

    const identity = await buildVerifier().verify(token);

    expect(identity.emailVerified).toBe(true);
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
    const token = await signToken({ issuer: "https://not-apple.example.com" });

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
