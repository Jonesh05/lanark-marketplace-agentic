#!/usr/bin/env bash
# Deploy the LANARK settlement stack (FeeCollector + EscrowFactory, plus a
# MockERC20 on testnet) to Celo.
#
# Usage:
#   bash scripts/deploy-contracts.sh sepolia   # Celo Sepolia testnet (default)
#   bash scripts/deploy-contracts.sh mainnet   # Celo Mainnet (REAL funds)
#
# The deployer address (derived from PRIVATE_KEY in .env) MUST be funded with
# native CELO for gas on the target network:
#   - Sepolia testnet CELO: https://faucet.celo.org  (select "Celo Sepolia")
#   - Mainnet CELO: buy/transfer real CELO to the deployer address
#
# On MAINNET, set LANARK_SETTLEMENT_TOKEN to canonical cUSD
#   0x765DE816845861e75A25fCA122bb6898B8B1282a
# so the script does NOT deploy a mock token.
#
# After it prints the addresses, paste them into .env (plain + NEXT_PUBLIC_):
#   LANARK_SETTLEMENT_TOKEN / NEXT_PUBLIC_LANARK_SETTLEMENT_TOKEN
#   LANARK_ESCROW_FACTORY   / NEXT_PUBLIC_LANARK_ESCROW_FACTORY
set -euo pipefail

cd "$(dirname "$0")/.."

NETWORK="${1:-sepolia}"

# Safely read a single key from .env without sourcing the whole file (it
# contains unquoted '&' in Postgres URLs that breaks `source`).
envval() { grep -E "^$1=" .env | head -1 | cut -d= -f2- | sed -E 's/^"//; s/"$//'; }

export PRIVATE_KEY="$(envval PRIVATE_KEY)"
export LANARK_TREASURY="$(envval LANARK_TREASURY)"
export LANARK_ARBITER="$(envval LANARK_ARBITER)"
export LANARK_FACTORY_OWNER="$(envval LANARK_FACTORY_OWNER)"
export LANARK_FEE_BPS="$(envval LANARK_FEE_BPS)"
export LANARK_SETTLEMENT_TOKEN="$(envval LANARK_SETTLEMENT_TOKEN)"

if [ -z "${PRIVATE_KEY:-}" ]; then
  echo "ERROR: PRIVATE_KEY missing in .env" >&2
  exit 1
fi

if [ "$NETWORK" = "mainnet" ]; then
  RPC_URL="$(envval CELO_RPC_URL)"; [ -z "$RPC_URL" ] && RPC_URL="https://forno.celo.org"
  FORGE_RPC="celo"
  if [ -z "${LANARK_SETTLEMENT_TOKEN:-}" ]; then
    echo "ERROR: on mainnet, set LANARK_SETTLEMENT_TOKEN to canonical cUSD" >&2
    echo "       0x765DE816845861e75A25fCA122bb6898B8B1282a" >&2
    exit 1
  fi
else
  RPC_URL="$(envval CELO_RPC_URL)"; [ -z "$RPC_URL" ] && RPC_URL="https://forno.celo-sepolia.celo-testnet.org"
  FORGE_RPC="celo_sepolia"
fi

DEPLOYER=$(cast wallet address "$PRIVATE_KEY")
echo "Network:   $NETWORK ($FORGE_RPC)"
echo "RPC:       $RPC_URL"
echo "Deployer:  $DEPLOYER"

BAL=$(cast balance "$DEPLOYER" --rpc-url "$RPC_URL")
echo "Balance (wei): $BAL"
if [ "$BAL" = "0" ]; then
  echo "ERROR: deployer has 0 CELO on $NETWORK. Fund $DEPLOYER first." >&2
  exit 1
fi

CELO_RPC_URL="$RPC_URL" forge script script/Deploy.s.sol:Deploy \
  --rpc-url "$FORGE_RPC" \
  --broadcast -vvv

echo
echo "Done. Copy SettlementToken + LanarkEscrowFactory into .env (plain + NEXT_PUBLIC_)."
