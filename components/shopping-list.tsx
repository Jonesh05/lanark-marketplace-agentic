'use client'

import * as React from 'react'

type Item = {
  id: string
  product_id: string
  quantity: number
}

export default function ShoppingList() {
  const [items, setItems] = React.useState<Item[]>([])
  const [loading, setLoading] = React.useState(false)
  const [productId, setProductId] = React.useState('')
  const [quantity, setQuantity] = React.useState(1)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/shopping-list')
      const data = await res.json()
      if (data.ok) setItems(data.items ?? [])
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    load()
  }, [])

  async function addItem() {
    if (!productId) return
    const res = await fetch('/api/shopping-list', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ product_id: productId, quantity }),
    })
    const data = await res.json()
    if (data.ok) setItems((s) => [data.item, ...s])
  }

  async function removeItem(id: string) {
    const res = await fetch('/api/shopping-list', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const data = await res.json()
    if (data.ok) setItems((s) => s.filter((it) => it.id !== id))
  }

  async function updateQuantity(id: string, qty: number) {
    const res = await fetch('/api/shopping-list', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, quantity: qty }),
    })
    const data = await res.json()
    if (data.ok) setItems((s) => s.map((it) => (it.id === id ? data.item : it)))
  }

  return (
    <div className="p-4 border rounded">
      <h3 className="text-lg font-semibold">Shopping List</h3>
      <div className="flex gap-2 mt-2">
        <input
          className="input"
          placeholder="Product ID"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
        />
        <input
          type="number"
          className="input w-20"
          value={quantity}
          min={1}
          onChange={(e) => setQuantity(Number(e.target.value))}
        />
        <button className="btn" onClick={addItem} disabled={!productId}>
          Add
        </button>
      </div>

      <div className="mt-4">
        {loading ? (
          <div>Loading…</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-muted-foreground">No items</div>
        ) : (
          <ul className="space-y-2 mt-2">
            {items.map((it) => (
              <li key={it.id} className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{it.product_id}</div>
                  <div className="text-sm text-muted-foreground">Qty: {it.quantity}</div>
                </div>
                <div className="flex gap-2">
                  <button className="btn" onClick={() => updateQuantity(it.id, it.quantity - 1)} disabled={it.quantity <= 1}>-</button>
                  <button className="btn" onClick={() => updateQuantity(it.id, it.quantity + 1)}>+</button>
                  <button className="btn btn-ghost" onClick={() => removeItem(it.id)}>Remove</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
