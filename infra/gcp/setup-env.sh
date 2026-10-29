#!/usr/bin/env bash
# One-time setup of an enclave environment. Safe to re-run.
source "$(dirname "$0")/common.sh"

gcloud iam workload-identity-pools describe "$POOL" --location=global --project "$PROJECT" >/dev/null 2>&1 ||
  gcloud iam workload-identity-pools create "$POOL" --location=global --project "$PROJECT"
gcloud iam workload-identity-pools providers describe attestation --location=global --workload-identity-pool="$POOL" --project "$PROJECT" >/dev/null 2>&1 ||
  gcloud iam workload-identity-pools providers create-oidc attestation --location=global --project "$PROJECT" \
    --workload-identity-pool="$POOL" \
    --issuer-uri="https://confidentialcomputing.googleapis.com/" \
    --allowed-audiences="https://sts.googleapis.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.image_digest=assertion.submods.container.image_digest,attribute.malote_env=assertion.submods.container.env.MALOTE_ENV" \
    --attribute-condition="assertion.swname == 'CONFIDENTIAL_SPACE' && 'STABLE' in assertion.submods.confidential_space.support_attributes && assertion.dbgstat == 'disabled-since-boot' && assertion.submods.container.env.MALOTE_ENV == '$ENV_NAME'"

# The VM's own identity only needs to request attestation tokens and write logs.
gcloud iam service-accounts describe "$SA" --project "$PROJECT" >/dev/null 2>&1 ||
  gcloud iam service-accounts create "malote-enclave-$ENV_NAME" --project "$PROJECT"
for role in roles/confidentialcomputing.workloadUser roles/logging.logWriter; do
  gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$SA" --role="$role" --condition=None >/dev/null
done

gcloud compute addresses describe "$IP_NAME" --region "$REGION" --project "$PROJECT" >/dev/null 2>&1 ||
  gcloud compute addresses create "$IP_NAME" --region "$REGION" --project "$PROJECT"

# Only HTTPS (and HTTP for certificate challenges) reaches the enclave. No SSH.
gcloud compute firewall-rules describe malote-enclave-web --project "$PROJECT" >/dev/null 2>&1 ||
  gcloud compute firewall-rules create malote-enclave-web --project "$PROJECT" --network default \
    --allow tcp:80,tcp:443 --target-tags malote-enclave --source-ranges 0.0.0.0/0
for rule in default-allow-ssh default-allow-rdp; do
  gcloud compute firewall-rules delete "$rule" --project "$PROJECT" --quiet >/dev/null 2>&1 || true
done

echo "IP: $(gcloud compute addresses describe "$IP_NAME" --region "$REGION" --project "$PROJECT" --format='value(address)')"
