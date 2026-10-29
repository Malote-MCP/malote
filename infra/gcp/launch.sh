#!/usr/bin/env bash
# (Re)creates the confidential VM running one image digest.
source "$(dirname "$0")/common.sh"
DIGEST=${2:?usage: $0 <env> sha256:<digest>}
[[ "$DIGEST" =~ ^sha256:[0-9a-f]{64}$ ]] || { echo "invalid digest: $DIGEST" >&2; exit 1; }
IP=$(gcloud compute addresses describe "$IP_NAME" --region "$REGION" --project "$PROJECT" --format='value(address)')

gcloud compute instances delete "$VM" --zone "$ZONE" --project "$PROJECT" --quiet >/dev/null 2>&1 || true
gcloud compute instances create "$VM" --project "$PROJECT" --zone "$ZONE" \
  --machine-type n2d-highcpu-2 --min-cpu-platform="AMD Milan" \
  --confidential-compute-type=SEV --maintenance-policy=TERMINATE --shielded-secure-boot \
  --image-project=confidential-space-images --image-family=confidential-space \
  --service-account="$SA" --scopes=cloud-platform \
  --address="$IP" --tags=malote-enclave \
  --metadata="^~^tee-image-reference=$IMAGE@$DIGEST~tee-env-MALOTE_ENV=$ENV_NAME~tee-container-log-redirect=true~tee-restart-policy=Always"
