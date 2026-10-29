#!/usr/bin/env bash
# Stops an environment's enclave VM (disk, IP and WhatsApp credentials are kept).
source "$(dirname "$0")/common.sh"
gcloud compute instances stop "$VM" --zone "$ZONE" --project "$PROJECT" --quiet
echo "stopped $VM"
