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
  created_at: string
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
  amount_cusd_micro: number
  status: OfferStatus
  created_at: string
  decided_at: string | null
}

export type OrderStatus = "pending" | "submitted" | "confirmed" | "failed"

export interface Order {
  id: string
  offer_id: string | null
  product_id: string
  client_id: string
  shopkeeper_id: string
  qty: number
  amount_cusd_micro: number
  tx_hash: string | null
  user_op_hash: string | null
  status: OrderStatus
  created_at: string
  confirmed_at: string | null
}
