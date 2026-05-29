import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SiteHeader } from '@/components/site-header'

export const dynamic = 'force-dynamic'

export default async function SellerProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?next=/profile/seller')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/auth/login')

  return (
    <div className="min-h-svh">
      <SiteHeader />
      <main className="p-6">
        <h1 className="text-2xl font-bold">Seller Dashboard (Skeleton)</h1>
        <p className="text-sm text-muted-foreground mt-2">Profile: {profile.display_name ?? '—'}</p>

        <section className="mt-6">
          <h2 className="text-lg font-semibold">Overview</h2>
          <p className="text-sm text-muted-foreground">Sales summary and quick stats will appear here.</p>
        </section>

        <section className="mt-6">
          <h2 className="text-lg font-semibold">Products</h2>
          <p className="text-sm text-muted-foreground">List of your products and inventory controls.</p>
        </section>

        <section className="mt-6">
          <h2 className="text-lg font-semibold">Orders</h2>
          <p className="text-sm text-muted-foreground">Recent orders and fulfillment status.</p>
        </section>

        <section className="mt-6">
          <h2 className="text-lg font-semibold">Finances</h2>
          <p className="text-sm text-muted-foreground">Payouts, settlements and invoices.</p>
        </section>

        <section className="mt-6">
          <h2 className="text-lg font-semibold">Suppliers</h2>
          <p className="text-sm text-muted-foreground">Supplier relationships and purchase orders.</p>
        </section>

        <section className="mt-6">
          <h2 className="text-lg font-semibold">Fulfillment</h2>
          <p className="text-sm text-muted-foreground">Shipping and tracking integrations.</p>
        </section>
      </main>
    </div>
  )
}
