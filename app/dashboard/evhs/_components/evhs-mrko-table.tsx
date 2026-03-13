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
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search, Edit2, Save, X, Link, CheckCircle2, Loader2 } from "lucide-react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getEvhsMrkoData, updateMrko } from "@/app/actions/evhs"
import { toast } from "sonner"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

type MrkoVoucherItem = {
    qty?: number | null
    materialNumberCk?: string | null
    product?: {
        materialDescription?: string | null
    } | null
}

type MrkoVoucher = {
    id: number
    vhsNo: string
    date: string | Date
    woNo?: string | null
    mrkoNo?: string | null
    sapInvoiceNo?: string | null
    mrkoStatus?: string | null
    items?: MrkoVoucherItem[]
}

type MrkoGiItem = {
    materialNumber: string
    qty: string | number
}

type MrkoGiRecord = {
    woNo?: string | null
    items?: MrkoGiItem[]
}

type SapRevenueRow = {
    poNo?: string | null
    billingNo?: string | null
}

type MrkoQueryData = {
    vouchers?: MrkoVoucher[]
    giRecords?: MrkoGiRecord[]
    sapRevenue?: SapRevenueRow[]
}

export function EvhsMrkoTable() {
    const queryClient = useQueryClient()
    const [searchTerm, setSearchTerm] = useState("")
    const [editingId, setEditingId] = useState<number | null>(null)
    const [editData, setEditData] = useState({
        mrkoNo: "",
        sapInvoiceNo: ""
    })

    const { data, isLoading } = useQuery<MrkoQueryData>({
        queryKey: ["evhs-mrko-data"],
        queryFn: getEvhsMrkoData
    })

    const vouchers = data?.vouchers || []
    const giRecords = data?.giRecords || []
    const sapRevenue = data?.sapRevenue || []

    const mrkoMutation = useMutation({
        mutationFn: updateMrko,
        onSuccess: () => {
            toast.success("Data MRKO/Invoice berhasil diperbarui")
            setEditingId(null)
            queryClient.invalidateQueries({ queryKey: ["evhs-mrko-data"] })
        },
        onError: () => {
            toast.error("Gagal memperbarui data")
        }
    })

    // Logic for matching (reused from GI Matching)
    const matchedVouchers = vouchers.map(voucher => {
        const voucherItem = voucher.items?.[0] || null
        const materialCk = voucherItem?.materialNumberCk
        
        // Find matching GI using WO Number or Material CK
        const matchedGi = giRecords.find(gi => 
            (gi.woNo && gi.woNo === voucher.woNo) || 
            (gi.items?.some((i) => i.materialNumber === materialCk))
        )

        const giItem = matchedGi?.items?.find((i) => i.materialNumber === materialCk) || matchedGi?.items?.[0] || null

        let status: "MATCHED" | "UNMATCHED" | "PENDING" = "PENDING"
        if (matchedGi) {
            const isMatMatched = giItem?.materialNumber === materialCk
            const isQtyMatched = Number(giItem?.qty || 0) === Number(voucherItem?.qty || 0)
            status = (isMatMatched && isQtyMatched) ? "MATCHED" : "UNMATCHED"
        }
        
        // Find SAP Invoice if mrkoNo exists
        const matchedSap = voucher.mrkoNo ? sapRevenue.find(s => s.poNo === voucher.mrkoNo) : null
        const autoSapInvoice = matchedSap?.billingNo || ""

        return {
            ...voucher,
            item: voucherItem,
            matchStatus: status,
            autoSapInvoice
        }
    }).filter(v => v.matchStatus === "MATCHED" || v.mrkoStatus === "SETTLED") // Show matched or already settled

    const filteredData = matchedVouchers.filter(v => 
        v.vhsNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.woNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.mrkoNo?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const handleSave = (id: number) => {
        mrkoMutation.mutate({ 
            voucherId: id, 
            mrkoStatus: "SETTLED",
            mrkoNo: editData.mrkoNo,
            sapInvoiceNo: editData.sapInvoiceNo || "" // Will be updated by mutation
        })
    }

    const syncWithSap = (mrkoNo: string) => {
        const found = sapRevenue.find(s => s.poNo === mrkoNo)
        if (found) {
            setEditData(prev => ({ ...prev, sapInvoiceNo: found.billingNo || "" }))
            toast.success(`Terdeteksi Invoice SAP: ${found.billingNo}`)
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-emerald-50 p-4 rounded-lg border border-emerald-100">
                <div className="space-y-1">
                    <h4 className="text-sm font-bold text-emerald-900">MRKO & Invoicing (Settlement)</h4>
                    <p className="text-xs text-emerald-700">Proses Invoice SAP berdasarkan data GI yang sudah MATCHED.</p>
                </div>
                <div className="flex gap-2">
                    <div className="relative w-64">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Cari Voucher, WO, atau MRKO..."
                            className="pl-8 h-9 bg-white"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="rounded-md border bg-card overflow-auto relative h-[600px] scrollbar-thin scrollbar-thumb-accent shadow-sm">
                <Table className="relative w-full min-w-[1000px]">
                    <TableHeader className="sticky top-0 bg-secondary shadow-sm z-10 whitespace-nowrap uppercase text-[10px] tracking-wider font-bold">
                        <TableRow>
                            <TableHead className="w-[180px] border-r">Voucher VHS</TableHead>
                            <TableHead className="w-[120px] border-r text-center">Date</TableHead>
                            <TableHead className="w-[150px] border-r">WO Number</TableHead>
                            <TableHead className="border-r">Material (CK)</TableHead>
                            <TableHead className="w-[60px] border-r text-center">Qty</TableHead>
                            <TableHead className="w-[150px] border-r bg-blue-50/50">MRKO Number</TableHead>
                            <TableHead className="w-[180px] border-r bg-emerald-50/50">SAP Invoice No</TableHead>
                            <TableHead className="w-[120px] text-center">Status</TableHead>
                            <TableHead className="w-[80px] text-right pr-4">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={9} className="h-24 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>Memuat data tagihan...</span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : filteredData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground italic">
                                    Tidak ada data yang siap untuk MRKO (Pastikan GI status MATCHED).
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredData.map((v) => (
                                <TableRow key={v.id} className={cn("text-xs group hover:bg-slate-50 transition-colors", v.mrkoStatus === "SETTLED" && "bg-emerald-50/20")}>
                                    <TableCell className="border-r font-mono font-bold text-blue-700">{v.vhsNo}</TableCell>
                                    <TableCell className="border-r text-center">{format(new Date(v.date), "dd-MMM-yy")}</TableCell>
                                    <TableCell className="border-r font-medium text-slate-800">{v.woNo || "-"}</TableCell>
                                    <TableCell className="border-r">
                                        <p className="font-bold">{v.item?.materialNumberCk || "-"}</p>
                                        <p className="text-[10px] text-slate-500 truncate max-w-[200px]">{v.item?.product?.materialDescription}</p>
                                    </TableCell>
                                    <TableCell className="border-r text-center font-bold">{v.item?.qty || 0}</TableCell>
                                    <TableCell className="border-r bg-blue-50/20">
                                        {editingId === v.id ? (
                                            <Input 
                                                className="h-7 text-xs font-mono font-bold border-blue-200" 
                                                value={editData.mrkoNo}
                                                onChange={(e) => {
                                                    setEditData({ ...editData, mrkoNo: e.target.value })
                                                    syncWithSap(e.target.value)
                                                }}
                                                placeholder="MRKO Number..."
                                            />
                                        ) : (
                                            <span className="font-mono font-bold text-blue-600">{v.mrkoNo || "-"}</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="border-r bg-emerald-50/20">
                                        {editingId === v.id ? (
                                            <div className="relative">
                                                <Input 
                                                    className="h-7 text-xs font-mono font-bold border-emerald-200 pr-8" 
                                                    value={editData.sapInvoiceNo}
                                                    onChange={(e) => setEditData({ ...editData, sapInvoiceNo: e.target.value })}
                                                    placeholder="SAP Invoice #..."
                                                />
                                                {v.autoSapInvoice && !editData.sapInvoiceNo && (
                                                    <Button 
                                                        variant="ghost" 
                                                        className="absolute right-0 top-0 h-7 w-7 p-0 text-blue-500"
                                                        onClick={() => setEditData({ ...editData, sapInvoiceNo: v.autoSapInvoice })}
                                                        title="Gunakan Invoice dari SAP"
                                                    >
                                                        <Link className="h-3 w-3" />
                                                    </Button>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="font-mono font-bold text-emerald-700">{v.sapInvoiceNo || v.autoSapInvoice? `${v.autoSapInvoice} (Auto)` : "-"}</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-center border-r">
                                        {v.mrkoStatus === "SETTLED" ? (
                                            <Badge className="bg-emerald-500 text-white border-none text-[9px]">SETTLED</Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-amber-600 border-amber-200 text-[9px] bg-amber-50">OPEN</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {v.mrkoStatus === "SETTLED" ? (
                                            <div className="flex items-center justify-end pr-2 text-emerald-600">
                                                <CheckCircle2 className="h-4 w-4" />
                                            </div>
                                        ) : editingId === v.id ? (
                                            <div className="flex justify-end gap-1 px-1">
                                                <Button size="icon" variant="outline" className="h-6 w-6 text-emerald-600 border-emerald-200" onClick={() => handleSave(v.id)} disabled={mrkoMutation.isPending}>
                                                    <Save className="h-3 w-3" />
                                                </Button>
                                                <Button size="icon" variant="outline" className="h-6 w-6 text-rose-600 border-rose-200" onClick={() => setEditingId(null)}>
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <Button 
                                                size="sm" 
                                                variant="ghost" 
                                                className="h-7 w-7 p-0 rounded-full text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                                                onClick={() => {
                                                    setEditingId(v.id)
                                                    setEditData({ 
                                                        mrkoNo: v.mrkoNo || "", 
                                                        sapInvoiceNo: v.sapInvoiceNo || v.autoSapInvoice || "" 
                                                    })
                                                }}
                                            >
                                                <Edit2 className="h-3.5 w-3.5" />
                                            </Button>
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
