#!/usr/bin/env bash
# Deploy LANARK settlement contracts to Celo Mainnet, verify on CeloScan,
# record addresses, and patch .env + Vercel production env.
#
# Prerequisite: the deployer (derived from .env PRIVATE_KEY) funded with CELO.
set -euo pipefail

cd "$(dirname "$0")/.."
export PATH="${HOME}/.foundry/bin:${PATH:-/usr/bin:/bin}"

CUSD="0x765DE816845861e75A25fCA122bb6898B8B1282a"
RPC="https://forno.celo.org"
CHAIN_ID=42220
RECORD="contracts/deployed-mainnet.json"

envval() { grep -E "^$1=" .env 2>/dev/null | head -1 | cut -d= -f2- | sed -E 's/^"//; s/"$//'; }

# Deployer address is never hardcoded. It is read from LANARK_DEPLOYER_ADDRESS or
# derived from the local-only PRIVATE_KEY (.env, git-ignored, never committed).
DEPLOYER="$(envval LANARK_DEPLOYER_ADDRESS)"
[ -z "$DEPLOYER" ] && DEPLOYER="$(cast wallet address --private-key "$(envval PRIVATE_KEY)" 2>/dev/null || true)"
if [ -z "$DEPLOYER" ]; then
  echo "BLOCKED: set PRIVATE_KEY (or LANARK_DEPLOYER_ADDRESS) in .env" >&2
  exit 1
fi

patch_env() {
  local key="$1" val="$2"
  if grep -q "^${key}=" .env; then
    sed -i "s|^${key}=.*|${key}=${val}|" .env
  else
    echo "${key}=${val}" >> .env
  fi
}

echo "=== LANARK Mainnet Deploy ==="
echo "Deployer: $DEPLOYER"
BAL=$(cast balance "$DEPLOYER" --rpc-url "$RPC")
echo "Balance:  $BAL wei"
if [ "$BAL" = "0" ]; then
  echo "BLOCKED: fund $DEPLOYER with CELO on Celo Mainnet, then re-run." >&2
  exit 1
fi

# Ensure mainnet settlement params in .env
patch_env LANARK_CHAIN_ID "$CHAIN_ID"
patch_env NEXT_PUBLIC_LANARK_CHAIN_ID "$CHAIN_ID"
patch_env CELO_RPC_URL "$RPC"
patch_env NEXT_PUBLIC_CELO_RPC_URL "$RPC"
patch_env LANARK_SETTLEMENT_TOKEN "$CUSD"
patch_env NEXT_PUBLIC_LANARK_SETTLEMENT_TOKEN "$CUSD"

export PRIVATE_KEY="$(envval PRIVATE_KEY)"
export LANARK_TREASURY="$(envval LANARK_TREASURY)"
export LANARK_ARBITER="$(envval LANARK_ARBITER)"
export LANARK_FACTORY_OWNER="$(envval LANARK_FACTORY_OWNER)"
export LANARK_FEE_BPS="$(envval LANARK_FEE_BPS)"
export LANARK_SETTLEMENT_TOKEN="$CUSD"
export CELO_RPC_URL="$RPC"

echo "Broadcasting..."
forge script script/Deploy.s.sol:Deploy \
  --rpc-url celo \
  --broadcast \
  --verify \
  -vvv 2>&1 | tee /tmp/lanark-mainnet-deploy.log

# Parse addresses from broadcast artifact or forge log
BROADCAST=$(ls -t broadcast/Deploy.s.sol/42220/run-*.json 2>/dev/null | head -1)
if [ -z "$BROADCAST" ]; then
  echo "ERROR: no broadcast artifact found" >&2
  exit 1
fi

FACTORY=$(jq -r '.transactions[] | select(.contractName=="LanarkEscrowFactory") | .contractAddress' "$BROADCAST" | head -1)
FEE=$(jq -r '.transactions[] | select(.contractName=="LanarkFeeCollector") | .contractAddress' "$BROADCAST" | head -1)
TX=$(jq -r '.transactions[0].hash' "$BROADCAST")

patch_env LANARK_ESCROW_FACTORY "$FACTORY"
patch_env NEXT_PUBLIC_LANARK_ESCROW_FACTORY "$FACTORY"

cat > "$RECORD" <<EOF
{
  "network": "celo-mainnet",
  "chainId": $CHAIN_ID,
  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "deployer": "$DEPLOYER",
  "settlementToken": "$CUSD",
  "lanarkFeeCollector": "$FEE",
  "lanarkEscrowFactory": "$FACTORY",
  "deploymentTxHash": "$TX",
  "celoscan": {
    "factory": "https://celoscan.io/address/$FACTORY",
    "tx": "https://celoscan.io/tx/$TX"
  }
}
EOF

echo
echo "=== DEPLOYED ==="
cat "$RECORD"
echo
echo "Factory: $FACTORY"
echo "Tx:      https://celoscan.io/tx/$TX"
