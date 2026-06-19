#!/usr/bin/env bash
# Sync LANARK env vars to Vercel with correct public vs server-only classification.
#
# PUBLIC  (NEXT_PUBLIC_*): safe to expose to the browser; added with --no-sensitive
# SERVER  (no prefix):     server-only; added with --sensitive
# SKIP    (never auto-sync): deployer keys, DB passwords, service role keys already
#           managed in Vercel dashboard or added manually when needed.
#
# Usage:
#   bash scripts/sync-vercel-env.sh           # dry-run (print plan)
#   bash scripts/sync-vercel-env.sh --apply   # push missing vars only
set -euo pipefail

cd "$(dirname "$0")/.."
APPLY=false
[ "${1:-}" = "--apply" ] && APPLY=true

envval() {
  grep -E "^$1=" .env 2>/dev/null | head -1 | cut -d= -f2- | sed -E 's/^"//; s/"$//'
}

# --- PUBLIC: exposed to browser (NEXT_PUBLIC_*) ---
PUBLIC_VARS=(
  NEXT_PUBLIC_LANARK_CHAIN_ID
  NEXT_PUBLIC_CELO_RPC_URL
  NEXT_PUBLIC_LANARK_ESCROW_FACTORY
  NEXT_PUBLIC_LANARK_SETTLEMENT_TOKEN
  NEXT_PUBLIC_SENTRY_DSN
)

# --- SERVER: runtime secrets / server-only (never NEXT_PUBLIC_) ---
SERVER_VARS=(
  LANARK_CHAIN_ID
  CELO_RPC_URL
  LANARK_ESCROW_FACTORY
  LANARK_SETTLEMENT_TOKEN
  LANARK_FEE_BPS
  LANARK_TREASURY
  LANARK_ARBITER
  LANARK_FACTORY_OWNER
  AZURE_OPENAI_API_KEY
  AZURE_OPENAI_ENDPOINT
  AZURE_OPENAI_DEPLOYMENT_NAME
  SENTRY_AUTH_TOKEN
  SENTRY_ORG
  SENTRY_PROJECT
)

# --- NEVER auto-sync (manual / already in Vercel / high risk) ---
# PRIVATE_KEY, LANARK_WORKER_PRIVATE_KEY, SUPABASE_SERVICE_ROLE_KEY,
# POSTGRES_*, SUPABASE_JWT_SECRET, etc.

existing() {
  npx -y vercel@latest env ls production 2>/dev/null \
    | awk 'NR>3 && NF>=1 {print $1}' | sort -u
}

EXISTING=$(existing)

add_public() {
  local name="$1" val="$2"
  echo "$EXISTING" | grep -qx "$name" && { echo "  skip (exists) $name"; return; }
  [ -z "$val" ] && { echo "  skip (empty)  $name"; return; }
  echo "  add PUBLIC    $name"
  $APPLY && npx -y vercel@latest env add "$name" production --value "$val" --yes --no-sensitive
}

add_server() {
  local name="$1" val="$2"
  echo "$EXISTING" | grep -qx "$name" && { echo "  skip (exists) $name"; return; }
  [ -z "$val" ] && { echo "  skip (empty)  $name"; return; }
  echo "  add SERVER    $name (sensitive)"
  $APPLY && npx -y vercel@latest env add "$name" production --value "$val" --yes --sensitive
}

echo "=== LANARK Vercel env sync ($($APPLY && echo APPLY || echo DRY-RUN)) ==="
echo
echo "PUBLIC vars (browser-safe):"
for v in "${PUBLIC_VARS[@]}"; do add_public "$v" "$(envval "$v")"; done
echo
echo "SERVER vars (sensitive, server-only):"
for v in "${SERVER_VARS[@]}"; do add_server "$v" "$(envval "$v")"; done
echo
echo "NOT synced automatically: PRIVATE_KEY, LANARK_WORKER_PRIVATE_KEY, POSTGRES_*, SUPABASE_SERVICE_ROLE_KEY"
echo "Add worker key manually in Vercel only after contracts are deployed and funded."
echo
$APPLY && echo "Done. Redeploy production: npx vercel --prod --yes"
