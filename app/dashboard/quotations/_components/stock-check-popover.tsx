"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { Package, AlertCircle, TrendingUp } from "lucide-react"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ProgressLoading } from "@/components/ui/progress-loading"
import { getStockByMaterialNumber } from "@/app/actions/stock"
import { cn } from "@/lib/utils"

interface StockCheckPopoverProps {
    materialNo: string
    className?: string
}

interface StockItem {
    warehouse: {
        sloc: string
        description: string | null
    }
    totalStock: number
}

export function StockCheckPopover({ materialNo, className }: StockCheckPopoverProps) {
    const [open, setOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [stocks, setStocks] = useState<StockItem[]>([])
    const [error, setError] = useState<string | null>(null)

    const fetchStock = React.useCallback(async () => {
        if (!materialNo) return

        setIsLoading(true)
        setError(null)
        try {
            const result = await getStockByMaterialNumber(materialNo)
            if (result.success && result.data) {
                // Filter ready stock (>0)
                const availableStocks = (result.data as any[]).filter(s => s.totalStock > 0).map(s => ({
                    warehouse: s.warehouse,
                    totalStock: s.totalStock
                }))
                // Sort by totalStock descending
                availableStocks.sort((a, b) => b.totalStock - a.totalStock)
                setStocks(availableStocks)
            } else {
                setError(result.error || "Failed to load stock data")
            }
        } catch {
            setError("An error occurred")
        } finally {
            setIsLoading(false)
        }
    }, [materialNo])

    useEffect(() => {
        if (open) {
            fetchStock()
        }
    }, [open, fetchStock])

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn("h-7 w-7 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 no-print", className)}
                    title="View Available Stock"
                >
                    <Package className="h-4 w-4" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[300px] p-0" align="start">
                <div className="p-3 border-b bg-muted/30">
                    <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                            <Package className="h-4 w-4 text-indigo-600" />
                            Ready Stock
                        </h4>
                        <Badge variant="outline" className="text-[10px] font-mono">
                            {materialNo}
                        </Badge>
                    </div>
                </div>
                <div className="max-h-[250px] overflow-y-auto">
                    {isLoading ? (
                        <div className="p-8">
                            <ProgressLoading message="Fetching stock..." />
                        </div>
                    ) : error ? (
                        <div className="p-6 text-center">
                            <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2 opacity-50" />
                            <p className="text-sm text-balance text-muted-foreground">{error}</p>
                            <Button variant="link" size="sm" onClick={fetchStock} className="mt-2">
                                Try again
                            </Button>
                        </div>
                    ) : stocks.length === 0 ? (
                        <div className="p-8 text-center">
                            <Package className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">No ready stock available.</p>
                            <p className="text-[10px] text-muted-foreground mt-1 italic">Stock is empty across all warehouses.</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {stocks.map((item, idx) => (
                                <div key={idx} className="p-3 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{item.warehouse.sloc}</Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground truncate" title={item.warehouse.description || ""}>
                                            {item.warehouse.description || "Unknown Warehouse"}
                                        </p>
                                    </div>
                                    <div className="text-sm font-bold text-indigo-700">
                                        {item.totalStock} <span className="text-[10px] font-normal text-muted-foreground">PC</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    )
}
