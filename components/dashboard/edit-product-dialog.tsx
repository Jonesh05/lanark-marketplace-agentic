"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { updateProduct } from "@/app/actions/products"
import type { Product } from "@/lib/types"

export function EditProductDialog({ product }: { product: Product }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  // Convert cents to display value
  const priceDisplay = (product.price_cents / 100).toFixed(2)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="flex h-7 w-7 items-center justify-center rounded border border-border/60 bg-card/40 text-muted-foreground transition hover:bg-accent/10 hover:text-accent"
          title="Edit product"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Edit listing</DialogTitle>
        </DialogHeader>
        <form
          action={(fd) => {
            startTransition(async () => {
              const res = await updateProduct(fd)
              if (!res.ok) toast.error(res.error)
              else {
                toast.success("Listing updated.")
                setOpen(false)
              }
            })
          }}
          className="flex flex-col gap-4"
        >
          <input type="hidden" name="id" value={product.id} />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title" className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Title
            </Label>
            <Input id="title" name="title" defaultValue={product.title} maxLength={120} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description" className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Description
            </Label>
            <Textarea
              id="description"
              name="description"
              rows={3}
              defaultValue={product.description ?? ""}
              maxLength={800}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="image_url" className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Image URL
            </Label>
            <Input
              id="image_url"
              name="image_url"
              type="url"
              defaultValue={product.image_url ?? ""}
              placeholder="https://…"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="price" className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Price
              </Label>
              <Input
                id="price"
                name="price"
                inputMode="decimal"
                defaultValue={priceDisplay}
                className="font-mono"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="currency" className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Currency
              </Label>
              <Select name="currency" defaultValue={product.currency ?? "COP"}>
                <SelectTrigger id="currency" className="font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COP">COP</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="stock" className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Stock
              </Label>
              <Input
                id="stock"
                name="stock"
                type="number"
                min={0}
                defaultValue={product.stock}
                className="font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card/40 px-4 py-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm">Active listing</span>
              <span className="text-[11px] text-muted-foreground">
                {product.active ? "Visible in marketplace" : "Hidden from buyers"}
              </span>
            </div>
            <Switch name="active" defaultChecked={product.active} />
          </div>

          <Button type="submit" disabled={pending} className="h-11">
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
