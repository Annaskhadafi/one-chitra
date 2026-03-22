"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import Fuse from "fuse.js"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
import { getCustomerOrderHistory } from "@/app/actions/customer-segmentation"
import { ProgressLoading } from "@/components/ui/progress-loading"
import { Package, Calendar, DollarSign, ArchiveRestore, ShoppingCart } from "lucide-react"

interface CustomerHistorySheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    customerName: string
}

export function CustomerHistorySheet({ open, onOpenChange, customerName }: CustomerHistorySheetProps) {
    // 1. Fetch Order History
    const { data: historyData, isLoading: isLoadingHistory } = useQuery({
        queryKey: ["customer-history", customerName],
        queryFn: async () => {
            if (!customerName) return {}
            const res = await getCustomerOrderHistory(customerName)
            if (res.success && res.data) {
                return res.data
            }
            return {}
        },
        enabled: open && !!customerName,
    })

    // 2. Fetch SAP Stock for fuzzy matching
    const { data: stockData = [], isLoading: isLoadingStock } = useQuery({
        queryKey: ["all-stocks-sap", "for-history"],
        queryFn: async () => {
            // Gunakan all=true agar semua data diambil untuk fuzzy matching
            const res = await fetch("/api/stocks-sap-new?all=true")
            if (res.ok) {
                const json = await res.json()
                if (json.status === "OK") return json.result
            }
            return []
        },
        enabled: open,
        staleTime: 10 * 60 * 1000, // cache 10 menit
    })

    const isLoading = isLoadingHistory || isLoadingStock

    const formatIDR = (val: number) => new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0
    }).format(val);

    const formatDate = (dateString: string | null) => {
        if (!dateString) return '-'
        return new Date(dateString).toLocaleDateString('id-ID', {
            day: 'numeric', month: 'short', year: 'numeric'
        })
    }

    const getMatchingStock = React.useCallback((materialNo: string, materialDesc: string) => {
        if (!stockData.length) return null;

        // 1. Exact match by Material No
        const exactMatches = stockData.filter((s: any) =>
            s.materialNo === materialNo || s.oldMaterialNo === materialNo
        );

        if (exactMatches.length > 0) {
            const totalStock = exactMatches.reduce((acc: number, curr: any) => acc + (curr.totalStock || 0), 0);
            return { type: 'Exact', total: totalStock, warehouses: exactMatches };
        }

        // 2. Fuzzy match by Material Description
        const fuse = new Fuse(stockData, {
            keys: ["materialDesc", "materialNo", "oldMaterialNo"],
            threshold: 0.3,
            ignoreLocation: true,
            minMatchCharLength: 5,
        });

        // Clean query to get better match (take first 3 words)
        const cleanQuery = materialDesc.split(' ').slice(0, 3).join(' ').replace(/[-_]/g, ' ');
        const results = fuse.search(cleanQuery);

        if (results.length > 0) {
            // Group the best hit by its materialNo to sum all storLocs
            const bestHitMatNo = (results[0].item as any).materialNo;
            const allBestHits = results
                .filter(r => (r.item as any).materialNo === bestHitMatNo)
                .map(r => r.item as any);

            const totalStock = allBestHits.reduce((acc: number, curr: any) => acc + (curr.totalStock || 0), 0);
            return {
                type: 'Fuzzy',
                total: totalStock,
                warehouses: allBestHits,
                matchedDesc: allBestHits[0].materialDesc
            };
        }

        return null;
    }, [stockData]);

    const categories = historyData ? Object.keys(historyData).sort() : []

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-4xl overflow-y-auto">
                <SheetHeader className="mb-6">
                    <SheetTitle className="flex items-center gap-2 text-xl">
                        <ShoppingCart className="text-primary" />
                        History Order Customer
                    </SheetTitle>
                    <SheetDescription className="text-base font-medium text-foreground">
                        {customerName}
                    </SheetDescription>
                </SheetHeader>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center min-h-[400px]">
                        <ProgressLoading message="Mengambil data histori order dan mencocokkan stok SAP..." />
                    </div>
                ) : categories.length === 0 ? (
                    <div className="flex flex-col items-center justify-center min-h-[400px] text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                        <ArchiveRestore className="h-10 w-10 mb-3 opacity-50" />
                        <p>Tidak ada riwayat pembelanjaan ditemukan.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <Accordion type="multiple" defaultValue={categories} className="w-full">
                            {categories.map(category => {
                                const items = historyData?.[category] || [];
                                const totalCatRevenue = items.reduce((acc: number, curr: any) => acc + curr.revenue, 0);

                                return (
                                    <AccordionItem key={category} value={category} className="border bg-card rounded-lg mb-4 px-4 shadow-sm overflow-hidden">
                                        <AccordionTrigger className="hover:no-underline py-4">
                                            <div className="flex items-center justify-between w-full pr-4">
                                                <div className="flex items-center gap-2">
                                                    <Package className="h-4 w-4 text-muted-foreground" />
                                                    <span className="font-bold text-base">{category}</span>
                                                    <Badge variant="secondary" className="ml-2 font-normal text-xs">
                                                        Top {items.length}
                                                    </Badge>
                                                </div>
                                                <div className="text-sm font-semibold text-emerald-600 flex items-center gap-1 hidden sm:flex">
                                                    <DollarSign className="h-3 w-3" />
                                                    {formatIDR(totalCatRevenue)}
                                                </div>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="pt-0 pb-4">
                                            <div className="rounded-md border overflow-hidden">
                                                <Table>
                                                    <TableHeader className="bg-muted/50">
                                                        <TableRow>
                                                            <TableHead className="w-[40%]">Produk</TableHead>
                                                            <TableHead>Revenue (Total)</TableHead>
                                                            <TableHead>Pembelian Terakhir</TableHead>
                                                            <TableHead className="text-right">Stok SAP</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {items.map((item: any, idx: number) => {
                                                            const stockInfo = getMatchingStock(item.materialNo, item.materialDescription);
                                                            return (
                                                                <TableRow key={idx}>
                                                                    <TableCell>
                                                                        <div className="font-medium text-sm text-foreground">
                                                                            {item.materialDescription || 'Unknown Material'}
                                                                        </div>
                                                                        <div className="text-xs text-muted-foreground mt-1 font-mono">
                                                                            {item.materialNo} • Total Qty: {item.totalQty}
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell className="font-medium">
                                                                        {formatIDR(item.revenue)}
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                                                            <Calendar className="h-3 w-3" />
                                                                            {formatDate(item.lastPurchaseDate)}
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell className="text-right">
                                                                        {stockInfo ? (
                                                                            <div className="flex flex-col items-end gap-1">
                                                                                <Badge variant={stockInfo.total > 0 ? "default" : "destructive"}>
                                                                                    {stockInfo.total} Tersedia
                                                                                </Badge>
                                                                                {stockInfo.type === 'Fuzzy' && (
                                                                                    <span className="text-[10px] text-muted-foreground" title={stockInfo.matchedDesc}>
                                                                                        Fuzzy Match (~{(stockInfo.matchedDesc || "").substring(0, 15)}...)
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        ) : (
                                                                            <Badge variant="outline" className="text-muted-foreground">
                                                                                Tidak Ditemukan
                                                                            </Badge>
                                                                        )}
                                                                    </TableCell>
                                                                </TableRow>
                                                            )
                                                        })}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                )
                            })}
                        </Accordion>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    )
}
