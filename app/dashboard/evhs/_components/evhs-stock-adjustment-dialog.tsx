"use client"

import { useEffect, useMemo, useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { createEvhsStockAdjustment } from "@/app/actions/evhs"
import { useRouter } from "next/navigation"

const adjustmentSchema = z.object({
    warehouseId: z.string().min(1, "Site VHS wajib dipilih"),
    productId: z.string().min(1, "Produk wajib dipilih"),
    quantity: z.coerce.number().int().min(1, "Qty minimal 1"),
    reason: z.string().min(1, "Alasan wajib diisi"),
})

type AdjustmentValues = z.infer<typeof adjustmentSchema>

type WarehouseOption = {
    id: number
    sloc: string
    description?: string | null
}

type ProductOption = {
    id: number
    materialNumber: string
    materialNumberCk?: string | null
    materialDescription?: string | null
}

export function EvhsStockAdjustmentDialog({
    open,
    onOpenChange,
    warehouses,
    products,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    warehouses: WarehouseOption[]
    products: ProductOption[]
}) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [productSearch, setProductSearch] = useState("")
    const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])
    const router = useRouter()
    const form = useForm<AdjustmentValues>({
        resolver: zodResolver(adjustmentSchema),
        defaultValues: {
            warehouseId: "",
            productId: "",
            quantity: 1,
            reason: "",
        },
    })

    useEffect(() => {
        if (open) {
            form.reset({
                warehouseId: warehouses[0]?.id.toString() || "",
                productId: products[0]?.id.toString() || "",
                quantity: 1,
                reason: "",
            })
            setSelectedProductIds(products[0] ? [products[0].id.toString()] : [])
            setProductSearch("")
        }
    }, [form, open, products, warehouses])

    const filteredProducts = useMemo(() => {
        const query = productSearch.trim().toLowerCase()
        if (!query) return products
        return products.filter((product) => `${product.materialNumber} ${product.materialNumberCk || ""} ${product.materialDescription || ""}`.toLowerCase().includes(query))
    }, [productSearch, products])

    const toggleProduct = (productId: string) => {
        setSelectedProductIds((current) => {
            const next = current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId]
            form.setValue("productId", next[0] || "", { shouldValidate: true })
            return next
        })
    }

    const onSubmit = async (values: AdjustmentValues) => {
        setIsSubmitting(true)
        try {
            const results = await Promise.all(selectedProductIds.map((productId) => createEvhsStockAdjustment({
                warehouseId: Number(values.warehouseId),
                productId: Number(productId),
                quantity: values.quantity,
                notes: values.reason.trim(),
            })))
            const failed = results.find((result) => !result.success)

            if (!failed) {
                toast.success(`${results.length} adjustment stok EVHS berhasil ditambahkan`)
                onOpenChange(false)
                router.refresh()
            } else {
                toast.error("error" in failed ? failed.error : "Gagal menambahkan adjustment")
            }
        } catch (_error) {
            toast.error("Terjadi kesalahan sistem")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                    <DialogTitle>Adjustment Stok EVHS</DialogTitle>
                    <DialogDescription>
                        Tambahkan stok di luar supply dengan mencatat site, produk, dan alasannya.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="adjustment-warehouse">Site VHS</Label>
                        <select
                            id="adjustment-warehouse"
                            {...form.register("warehouseId")}
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            disabled={warehouses.length === 0}
                        >
                            <option value="">Pilih site VHS</option>
                            {warehouses.map((warehouse) => (
                                <option key={warehouse.id} value={warehouse.id}>
                                    {warehouse.sloc} - {warehouse.description || ""}
                                </option>
                            ))}
                        </select>
                        {form.formState.errors.warehouseId && <p className="text-xs text-red-500">{form.formState.errors.warehouseId.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="adjustment-product">Produk</Label>
                        <Input id="adjustment-product-search" placeholder="Cari material CP, CK, atau deskripsi..." value={productSearch} onChange={(event) => setProductSearch(event.target.value)} />
                        <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border p-2">
                            {filteredProducts.map((product) => {
                                const productId = product.id.toString()
                                return <label key={product.id} className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
                                    <Checkbox checked={selectedProductIds.includes(productId)} onCheckedChange={() => toggleProduct(productId)} />
                                    <span>{product.materialNumber}{product.materialNumberCk ? ` / ${product.materialNumberCk}` : ""} - {product.materialDescription || ""}</span>
                                </label>
                            })}
                            {filteredProducts.length === 0 && <p className="p-2 text-xs text-muted-foreground">Produk tidak ditemukan.</p>}
                        </div>
                        <input type="hidden" {...form.register("productId")} value={selectedProductIds[0] || ""} readOnly />
                        {selectedProductIds.length > 0 && <p className="text-xs text-muted-foreground">{selectedProductIds.length} produk dipilih</p>}
                        {form.formState.errors.productId && <p className="text-xs text-red-500">{form.formState.errors.productId.message}</p>}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="adjustment-quantity">Qty</Label>
                            <Input id="adjustment-quantity" type="number" min={1} step={1} {...form.register("quantity")} />
                            {form.formState.errors.quantity && <p className="text-xs text-red-500">{form.formState.errors.quantity.message}</p>}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="adjustment-reason">Alasan</Label>
                        <Textarea id="adjustment-reason" placeholder="Contoh: Stok fisik di luar supply" {...form.register("reason")} />
                        {form.formState.errors.reason && <p className="text-xs text-red-500">{form.formState.errors.reason.message}</p>}
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Batal</Button>
                        <Button type="submit" disabled={isSubmitting || warehouses.length === 0 || products.length === 0}>
                            {isSubmitting ? "Menyimpan..." : "Simpan Adjustment"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
