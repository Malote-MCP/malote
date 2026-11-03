import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { verifyBuild } from "../lib/build-provenance.ts";

// Public bundle from GitHub for the production worker. No credentials or private keys.
const bundle = JSON.parse(readFileSync(new URL("./fixtures/worker-provenance.json", import.meta.url), "utf8"));
const digest = "sha256:bd1c4d5ba8095feceb72e8692a6b36fb79e236ba1af556514e731624d789750c";

test("verified workflow provenance links the exact image digest to its public Git commit", async () => {
  const result = await verifyBuild(bundle, digest);
  assert.equal(result.commit, "7f83d00935ad2f8ac33be2c14b34df396cec1701");
  assert.equal(result.digest, digest);
  assert.match(result.buildUrl, /actions\/runs\/40990291555\/attempts\/1$/);
});

test("a valid signature for another image cannot verify the requested digest", async () => {
  await assert.rejects(verifyBuild(bundle, `sha256:${"0".repeat(64)}`), /proveniência/);
});

test("changing the commit in the signed statement invalidates the proof", async () => {
  const changed = structuredClone(bundle);
  const statement = JSON.parse(Buffer.from(changed.dsseEnvelope.payload, "base64").toString());
  statement.predicate.buildDefinition.resolvedDependencies[0].digest.gitCommit = "0".repeat(40);
  changed.dsseEnvelope.payload = Buffer.from(JSON.stringify(statement)).toString("base64");
  await assert.rejects(verifyBuild(changed, digest));
});

test("missing or malformed digests never verify", async () => {
  for (const value of ["", "sha256:", "sha256:invalid"]) await assert.rejects(verifyBuild(bundle, value), /Digest inválido/);
});
