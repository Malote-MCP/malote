# Enclave infrastructure (Google Cloud)

Project `malote-513023`. Enclave VMs use zone `southamerica-east1-a`. The production web service uses Cloud Run in `us-east1`; staging web uses `southamerica-east1`. One enclave environment per `MALOTE_ENV` (`staging`, `production`).

- `setup-env.sh <env>` — one time: workload identity pool for attestation, VM service account, static IP, firewall.
- `allow-digest.sh <env> <sha256:…>` — lets an image digest read that environment's secrets. The digest is also
  appended to `allowed-digests/<env>.txt`; commit that file, so every image ever trusted is public.
- `launch.sh <env> <sha256:…>` — (re)creates the confidential VM running that image.

How the trust works: the VM runs Google's Confidential Space image, which only starts the container by digest
and puts that digest in a Google-signed attestation token. The pool `malote-<env>` only accepts tokens with debug
off, a stable Confidential Space image and `MALOTE_ENV=<env>`; Secret Manager only releases `<env>-*` secrets to
digests listed with `allow-digest.sh`. The database URL, the WhatsApp session key and the TLS key wrap key never
appear in environment variables (Confidential Space would expose them in every token).


## Web publication (Cloud Run)

Production: service `malote-web`, region `us-east1`, domain `https://malote.io`.
Staging: service `malote-web-staging`, region `southamerica-east1`.
The `fly.*.toml` files and `.github/workflows/deploy.yml` describe the legacy Fly deployment.

Build from a clean checkout of the exact commit to publish. Do not upload `.env` files or unrelated work.
Set `GIT_SHA` to that commit's full SHA so `/api/transparency` identifies the source correctly.
Build only the web image for a landing or panel update; no database migration or worker restart is required for a CSS/content change.

For Cloud Build, use the existing build service account and source bucket:

- Service account: `malote-build@malote-513023.iam.gserviceaccount.com`.
- Source staging directory: `gs://malote-513023-build-src/source` (the default `_cloudbuild` bucket does not have the same access).
- Image repository: `southamerica-east1-docker.pkg.dev/malote-513023/malote/web`.

Example `cloudbuild.web.json` (replace `<full-commit-sha>` in all three places):

```json
{
  "steps": [{
    "name": "gcr.io/cloud-builders/docker",
    "args": ["build", "-f", "apps/web/Dockerfile", "--build-arg", "GIT_SHA=<full-commit-sha>", "-t", "southamerica-east1-docker.pkg.dev/malote-513023/malote/web:<full-commit-sha>", "."]
  }],
  "images": ["southamerica-east1-docker.pkg.dev/malote-513023/malote/web:<full-commit-sha>"],
  "serviceAccount": "projects/malote-513023/serviceAccounts/malote-build@malote-513023.iam.gserviceaccount.com",
  "options": { "logging": "CLOUD_LOGGING_ONLY" },
  "timeout": "1200s"
}
```

```sh
gcloud builds submit . --project malote-513023 \
  --config cloudbuild.web.json \
  --gcs-source-staging-dir gs://malote-513023-build-src/source
```

After the build succeeds, deploy the resulting immutable image digest (replace `<sha256:digest>`):

```sh
gcloud run deploy malote-web --project malote-513023 --region us-east1 \
  --image southamerica-east1-docker.pkg.dev/malote-513023/malote/web@<sha256:digest>
```

Updating only `--image` preserves the service's existing environment, secrets and runtime service account.
Confirm the revision is ready, receives production traffic, and `https://malote.io/api/transparency` reports the expected web commit. Check the changed page on `https://malote.io`.

## Worker publication

The web deployment does not deploy the enclave. Worker images are published by `.github/workflows/publish-worker.yml`.
After reviewing a worker digest, use `allow-digest.sh <env> <sha256:…>` and commit the public digest list, then use `launch.sh <env> <sha256:…>` to recreate that environment's VM. This interrupts the worker; do not run it for web-only changes.
Use `start.sh staging` to restart a stopped staging VM; staging stops after three hours.
