#!/usr/bin/env bash
# End-to-end check of staging with the test account (luvi+staging@germanos.ws):
# web sign-in → Neon Auth JWT → enclave token API → MCP with the stored test token.
# Credentials live in Secret Manager (staging-test-user-password, staging-test-token).
set -euo pipefail
export PATH="$HOME/google-cloud-sdk/bin:$PATH"
WEB=https://malote-web-staging-347216371802.southamerica-east1.run.app
ENCLAVE=https://mcp-staging.malote.io
JAR=$(mktemp); trap 'rm -f "$JAR"' EXIT
secret() { gcloud secrets versions access latest --secret="$1" --project malote-513023; }

PW=$(secret staging-test-user-password)
LOGIN=$(python3 -c 'import json,sys;print(json.dumps({"email":"luvi+staging@germanos.ws","password":sys.argv[1]}))' "$PW")
code=$(curl -s -o /dev/null -w '%{http_code}' -c "$JAR" -b "$JAR" -H 'content-type: application/json' -H "origin: $WEB" -X POST "$WEB/api/auth/sign-in/email" -d "$LOGIN")
[[ $code == 200 ]] && echo "✓ web sign-in" || { echo "✗ web sign-in ($code)"; exit 1; }

JWT=$(curl -s -b "$JAR" -H "origin: $WEB" "$WEB/api/auth/token" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("token",""))')
[[ -n $JWT ]] && echo "✓ Neon Auth JWT" || { echo "✗ no JWT"; exit 1; }

list=$(curl -s -H "authorization: Bearer $JWT" -H "origin: $WEB" "$ENCLAVE/v1/tokens")
echo "$list" | grep -q '"hasKey":true' && echo "✓ enclave token API (JWT accepted)" || { echo "✗ token API: $list"; exit 1; }

for path in /api/mcp /api/tokens; do
  code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$WEB$path" -d '{}')
  [[ $code == 410 ]] && echo "✓ web $path disabled (410)" || { echo "✗ web $path answered $code"; exit 1; }
done

TOKEN=$(secret staging-test-token)
status=$(curl -s -X POST "$ENCLAVE/mcp" -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"whatsapp_status","arguments":{}}}')
echo "$status" | grep -q '"result"' && echo "✓ MCP whatsapp_status" || { echo "✗ MCP: $status"; exit 1; }
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$ENCLAVE/mcp" -H 'content-type: application/json' -d '{}')
[[ $code == 401 ]] && echo "✓ MCP without token rejected (401)" || { echo "✗ MCP without token: $code"; exit 1; }
