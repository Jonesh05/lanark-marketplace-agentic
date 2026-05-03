"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { createProduct } from "@/app/actions/products"

export function NewProductDialog() {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-10 gap-2">
          <Plus className="h-4 w-4" />
          New listing
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Add a listing</DialogTitle>
        </DialogHeader>
        <form
          action={(fd) => {
            startTransition(async () => {
              const res = await createProduct(fd)
              if (!res.ok) toast.error(res.error)
              else {
                toast.success("Listing live.")
                setOpen(false)
              }
            })
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title" className="text-[11px] uppercase tracking-widest text-muted-foreground">Title</Label>
            <Input id="title" name="title" required maxLength={120} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description" className="text-[11px] uppercase tracking-widest text-muted-foreground">Description</Label>
            <Textarea id="description" name="description" rows={3} maxLength={800} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="image_url" className="text-[11px] uppercase tracking-widest text-muted-foreground">Image URL</Label>
            <Input id="image_url" name="image_url" type="url" placeholder="https://…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="price" className="text-[11px] uppercase tracking-widest text-muted-foreground">Price (COP)</Label>
              <Input
                id="price"
                name="price"
                inputMode="decimal"
                placeholder="120000"
                required
                className="font-mono"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="stock" className="text-[11px] uppercase tracking-widest text-muted-foreground">Stock</Label>
              <Input
                id="stock"
                name="stock"
                type="number"
                min={0}
                defaultValue={1}
                required
                className="font-mono"
              />
            </div>
          </div>
          <Button type="submit" disabled={pending} className="h-11">
            {pending ? "Listing…" : "List item"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
