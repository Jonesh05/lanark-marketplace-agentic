import { NextResponse } from "next/server"
import { settlementChainId, SETTLEMENT_SYMBOL } from "@/lib/celo"
import { PUBLIC_CHAIN_ID } from "@/lib/settlement/abi"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Public health check — no secrets. Used for production smoke tests and to
 * confirm the client/server chain configuration before MiniPay testing.
 */
export async function GET() {
  const serverChainId = settlementChainId()
  const clientChainId = PUBLIC_CHAIN_ID
  const chainAligned = serverChainId === clientChainId

  return NextResponse.json({
    ok: true,
    service: "lanark-marketplace",
    chain: {
      serverChainId,
      clientChainId,
      aligned: chainAligned,
      settlementSymbol: SETTLEMENT_SYMBOL,
    },
    minipay: {
      mainnet: "Production runs on Celo Mainnet (chain 42220). MiniPay Developer Mode: turn testnet OFF.",
      loadUrl: "https://lanark-marketplace-agentic.vercel.app/auth/login",
    },
    timestamp: new Date().toISOString(),
  })
}
