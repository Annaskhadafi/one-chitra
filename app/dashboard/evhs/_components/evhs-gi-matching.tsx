"use client"

import { useState } from "react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Upload, FileSearch, CheckCircle2, XCircle, AlertCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useQuery } from "@tanstack/react-query"
import { getGiRecords, getEvhsVouchers } from "@/app/actions/evhs"
import { getEvhsMasterPrices } from "@/app/actions/evhs-master"
import { format } from "date-fns"

export function EvhsGiMatching() {
    const [isImporting, setIsImporting] = useState(false)

    const { data: giRecords = [] } = useQuery<any[]>({
        queryKey: ["evhs-gi-records"],
        queryFn: async () => await getGiRecords()
    })

    const { data: vouchers = [] } = useQuery<any[]>({
        queryKey: ["evhs-vouchers"],
        queryFn: async () => await getEvhsVouchers()
    })

    const { data: masterPrices = [] } = useQuery<any[]>({
        queryKey: ["evhs-master-prices"],
        queryFn: async () => await getEvhsMasterPrices()
    })

    // Helper to find price for a material & warehouse
    const findMasterPrice = (materialCp: string, materialCk: string, warehouseId: number) => {
        const found = masterPrices.find(p => 
            (p.materialNumberCp === materialCp || (materialCk && p.materialNumberCk === materialCk)) && 
            p.warehouseId === warehouseId
        )
        return found ? found.price : null
    }

    // Logic for matching:
    const matchingData = vouchers.map(voucher => {
        const voucherItem = voucher.items?.[0] || {}
        const materialCk = voucherItem?.materialNumberCk
        const priceFromMaster = findMasterPrice(voucherItem?.product?.materialNumber, materialCk, voucher.warehouseId)
        
        // Find matching GI using WO Number as primary key
        const matchedGi = giRecords.find(gi => 
            gi.woNo === voucher.woNo || 
            (gi.giItems?.some((i: any) => i.materialNumber === materialCk))
        )

        const giItem = matchedGi?.giItems?.[0] || {}
        
        // Also find master price for CK side if it's different or to double check
        const ckPriceFromMaster = findMasterPrice(null as any, giItem.materialNumber, voucher.warehouseId)

        let status: "MATCHED" | "UNMATCHED" | "PENDING" = "PENDING"
        if (matchedGi) {
            const isMatMatched = giItem.materialNumber === materialCk
            const isQtyMatched = Number(giItem.giQty) === Number(voucherItem.qty)
            status = (isMatMatched && isQtyMatched) ? "MATCHED" : "UNMATCHED"
        }
        
        return {
            ...voucher,
            item: voucherItem,
            price: priceFromMaster,
            ckPrice: ckPriceFromMaster,
            matchedGi: matchedGi || null,
            giItem: giItem,
            matchStatus: status
        }
    })

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-blue-50 p-4 rounded-lg border border-blue-100">
                <div className="space-y-1">
                    <h4 className="text-sm font-bold text-blue-900">Import GI Excel Customer</h4>
                    <p className="text-xs text-blue-700">Upload data GI harian yang diberikan oleh Customer untuk proses matching.</p>
                </div>
                <Button variant="outline" className="bg-white border-blue-200 text-blue-700 hover:bg-blue-100" size="sm">
                    <Upload className="mr-2 h-4 w-4" />
                    Upload CSV / Excel
                </Button>
            </div>

            <div className="rounded-md border bg-card overflow-x-auto shadow-sm">
                <Table className="min-w-[1200px]">
                    <TableHeader>
                        {/* Primary Group Header */}
                        <TableRow className="bg-slate-50 border-b-2">
                            <TableHead colSpan={7} className="text-center font-bold text-blue-800 border-r bg-blue-50/50 uppercase text-[10px] tracking-widest py-1">
                                PT. CHITRA PARATAMA
                            </TableHead>
                            <TableHead colSpan={6} className="text-center font-bold text-emerald-800 border-r bg-emerald-50/50 uppercase text-[10px] tracking-widest py-1">
                                PT. CIPTA KRIDATAMA
                            </TableHead>
                            <TableHead className="text-center font-bold text-slate-800 uppercase text-[10px] tracking-widest py-1">
                                STATUS
                            </TableHead>
                        </TableRow>
                        
                        {/* Sub Column Headers */}
                        <TableRow className="bg-slate-100/50 text-[9px] uppercase font-bold tracking-tighter">
                            {/* CHITRA */}
                            <TableHead className="border-r px-2">Material Description</TableHead>
                            <TableHead className="border-r px-2">Material Number</TableHead>
                            <TableHead className="border-r px-1 text-center bg-amber-50">Mat Number CK</TableHead>
                            <TableHead className="border-r px-2">Serial Number</TableHead>
                            <TableHead className="border-r px-2">WO</TableHead>
                            <TableHead className="border-r px-1 text-center">Qty</TableHead>
                            <TableHead className="border-r px-2 text-right bg-blue-50 font-bold text-blue-800">Price (Master)</TableHead>
                            
                            {/* CK */}
                            <TableHead className="border-r px-2">Material Description</TableHead>
                            <TableHead className="border-r px-2 bg-amber-50">Material Number CK</TableHead>
                            <TableHead className="border-r px-2">WO</TableHead>
                            <TableHead className="border-r px-1 text-center">Qty</TableHead>
                            <TableHead className="border-r px-2 text-right font-bold text-emerald-800">Price (Master)</TableHead>
                            <TableHead className="border-r px-2">No GI</TableHead>
                            
                            {/* MATCHING */}
                            <TableHead className="text-center">Matched / Unmatched</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {matchingData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={14} className="h-24 text-center text-muted-foreground italic">
                                    Belum ada data penggunaan untuk di-matching.
                                </TableCell>
                            </TableRow>
                        ) : (
                            matchingData.map((data) => (
                                <TableRow key={data.id} className="text-[10px] hover:bg-slate-50 transition-colors">
                                    {/* CHITRA SIDE */}
                                    <TableCell className="border-r px-2 truncate max-w-[150px]" title={data.item?.product?.materialDescription}>
                                        {data.item?.product?.materialDescription || "-"}
                                    </TableCell>
                                    <TableCell className="border-r px-2 font-mono">{data.item?.product?.materialNumber || "-"}</TableCell>
                                    <TableCell className="border-r px-2 font-mono bg-amber-50/30 text-blue-700 font-bold">{data.item?.materialNumberCk || "-"}</TableCell>
                                    <TableCell className="border-r px-2 font-mono italic">{data.item?.serialNumber || "-"}</TableCell>
                                    <TableCell className="border-r px-2 font-bold">{data.woNo || "-"}</TableCell>
                                    <TableCell className="border-r px-1 text-center font-bold">{data.item?.qty || 0}</TableCell>
                                    <TableCell className="border-r px-2 text-right font-mono bg-blue-100/50 font-bold text-blue-900">
                                        {data.price ? Number(data.price).toLocaleString('id-ID', { minimumFractionDigits: 2 }) : "-"}
                                    </TableCell>
                                    
                                    {/* CK SIDE */}
                                    <TableCell className="border-r px-2 truncate max-w-[150px] italic text-slate-500">
                                        {data.giItem?.materialDescription || "-"}
                                    </TableCell>
                                    <TableCell className="border-r px-2 font-mono bg-amber-50/30">
                                        {data.giItem?.materialNumber || "-"}
                                    </TableCell>
                                    <TableCell className="border-r px-2 font-medium">{data.matchedGi?.woNo || "-"}</TableCell>
                                    <TableCell className="border-r px-1 text-center font-bold">
                                        {data.giItem?.giQty ? Number(data.giItem.giQty) : "-"}
                                    </TableCell>
                                    <TableCell className="border-r px-2 text-right font-mono bg-emerald-50 font-bold text-emerald-900">
                                        {data.ckPrice ? Number(data.ckPrice).toLocaleString('id-ID', { minimumFractionDigits: 2 }) : 
                                         data.giItem?.price ? Number(data.giItem.price).toLocaleString('id-ID', { minimumFractionDigits: 2 }) : "-"}
                                    </TableCell>
                                    <TableCell className="border-r px-2 font-mono text-blue-600 font-medium">{data.matchedGi?.giNumber || "-"}</TableCell>
                                    
                                    {/* STATUS */}
                                    <TableCell className="text-center font-bold">
                                        {data.matchStatus === "MATCHED" ? (
                                            <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">Matched</span>
                                        ) : data.matchStatus === "UNMATCHED" ? (
                                            <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">Unmatched</span>
                                        ) : (
                                            <span className="text-slate-400 italic">Pending</span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
