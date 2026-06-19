export type Role = "client" | "shopkeeper"

export type WalletKind = "guest" | "sca" | "eoa"

export interface Profile {
  id: string
  display_name: string | null
  role: Role
  is_guest: boolean
  primary_address: string | null
  wallet_address: string | null
  email: string | null
  reown_user_id: string | null
  google_subject_id: string | null
  telegram_user_id: string | null
  phone: string | null
  phone_country: string | null
  created_at: string
  updated_at: string
}

export interface SmartWallet {
  id: string
  user_id: string
  address: string
  kind: WalletKind
  chain_id: number
  created_at: string
}

export interface Store {
  id: string
  owner_id: string
  name: string
  slug: string | null
  description: string | null
  logo_url: string | null
  country: string | null
  tax_id: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export type ProductSource = "native" | "external"

export interface Product {
  id: string
  shopkeeper_id: string | null
  title: string
  description: string | null
  image_url: string | null
  price_cents: number
  currency: string
  settle_token: string
  stock: number
  active: boolean
  source: ProductSource
  external_id: string | null
  category: string | null
  brand: string | null
  thumbnail_url: string | null
  rating: number | null
  discount_percentage: number | null
  tags: string[] | null
  price_cusd: number | null
  price_cop: number | null
  created_at: string
  // present when read from the public_catalog view (store brand, Rappi/Amazon style)
  store_id?: string | null
  store_name?: string | null
  store_slug?: string | null
}

export type OfferStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "expired"
  | "settled"

export interface Offer {
  id: string
  product_id: string
  client_id: string
  qty: number
  amount_cusd_wei: string
  status: OfferStatus
  created_at: string
  decided_at: string | null
}

export type OrderStatus =
  | "preinscribed"
  | "pending"
  | "submitted"
  | "awaiting_settlement"
  | "escrowed"
  | "settled"
  | "confirmed"
  | "failed"
  | "disputed"
  | "cancelled"

export type OrderSource = "offer" | "direct" | "agent"

// Seller-side operational lifecycle, kept separate from the payment/chain
// `status` above so settlement state and fulfillment state never collide.
export type FulfillmentStatus =
  | "pending_review"
  | "accepted"
  | "preparing"
  | "dispatched"
  | "delivered"
  | "rejected"
  | "cancelled"

export interface Order {
  id: string
  offer_id: string | null
  product_id: string | null
  client_id: string
  shopkeeper_id: string
  qty: number
  amount_cusd_wei: string
  tx_hash: string | null
  user_op_hash: string | null
  status: OrderStatus
  fulfillment_status?: FulfillmentStatus
  source?: OrderSource
  total_cusd_wei?: string | null
  shipping_address?: string | null
  purchase_ref?: string | null
  escrow_address?: string | null
  deposit_tx_hash?: string | null
  release_tx_hash?: string | null
  settled_at?: string | null
  created_at: string
  confirmed_at: string | null
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  shopkeeper_id: string | null
  store_id: string | null
  title_snapshot: string
  quantity: number
  unit_price_cents: number
  currency: string
  unit_price_cusd_wei: string
  line_total_cusd_wei: string
  created_at: string
}
