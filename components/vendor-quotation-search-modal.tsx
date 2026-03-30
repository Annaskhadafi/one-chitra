"use client"

import * as React from "react"
import { useState, useMemo, useEffect, useRef } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
    Search, 
    Eye, 
    ChevronDown,
    ChevronUp,
    FileText,
    X
} from "lucide-react"
import { VendorQuotationWithItems } from "@/types/vendor-quotation"
import { PoPreviewDialog } from "@/components/po-preview-dialog"
import { getVendorQuotations } from "@/app/actions/vendor-quotation"

interface VendorQuotationSearchModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function VendorQuotationSearchModal({ open, onOpenChange }: VendorQuotationSearchModalProps) {
    const [data, setData] = useState<VendorQuotationWithItems[]>([])
    const [loading, setLoading] = useState(true)
    const [globalFilter, setGlobalFilter] = useState("")
    const [expandedQuotationIds, setExpandedQuotationIds] = useState<Set<number>>(new Set())
    const [highlightedItemIds, setHighlightedItemIds] = useState<Set<number>>(new Set())
    const [autoExpanded, setAutoExpanded] = useState(false)
    const prevGlobalFilterRef = useRef("")
    const [previewFileUrl, setPreviewFileUrl] = useState<string | null>(null)
    const [isPreviewOpen, setIsPreviewOpen] = useState(false)

    useEffect(() => {
        if (open) {
            setLoading(true)
            getVendorQuotations()
                .then((result) => {
                    setData(result as VendorQuotationWithItems[])
                    setLoading(false)
                })
                .catch(() => setLoading(false))
        }
    }, [open])

    useEffect(() => {
        const query = globalFilter.trim().toLowerCase()
        const prevQuery = prevGlobalFilterRef.current.trim().toLowerCase()
        
        if (query && query !== prevQuery) {
            const matchingQuotationIds = new Set<number>()
            const matchingItemIds = new Set<number>()
            
            data.forEach((quotation) => {
                const itemMatches = quotation.items.filter((item) => {
                    const searchValue = [
                        item.itemName,
                        item.remark,
                        item.unit,
                        item.qty,
                        item.unitPrice,
                        item.totalPrice,
                    ]
                        .filter(Boolean)
                        .join(" ")
                        .toLowerCase()
                    return searchValue.includes(query)
                })
                
                if (itemMatches.length > 0) {
                    matchingQuotationIds.add(quotation.id)
                    itemMatches.forEach(item => matchingItemIds.add(item.id))
                }
            })
            
            if (matchingQuotationIds.size > 0) {
                setExpandedQuotationIds(matchingQuotationIds)
                setHighlightedItemIds(matchingItemIds)
                setAutoExpanded(true)
            } else {
                if (autoExpanded) {
                    setExpandedQuotationIds(new Set())
                    setHighlightedItemIds(new Set())
                    setAutoExpanded(false)
                }
            }
        } else if (!query && autoExpanded) {
            setExpandedQuotationIds(new Set())
            setHighlightedItemIds(new Set())
            setAutoExpanded(false)
        }
        
        prevGlobalFilterRef.current = globalFilter
    }, [globalFilter, data, autoExpanded])

    const formatCurrency = (value: string | number) =>
        new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            maximumFractionDigits: 0,
        }).format(typeof value === "string" ? parseFloat(value) : value)

    const searchableData = useMemo(() => {
        const query = globalFilter.trim().toLowerCase()
        if (!query) return data

        return data.filter((quotation) => {
            const itemSearchText = quotation.items
                .flatMap((item) => [
                    item.itemName,
                    item.qty,
                    item.unit,
                    item.unitPrice,
                    item.totalPrice,
                    item.remark,
                    formatCurrency(item.unitPrice),
                    formatCurrency(item.totalPrice),
                ])
                .filter(Boolean)
                .join(" ")
                .toLowerCase()

            const quotationSearchText = [
                quotation.quoteNumber,
                quotation.vendorName,
                quotation.quoteDate,
                quotation.remark,
                quotation.fileName,
                quotation.fileUrl,
                quotation.ocrStatus,
                itemSearchText,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()

            return quotationSearchText.includes(query)
        })
    }, [data, globalFilter])

    const getFilteredItems = (quotation: VendorQuotationWithItems) => {
        const searchTerm = globalFilter.trim().toLowerCase()
        if (!searchTerm) return quotation.items

        return quotation.items.filter((item) => {
            const searchValue = [
                item.itemName,
                item.remark,
                item.unit,
                item.qty,
                item.unitPrice,
                item.totalPrice,
                formatCurrency(item.unitPrice),
                formatCurrency(item.totalPrice),
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()

            return searchValue.includes(searchTerm)
        })
    }

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="px-4 py-3 border-b shrink-0">
                        <div className="flex items-center justify-between">
                            <DialogTitle className="text-lg flex items-center gap-2">
                                <FileText className="h-5 w-5" />
                                Cari Harga Vendor
                            </DialogTitle>
                        </div>
                        <div className="relative mt-2">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Cari product, vendor, atau nomor quote..."
                                value={globalFilter}
                                onChange={(e) => setGlobalFilter(e.target.value)}
                                className="pl-9"
                                autoFocus
                            />
                        </div>
                    </DialogHeader>

                    <div className="flex-1 overflow-auto p-0">
                        {loading ? (
                            <div className="flex items-center justify-center h-64">
                                <div className="text-muted-foreground">Memuat data...</div>
                            </div>
                        ) : searchableData.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                                <FileText className="h-12 w-12 mb-4 opacity-20" />
                                <p>Tidak ada vendor quotation yang cocok</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-md z-10">
                                    <TableRow>
                                        <TableHead className="w-10"></TableHead>
                                        <TableHead>No. Quote</TableHead>
                                        <TableHead>Vendor</TableHead>
                                        <TableHead>Tanggal</TableHead>
                                        <TableHead>Items</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                        <TableHead className="w-20">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {searchableData.map((quotation) => {
                                        const isExpanded = expandedQuotationIds.has(quotation.id)
                                        const filteredItems = getFilteredItems(quotation)
                                        return (
                                            <React.Fragment key={quotation.id}>
                                                <TableRow className="cursor-pointer hover:bg-muted/40">
                                                    <TableCell>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                setExpandedQuotationIds((current) => {
                                                                    const newSet = new Set(current)
                                                                    if (newSet.has(quotation.id)) {
                                                                        newSet.delete(quotation.id)
                                                                    } else {
                                                                        newSet.add(quotation.id)
                                                                    }
                                                                    return newSet
                                                                })
                                                            }}
                                                        >
                                                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                        </Button>
                                                    </TableCell>
                                                    <TableCell className="font-mono font-medium">{quotation.quoteNumber || "—"}</TableCell>
                                                    <TableCell className="font-semibold">{quotation.vendorName || "—"}</TableCell>
                                                    <TableCell>{quotation.quoteDate || "—"}</TableCell>
                                                    <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                                                        {quotation.items.length > 0 
                                                            ? quotation.items.map(i => i.itemName).join(", ")
                                                            : "No items"}
                                                    </TableCell>
                                                    <TableCell className="text-right font-semibold">
                                                        {formatCurrency(quotation.items.reduce((sum, item) => sum + parseFloat(item.totalPrice), 0))}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-blue-600 hover:text-blue-700"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                setPreviewFileUrl(quotation.fileUrl)
                                                                setIsPreviewOpen(true)
                                                            }}
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                                {isExpanded && (
                                                    <TableRow className="bg-muted/20">
                                                        <TableCell colSpan={7} className="p-0">
                                                            <div className="border-t bg-background p-3">
                                                                <div className="text-sm font-semibold mb-2">Detail Items</div>
                                                                <div className="overflow-auto rounded-md border max-h-[300px]">
                                                                    <Table className="min-w-[700px]">
                                                                        <TableHeader className="bg-muted/50">
                                                                            <TableRow>
                                                                                <TableHead className="min-w-[250px]">Item</TableHead>
                                                                                <TableHead className="text-right">Qty</TableHead>
                                                                                <TableHead>Unit</TableHead>
                                                                                <TableHead className="text-right">Harga Vendor</TableHead>
                                                                                <TableHead className="text-right">Total</TableHead>
                                                                                <TableHead>Remark</TableHead>
                                                                            </TableRow>
                                                                        </TableHeader>
                                                                        <TableBody>
                                                                            {filteredItems.length > 0 ? (
                                                                                filteredItems.map((item) => {
                                                                                    const isHighlighted = highlightedItemIds.has(item.id)
                                                                                    return (
                                                                                        <TableRow 
                                                                                            key={item.id}
                                                                                            className={isHighlighted ? "bg-yellow-100 dark:bg-yellow-900/30" : undefined}
                                                                                        >
                                                                                            <TableCell className="font-medium">{item.itemName}</TableCell>
                                                                                            <TableCell className="text-right">{item.qty}</TableCell>
                                                                                            <TableCell>{item.unit || "—"}</TableCell>
                                                                                            <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                                                                                            <TableCell className="text-right font-medium">{formatCurrency(item.totalPrice)}</TableCell>
                                                                                            <TableCell className="text-muted-foreground">{item.remark || "—"}</TableCell>
                                                                                        </TableRow>
                                                                                    )
                                                                                })
                                                                            ) : (
                                                                                <TableRow>
                                                                                    <TableCell colSpan={6} className="py-4 text-center text-sm text-muted-foreground">
                                                                                        Tidak ada item yang cocok
                                                                                    </TableCell>
                                                                                </TableRow>
                                                                            )}
                                                                        </TableBody>
                                                                    </Table>
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </React.Fragment>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </div>

                    <div className="px-4 py-2 border-t text-xs text-muted-foreground shrink-0">
                        Menampilkan {searchableData.length} dari {data.length} vendor quotations
                    </div>
                </DialogContent>
            </Dialog>

            <PoPreviewDialog
                open={isPreviewOpen}
                onOpenChange={setIsPreviewOpen}
                poDocument={previewFileUrl}
                title="Vendor Quotation Document"
            />
        </>
    )
}
