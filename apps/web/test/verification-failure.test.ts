import { test } from "node:test";
import assert from "node:assert/strict";
import { errors } from "jose";
import { signatureFailure } from "../lib/verification-failure.ts";

test("a Google key timeout is a retryable network failure, not a forged signature", () => {
  const result = signatureFailure(new errors.JWKSTimeout());
  assert.equal(result.state, "failed");
  assert.equal(result.retryable, true);
  assert.match(result.reason, /consultar as chaves/);
});

test("an invalid signature stays unverified", () => {
  const result = signatureFailure(new errors.JWSSignatureVerificationFailed());
  assert.equal(result.state, "failed");
  assert.equal(result.retryable, false);
  assert.match(result.reason, /não confere/);
});

test("expired proofs and invalid claims cannot become a green check", () => {
  for (const error of [new errors.JWTExpired("Expired", {}, "exp"), new errors.JWTClaimValidationFailed("Invalid", {}, "aud")]) {
    const result = signatureFailure(error);
    assert.equal(result.state, "failed");
    assert.equal(result.retryable, false);
  }
});
