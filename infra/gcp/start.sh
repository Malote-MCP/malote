#!/usr/bin/env bash
# Starts an environment's enclave VM and waits until it serves HTTPS.
# Staging stops itself after 3 hours (max run duration set by launch.sh).
source "$(dirname "$0")/common.sh"
gcloud compute instances start "$VM" --zone "$ZONE" --project "$PROJECT" --quiet
HOST=$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['hostname'])" "$(dirname "$0")/../../apps/worker/config/$ENV_NAME.json")
for _ in $(seq 1 40); do
  curl -sf -m 5 "https://$HOST/healthz" >/dev/null && { echo "up: https://$HOST"; exit 0; }
  sleep 6
done
echo "VM started, but https://$HOST is not answering yet; check the logs." >&2
exit 1
