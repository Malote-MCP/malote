# Shared settings for the scripts in this directory.
set -euo pipefail
export PATH="$HOME/google-cloud-sdk/bin:$PATH"
PROJECT=malote-513023
PROJECT_NUMBER=347216371802
REGION=southamerica-east1
ZONE=southamerica-east1-a
ENV_NAME=${1:?usage: $0 <env> …}
[[ "$ENV_NAME" =~ ^[a-z]+$ ]] || { echo "invalid env: $ENV_NAME" >&2; exit 1; }
POOL=malote-$ENV_NAME
SA=malote-enclave-$ENV_NAME@$PROJECT.iam.gserviceaccount.com
IP_NAME=malote-enclave-$ENV_NAME
VM=malote-enclave-$ENV_NAME
SECRETS=(database-url database-url-unpooled wa-auth-key tls-wrap-key)
IMAGE=ghcr.io/malote-mcp/malote/worker
