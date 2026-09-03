"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { AlertTriangle, ChevronDown, ExternalLink, Plus, RefreshCw, Save, Trash2 } from "lucide-react"
import { deleteNoStockMonitoringAllocation, saveNoStockMonitoringAllocation } from "@/app/actions/no-stock-monitoring"
import type { getNoStockMonitoringData } from "@/app/actions/no-stock-monitoring"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type MonitoringData = Awaited<ReturnType<typeof getNoStockMonitoringData>>["data"]
type MonitoringItem = MonitoringData[number]
type Allocation = MonitoringItem["allocations"][number]

const statusClass: Record<string, string> = {
    "Belum Diisi": "border-slate-300 bg-slate-50 text-slate-700",
    "PR Terhubung": "border-indigo-300 bg-indigo-50 text-indigo-700",
    "PO Terbit": "border-amber-300 bg-amber-50 text-amber-700",
    "GR Parsial": "border-orange-300 bg-orange-50 text-orange-700",
    "GR Selesai": "border-emerald-300 bg-emerald-50 text-emerald-700",
    "Konflik": "border-red-300 bg-red-50 text-red-700",
}

function statusBadge(status: string) {
    return <Badge variant="outline" className={statusClass[status] ?? ""}>{status}</Badge>
}

function formatNumber(value: number) {
    return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 }).format(value)
}

function groupRows(rows: MonitoringData) {
    const groups = new Map<number, { orderId: number; invoiceNumber: string | null; customerPo: string | null; customerName: string; warehouseId: number | null; salesDate: Date; items: MonitoringItem[] }>()
    for (const row of rows) {
        const current = groups.get(row.orderId)
        if (current) current.items.push(row)
        else groups.set(row.orderId, { orderId: row.orderId, invoiceNumber: row.invoiceNumber, customerPo: row.customerPo, customerName: row.customerName, warehouseId: row.warehouseId, salesDate: row.salesDate, items: [row] })
    }
    return Array.from(groups.values())
}

function AllocationEditor({ itemId, allocation, onComplete }: { itemId: number; allocation?: Allocation; onComplete: () => void }) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [eprPrNumber, setEprPrNumber] = useState(allocation?.eprPrNumber ?? "")
    const [vendorPoNumber, setVendorPoNumber] = useState(allocation?.vendorPoNumber ?? "")
    const [vendorPoItem, setVendorPoItem] = useState(allocation?.vendorPoItem?.toString() ?? "")
    const [allocatedQty, setAllocatedQty] = useState(allocation?.allocatedQty?.toString() ?? "0")

    const submit = () => startTransition(async () => {
        const result = await saveNoStockMonitoringAllocation({
            id: allocation?.id,
            salesOrderItemId: itemId,
            eprPrNumber,
            vendorPoNumber,
            vendorPoItem: vendorPoItem ? Number(vendorPoItem) : null,
            allocatedQty: Number(allocatedQty),
        })
        if (!result.success) {
            toast.error(result.error)
            return
        }
        toast.success("Alokasi procurement tersimpan")
        onComplete()
        router.refresh()
    })

    const remove = () => startTransition(async () => {
        if (!allocation?.id) return onComplete()
        await deleteNoStockMonitoringAllocation(allocation.id)
        toast.success("Alokasi dihapus")
        router.refresh()
    })

    const searchValue = allocation?.eprPrNumber || allocation?.effectivePoNumber

    return (
        <div className="grid gap-2 rounded-lg border bg-background p-3 lg:grid-cols-[1.1fr_1.1fr_110px_110px_1fr_auto]">
            <Input value={eprPrNumber} onChange={(event) => setEprPrNumber(event.target.value)} placeholder="PR EPR" aria-label="PR EPR" />
            <Input value={vendorPoNumber} onChange={(event) => setVendorPoNumber(event.target.value)} placeholder="PO Vendor" aria-label="PO Vendor" />
            <Input value={vendorPoItem} onChange={(event) => setVendorPoItem(event.target.value)} type="number" min="1" placeholder="PO Item" aria-label="PO Item" />
            <Input value={allocatedQty} onChange={(event) => setAllocatedQty(event.target.value)} type="number" min="0" step="0.001" placeholder="Qty" aria-label="Qty Alokasi" />
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {allocation ? statusBadge(allocation.status) : <Badge variant="outline">Draft</Badge>}
                {searchValue && <Link className="inline-flex items-center gap-1 text-indigo-600 hover:underline" href={`/dashboard/epr-integrasi?search=${encodeURIComponent(searchValue)}`}><ExternalLink className="h-3 w-3" /> EPR</Link>}
                {allocation && <span className="basis-full">EPR PO: {allocation.eprVendorPoNumber || "Belum ditemukan"} · EPR Status: {allocation.eprStatus || "Belum ditemukan"} · PO Qty: {formatNumber(allocation.poQty)} · GR SAP: {formatNumber(allocation.sapReceivedQty)} · GR Manual: {formatNumber(allocation.manualReceivedQty)}</span>}
            </div>
            <div className="flex items-center justify-end gap-1">
                <Button type="button" size="sm" onClick={submit} disabled={isPending}><Save className="mr-1.5 h-3.5 w-3.5" />Simpan</Button>
                <Button type="button" size="icon" variant="ghost" onClick={remove} disabled={isPending} aria-label="Hapus alokasi"><Trash2 className="h-4 w-4 text-red-600" /></Button>
            </div>
        </div>
    )
}

function ItemCard({ item }: { item: MonitoringItem }) {
    const [adding, setAdding] = useState(false)
    return (
        <div className="rounded-xl border bg-muted/20 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">{statusBadge(item.status)}<span className="font-mono text-xs text-muted-foreground">Item #{item.itemId}</span></div>
                    <p className="mt-2 font-mono text-sm font-semibold">{item.materialNumber}</p>
                    <p className="text-sm text-muted-foreground">{item.materialDescription}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                    <div><p className="text-xs text-muted-foreground">Outstanding SO</p><p className="font-semibold">{formatNumber(item.outstandingQty)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Stok saat ini</p><p className="font-semibold">{formatNumber(item.availableStock)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Alokasi</p><p className="font-semibold">{formatNumber(item.allocations.reduce((sum, allocation) => sum + allocation.allocatedQty, 0))}</p></div>
                </div>
            </div>

            <div className="mt-4 space-y-2">
                {item.allocations.map((allocation) => <AllocationEditor key={allocation.id} itemId={item.itemId} allocation={allocation} onComplete={() => setAdding(false)} />)}
                {adding && <AllocationEditor itemId={item.itemId} onComplete={() => setAdding(false)} />}
                <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)} disabled={adding}><Plus className="mr-1.5 h-3.5 w-3.5" />Tambah Alokasi PO</Button>
            </div>
        </div>
    )
}

export function NoStockMonitoringClient({ data, warning }: { data: MonitoringData; warning: string | null }) {
    const [tab, setTab] = useState<"active" | "history">("active")
    const activeRows = data.filter((row) => (row.isNoStock || row.allocations.length > 0) && row.status !== "GR Selesai")
    const historyRows = data.filter((row) => row.allocations.length > 0 && !activeRows.includes(row))
    const visibleRows = tab === "active" ? activeRows : historyRows
    const groups = useMemo(() => groupRows(visibleRows), [visibleRows])
    const conflictCount = data.filter((row) => row.status === "Konflik").length

    return (
        <div className="space-y-5 p-4 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">No Stock Monitoring</h1>
                    <p className="text-sm text-muted-foreground">Sales Order ber-PO Customer yang membutuhkan tindak lanjut Procurement.</p>
                </div>
                <Button variant="outline" onClick={() => window.location.reload()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
            </div>
            {warning && <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800"><AlertTriangle className="h-4 w-4 shrink-0" />{warning}</div>}
            {conflictCount > 0 && <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"><AlertTriangle className="h-4 w-4 shrink-0" />{conflictCount} item memiliki konflik nomor PO lokal dan EPR.</div>}

            <div className="grid gap-3 sm:grid-cols-3">
                <Card><CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Item Aktif</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{activeRows.length}</p></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Sales Order Aktif</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{new Set(activeRows.map((row) => row.orderId)).size}</p></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Histori</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{historyRows.length}</p></CardContent></Card>
            </div>

            <div className="flex gap-2 border-b">
                <button type="button" className={`border-b-2 px-3 py-2 text-sm font-medium ${tab === "active" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`} onClick={() => setTab("active")}>Aktif ({activeRows.length})</button>
                <button type="button" className={`border-b-2 px-3 py-2 text-sm font-medium ${tab === "history" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`} onClick={() => setTab("history")}>Histori ({historyRows.length})</button>
            </div>

            {groups.length === 0 ? <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">Tidak ada data pada tab ini.</CardContent></Card> : (
                <div className="space-y-3">
                    {groups.map((group) => (
                        <details key={group.orderId} open className="group rounded-xl border bg-card shadow-sm">
                            <summary className="flex cursor-pointer list-none flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden">
                                <div><div className="flex flex-wrap items-center gap-2"><ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" /><span className="font-mono font-semibold">{group.invoiceNumber || `SO-${group.orderId}`}</span><Badge variant="secondary">{group.items.length} item</Badge></div><p className="mt-1 text-sm text-muted-foreground">PO Customer: {group.customerPo || "-"} · {group.customerName}</p></div>
                                <Link href={`/dashboard/sales-orders/${group.orderId}/edit`} className="text-sm text-indigo-600 hover:underline" onClick={(event) => event.stopPropagation()}>Buka Sales Order</Link>
                            </summary>
                            <div className="space-y-3 border-t p-3 sm:p-4">{group.items.map((item) => <ItemCard key={item.itemId} item={item} />)}</div>
                        </details>
                    ))}
                </div>
            )}
        </div>
    )
}
