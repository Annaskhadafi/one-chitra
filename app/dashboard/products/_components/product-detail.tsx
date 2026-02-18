"use client"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Package, Eye } from "lucide-react"
import { type Product } from "@/lib/types"

interface ProductDetailProps {
    product: Product
    manualRate: number
    trigger?: React.ReactNode
}

export function ProductDetail({ product, manualRate, trigger }: ProductDetailProps) {
    const costSap = Number(product.costSap || 0)
    const costIdr = costSap * manualRate

    const formatCurrency = (amount: number, currency: string = 'USD') => {
        return new Intl.NumberFormat(currency === 'IDR' ? 'id-ID' : 'en-US', {
            style: 'currency',
            currency
        }).format(amount)
    }

    return (
        <Dialog>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="ghost" size="icon">
                        <Eye className="h-4 w-4" />
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Product Details</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                    <div className="space-y-4">
                        {product.imageUrl ? (
                            <div className="aspect-square rounded-lg overflow-hidden border">
                                <img src={product.imageUrl} alt={product.materialNumber} className="w-full h-full object-cover" />
                            </div>
                        ) : (
                            <div className="aspect-square rounded-lg bg-muted flex items-center justify-center text-muted-foreground border">
                                <Package className="h-12 w-12" />
                            </div>
                        )}
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium text-muted-foreground">Category</label>
                            <div className="mt-1">
                                <Badge variant="secondary" className="font-semibold">{product.category}</Badge>
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-muted-foreground">Material Number</label>
                            <p className="text-lg font-bold text-blue-600 font-mono">{product.materialNumber}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium text-muted-foreground">Plant</label>
                                <p className="font-medium font-mono">{product.plant || "-"}</p>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground">Sloc</label>
                                <p className="font-medium font-mono">{product.sloc || "-"}</p>
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-muted-foreground">Sloc Description</label>
                            <p className="text-sm">{product.slocDescription || "-"}</p>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-muted-foreground">Old Material No</label>
                            <p className="font-medium">{product.oldMaterialNo || "-"}</p>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-muted-foreground">Description</label>
                            <p className="text-sm text-balance">{product.materialDescription || "-"}</p>
                        </div>
                        <div className="pt-2 border-t">
                            <label className="text-sm font-medium text-muted-foreground underline">Pricing</label>
                            <div className="mt-2 space-y-1">
                                <div className="flex justify-between text-sm">
                                    <span>Cost SAP (USD):</span>
                                    <span className="font-mono">{formatCurrency(costSap)}</span>
                                </div>
                                <div className="flex justify-between text-xs text-muted-foreground font-italic">
                                    <span>Exchange Rate:</span>
                                    <span>{formatCurrency(manualRate, 'IDR')}</span>
                                </div>
                                <div className="flex justify-between text-md font-bold pt-1 border-t mt-1">
                                    <span>Cost IDR:</span>
                                    <span className="text-blue-600">{formatCurrency(costIdr, 'IDR')}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
