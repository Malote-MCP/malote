#!/usr/bin/env bash
# Lets one image digest read this environment's secrets, and records it publicly.
source "$(dirname "$0")/common.sh"
DIGEST=${2:?usage: $0 <env> sha256:<digest>}
[[ "$DIGEST" =~ ^sha256:[0-9a-f]{64}$ ]] || { echo "invalid digest: $DIGEST" >&2; exit 1; }
MEMBER="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL/attribute.image_digest/$DIGEST"
for s in "${SECRETS[@]}"; do
  gcloud secrets add-iam-policy-binding "$ENV_NAME-$s" --project "$PROJECT" --member="$MEMBER" --role=roles/secretmanager.secretAccessor >/dev/null
done
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $DIGEST" >> "$(dirname "$0")/allowed-digests/$ENV_NAME.txt"
echo "allowed $DIGEST for $ENV_NAME"
