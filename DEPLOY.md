# LANARK — Deploy & Verify Runbook

Repeatable steps to take LANARK settlement on-chain and verify the stack. Two
networks are supported; the app is fully chain-parameterized via env.

## 0) Deployer / settlement-worker key

A keypair was generated for the deployer **and** the settlement worker (factory
owner + arbiter). It lives in `.env`:

```
PRIVATE_KEY / LANARK_WORKER_PRIVATE_KEY   (same key on testnet)
Deployer address: 0xbBABbD2620CEfe3EfdC41bA661ae75f2D9c6647E
```

This address MUST be funded with native CELO for gas before deploying.
Status at last check: **0 CELO on Sepolia, 0 CELO on Mainnet** → fund first.

## 1) Compile + test contracts

```
forge build
forge test
```

## 2A) Deploy to Celo Sepolia (testnet, recommended first)

`.env` is preconfigured for Sepolia (`LANARK_CHAIN_ID=11142220`). The deploy
script publishes a MockERC20 test token (open mint, so buyers can self-fund a
demo purchase from the chat/checkout flow).

```
# Fund the deployer with Sepolia CELO: https://faucet.celo.org  (Celo Sepolia)
bash scripts/deploy-contracts.sh sepolia
```

Copy the printed `SettlementToken` and `LanarkEscrowFactory` into `.env`
(both the plain and `NEXT_PUBLIC_` variants), then restart the app:

```
LANARK_SETTLEMENT_TOKEN=0x...        NEXT_PUBLIC_LANARK_SETTLEMENT_TOKEN=0x...
LANARK_ESCROW_FACTORY=0x...          NEXT_PUBLIC_LANARK_ESCROW_FACTORY=0x...
```

## 2B) Deploy to Celo Mainnet (real funds)

```
# Set mainnet chain in .env:
LANARK_CHAIN_ID=42220
NEXT_PUBLIC_LANARK_CHAIN_ID=42220
CELO_RPC_URL=https://forno.celo.org
NEXT_PUBLIC_CELO_RPC_URL=https://forno.celo.org
# Use canonical cUSD (do NOT deploy a mock on mainnet):
LANARK_SETTLEMENT_TOKEN=0x765DE816845861e75A25fCA122bb6898B8B1282a
NEXT_PUBLIC_LANARK_SETTLEMENT_TOKEN=0x765DE816845861e75A25fCA122bb6898B8B1282a

# Fund 0xbBABbD2620CEfe3EfdC41bA661ae75f2D9c6647E with REAL CELO for gas, then:
bash scripts/deploy-contracts.sh mainnet
```

Paste the resulting `LanarkEscrowFactory` into `LANARK_ESCROW_FACTORY` +
`NEXT_PUBLIC_LANARK_ESCROW_FACTORY`. On mainnet buyers must already hold cUSD
(there is no faucet/mint path).

## 3) Verify on-chain state

```
# Factory has bytecode (deployed):
cast code  <FACTORY> --rpc-url <RPC>
# Per-order escrow address for an order id (after a purchase):
cast call  <FACTORY> "escrowOf(bytes32)(address)" <orderRefBytes32> --rpc-url <RPC>
```
Explorer: Sepolia → https://celo-sepolia.blockscout.com · Mainnet → https://celoscan.io

## 4) Apply DB migrations

```
node scripts/run_migration.js 2026_06_19_onchain_settlement.sql
```
(Adds `orders.escrow_address/deposit_tx_hash/release_tx_hash/settled_at`, the
`order_events` table, and the `notifications` table.)

## 5) Notifications provider (optional, integration-ready)

The purchase flow already calls `notifyUser(...)` and logs every attempt in
`notifications`. To actually send to the buyer's phone, set ONE provider:

```
# Twilio SMS
NOTIFY_PROVIDER=twilio
TWILIO_ACCOUNT_SID=...  TWILIO_AUTH_TOKEN=...  TWILIO_FROM=+1...
# or WhatsApp Cloud API
NOTIFY_PROVIDER=whatsapp
WHATSAPP_TOKEN=...  WHATSAPP_PHONE_ID=...
```

## 6) Voice transcription fallback (optional)

The chat mic uses the browser Web Speech API by default (no server). For
browsers without it, set an Azure Whisper deployment to enable `/api/transcribe`:

```
AZURE_OPENAI_TRANSCRIBE_DEPLOYMENT=<whisper-deployment-name>
```

## 7) Vercel

```
vercel link        # link the project
vercel env pull    # sanity-check env vars exist in the Vercel project
vercel --prod      # deploy
```
Ensure every `NEXT_PUBLIC_*` above (chain, RPC, factory, token, settlement
symbol) plus the server secrets are set in the Vercel project, then verify the
production URL serves `/`, `/dashboard`, `/cart`, `/wallet`, `/chat`.
