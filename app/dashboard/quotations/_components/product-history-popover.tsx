"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { History, ExternalLink, AlertCircle, TrendingUp, Clock } from "lucide-react"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ProgressLoading } from "@/components/ui/progress-loading"
import { getProductHistoryForQuotation } from "@/app/actions/history-order"
import { cn } from "@/lib/utils"

interface ProductHistoryPopoverProps {
    materialNo: string
    costSap: number | string
    className?: string
}

interface HistoryItem {
    customerName: string
    unitPrice: number
    billingDate: string
    poNo: string
}

export function ProductHistoryPopover({ materialNo, costSap, className }: ProductHistoryPopoverProps) {
    const [open, setOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [history, setHistory] = useState<HistoryItem[]>([])
    const [error, setError] = useState<string | null>(null)

    const numericCostSap = typeof costSap === "string" ? Number(costSap || 0) : costSap

    const fetchHistory = React.useCallback(async () => {
        if (!materialNo) return

        setIsLoading(true)
        setError(null)
        try {
            const result = await getProductHistoryForQuotation(materialNo, numericCostSap)
            if (result.success && result.data) {
                setHistory(result.data as HistoryItem[])
            } else {
                setError(result.error || "Failed to load history")
            }
        } catch {
            setError("An error occurred")
        } finally {
            setIsLoading(false)
        }
    }, [materialNo, numericCostSap])

    useEffect(() => {
        if (open) {
            fetchHistory()
        }
    }, [open, fetchHistory])

    function formatCurrency(value: number) {
        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0,
        }).format(value)
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn("h-7 w-7 text-blue-500 hover:text-blue-700 hover:bg-blue-50 no-print", className)}
                    title="View Sales History"
                >
                    <History className="h-4 w-4" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[350px] p-0" align="start">
                <div className="p-3 border-b bg-muted/30">
                    <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-blue-600" />
                            Unit Price History (Last 3 Years)
                        </h4>
                        <Badge variant="outline" className="text-[10px] font-mono">
                            {materialNo}
                        </Badge>
                    </div>
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                    {isLoading ? (
                        <div className="p-8">
                            <ProgressLoading message="Fetching history..." />
                        </div>
                    ) : error ? (
                        <div className="p-6 text-center">
                            <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2 opacity-50" />
                            <p className="text-sm text-balance text-muted-foreground">{error}</p>
                            <Button variant="link" size="sm" onClick={fetchHistory} className="mt-2">
                                Try again
                            </Button>
                        </div>
                    ) : history.length === 0 ? (
                        <div className="p-8 text-center">
                            <Clock className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">No reference found meeting the criteria.</p>
                            <p className="text-[10px] text-muted-foreground mt-1 italic">Criteria: Unit Price ≥ Cost SAP * Rate and within last 3 years.</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {history.map((item, idx) => (
                                <div key={idx} className="p-3 hover:bg-slate-50 transition-colors">
                                    <div className="flex justify-between items-start gap-2 mb-1">
                                        <div className="font-medium text-sm text-blue-900 truncate flex-1" title={item.customerName}>
                                            {item.customerName}
                                        </div>
                                        <div className="text-xs font-bold text-green-700 whitespace-nowrap">
                                            {formatCurrency(item.unitPrice)}
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                                        <div className="flex items-center gap-1">
                                            <span className="font-semibold uppercase opacity-70">PO:</span>
                                            <span className="font-mono">{item.poNo || "-"}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Clock className="h-2.5 w-2.5" />
                                            <span>{item.billingDate}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="p-2 border-t bg-muted/10 text-center">
                    <p className="text-[10px] text-muted-foreground"> Showing latest sales for 10 different customers</p>
                </div>
            </PopoverContent>
        </Popover>
    )
}
