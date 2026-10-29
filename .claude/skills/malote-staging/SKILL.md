---
name: malote-staging
description: Test Malote on the staging enclave (Google Confidential Space VM + Cloud Run panel). Use when asked to test, smoke-test, verify, start/stop, or deploy a new worker version to staging, or to check what the staging enclave is running.
---

# Malote staging

Staging is a real confidential VM in Google Cloud (`malote-513023`, `southamerica-east1`), plus a panel on Cloud Run
and a `staging` branch on Neon. It is **off by default**: it stops itself 3 hours after each start, and starts only
when someone asks. Production (Fly.io, `malote.io`) is a separate environment; nothing here touches it.

| What | Where |
|---|---|
| Panel (Cloud Run) | https://malote-web-staging-347216371802.southamerica-east1.run.app |
| Enclave (MCP, tokens, attestation) | https://mcp-staging.malote.io (`/mcp`, `/v1/tokens`, `/v1/attestation`) |
| VM | `malote-enclave-staging`, zone `southamerica-east1-a`, `n2d-highcpu-2`, AMD SEV |
| Database | Neon project `restless-pond-99035085`, branch `staging` |
| Images trusted on staging | `infra/gcp/allowed-digests/staging.txt` (last line = current) |
| Test account | `luvi+staging@germanos.ws`; password and an MCP token in Secret Manager (`staging-test-user-password`, `staging-test-token`) |

gcloud lives at `~/google-cloud-sdk/bin` (the scripts add it to `PATH`). Never print secret values; the scripts read
them from Secret Manager themselves.

## Test flow

Run from the repo root, in this order:

1. **Start** (takes ~1–2 min, waits for HTTPS):
   ```sh
   infra/gcp/start.sh staging
   ```
2. **Verify what is running** — Google-signed attestation, debug off, our nonce, the TLS key of this very connection,
   and the expected image digest:
   ```sh
   (cd apps/worker && node --import tsx scripts/verify-attestation.ts mcp-staging.malote.io \
     "$(tail -1 ../../infra/gcp/allowed-digests/staging.txt | cut -d' ' -f2)")
   ```
3. **Smoke test** — web sign-in → Neon Auth JWT → enclave token API → MCP; also checks the web app's old MCP/token
   routes answer 410 and MCP without a token answers 401:
   ```sh
   infra/gcp/smoke-staging.sh
   ```
4. **Manual WhatsApp test (needs the user)** — staging uses the user's personal number as an extra linked device.
   They sign in to the panel, generate a token, scan the QR code, then in Claude Code:
   `claude mcp add --transport http malote-staging https://mcp-staging.malote.io/mcp --header "Authorization: Bearer <token>"`
   and try list_chats, search_messages, send_message to "me", download_media. Only the user can do this part.
5. **Stop** when done (otherwise it stops by itself 3 h after the start):
   ```sh
   infra/gcp/stop.sh staging
   ```

Report each step's output plainly; if any check prints ✗, stop and show it.

## Deploying a new worker version to staging

Every push to `main` builds the worker image reproducibly and publishes it (workflow `publish-worker`). The digest is in
the run summary and must equal the `reproducible-worker` digest from the `ci` run of the same commit.

```sh
gh run list -R Malote-MCP/malote --workflow publish-worker --limit 1        # find the run
gh run view <run-id> -R Malote-MCP/malote --log | grep -o 'worker@sha256:[0-9a-f]*' | head -1
infra/gcp/allow-digest.sh staging sha256:<digest>   # grants the staging secrets to that digest, appends to allowed-digests/staging.txt
infra/gcp/launch.sh staging sha256:<digest>         # recreates the VM on that image (keeps the 3 h limit)
git add infra/gcp/allowed-digests/staging.txt && git commit -m "Allow worker image <short> for the staging enclave" && git push origin HEAD:main
```

Then run the test flow from step 2. Migrations: apply new ones to the staging branch before launching
(`DATABASE_URL_UNPOOLED="$(gcloud secrets versions access latest --secret=staging-database-url-unpooled --project malote-513023)" node --import tsx packages/db/src/migrate.ts`, run from `packages/db`).

The panel (Cloud Run `malote-web-staging`) is rebuilt with Cloud Build (service account `malote-build`, source bucket
`gs://malote-513023-build-src`) and redeployed with `gcloud run deploy … --no-invoker-iam-check` — that flag is required:
an org policy forbids granting `allUsers`.

## Rules

- Only one worker per database. Never run a local worker against production or staging while the enclave is up;
  use a throwaway Neon branch for local runs.
- Never pass secrets as environment variables to the enclave: Confidential Space publishes the container env in
  every attestation token. Secrets go to Secret Manager as `staging-<name>` and are read through attestation.
- The image launch policy only allows `MALOTE_ENV`; don't add other overrides.
- DNS changes for `malote.io` (Namecheap) need the user's explicit go-ahead.
