# Enclave infrastructure (Google Cloud)

Project `malote-513023`, region `southamerica-east1`. One environment per `MALOTE_ENV` (`staging`, `production`).

- `setup-env.sh <env>` — one time: workload identity pool for attestation, VM service account, static IP, firewall.
- `allow-digest.sh <env> <sha256:…>` — lets an image digest read that environment's secrets. The digest is also
  appended to `allowed-digests/<env>.txt`; commit that file, so every image ever trusted is public.
- `launch.sh <env> <sha256:…>` — (re)creates the confidential VM running that image.

How the trust works: the VM runs Google's Confidential Space image, which only starts the container by digest
and puts that digest in a Google-signed attestation token. The pool `malote-<env>` only accepts tokens with debug
off, a stable Confidential Space image and `MALOTE_ENV=<env>`; Secret Manager only releases `<env>-*` secrets to
digests listed with `allow-digest.sh`. The database URL, the WhatsApp session key and the TLS key wrap key never
appear in environment variables (Confidential Space would expose them in every token).
