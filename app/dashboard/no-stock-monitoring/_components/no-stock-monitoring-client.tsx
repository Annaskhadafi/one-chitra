"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { AlertTriangle, ChevronDown, Download, ExternalLink, Plus, RefreshCw, Save, Search, Trash2, X } from "lucide-react"
import * as XLSX from "xlsx"
import { deleteNoStockMonitoringAllocation, saveNoStockMonitoringAllocation } from "@/app/actions/no-stock-monitoring"
import type { getNoStockMonitoringData } from "@/app/actions/no-stock-monitoring"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
    return <select aria-label={`Filter ${label}`} value={value} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm"><option key={`${label}-all`} value="all">Semua {label}</option>{options.map((option) => <option key={`${label}-${option}`} value={option}>{option}</option>)}</select>
}

function groupRows(rows: MonitoringData) {
    const groups = new Map<number, { orderId: number; invoiceNumber: string | null; customerPo: string | null; customerName: string; salesPersonName: string; warehouseId: number | null; salesDate: Date; items: MonitoringItem[] }>()
    for (const row of rows) {
        const current = groups.get(row.orderId)
        if (current) current.items.push(row)
        else groups.set(row.orderId, { orderId: row.orderId, invoiceNumber: row.invoiceNumber, customerPo: row.customerPo, customerName: row.customerName, salesPersonName: row.salesPersonName, warehouseId: row.warehouseId, salesDate: row.salesDate, items: [row] })
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

function ItemTableRow({ item, selected, onSelect }: { item: MonitoringItem; selected: boolean; onSelect: () => void }) {
    const [adding, setAdding] = useState(false)
    const allocatedQty = item.allocations.reduce((sum, allocation) => sum + allocation.allocatedQty, 0)

    return (
        <tr className="align-top hover:bg-muted/20">
            <td className="p-3"><input type="checkbox" checked={selected} onChange={onSelect} aria-label={`Pilih item ${item.itemId}`} /></td>
            <td className="whitespace-nowrap p-3">{statusBadge(item.status)}<div className="mt-1 text-xs text-muted-foreground">Item #{item.itemId}</div></td>
            <td className="min-w-[220px] p-3"><p className="font-mono font-semibold">{item.materialNumber}</p><p className="text-xs text-muted-foreground">{item.materialDescription}</p></td>
            <td className="whitespace-nowrap p-3 text-right font-medium">{formatNumber(item.outstandingQty)}</td>
            <td className="whitespace-nowrap p-3 text-right">{formatNumber(item.availableStock)}</td>
            <td className="whitespace-nowrap p-3 text-right font-medium">{formatNumber(allocatedQty)}</td>
            <td className="min-w-[500px] p-2">
                <div className="space-y-2">
                    {item.allocations.map((allocation) => <AllocationEditor key={allocation.id} itemId={item.itemId} allocation={allocation} onComplete={() => setAdding(false)} />)}
                    {adding && <AllocationEditor itemId={item.itemId} onComplete={() => setAdding(false)} />}
                    <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)} disabled={adding}><Plus className="mr-1.5 h-3.5 w-3.5" />Tambah PO</Button>
                </div>
            </td>
            <td className="whitespace-nowrap p-3 text-xs text-muted-foreground">{item.allocations.length ? item.allocations.map((allocation) => <div key={allocation.id}>{allocation.eprStatus || "Pending"}<br />GR {formatNumber(allocation.receivedQty)} / {formatNumber(allocation.poQty)}</div>) : "-"}</td>
        </tr>
    )
}

export function NoStockMonitoringClient({ data, warning }: { data: MonitoringData; warning: string | null }) {
    const [tab, setTab] = useState<"active" | "history">("active")
    const [search, setSearch] = useState("")
    const [customerFilter, setCustomerFilter] = useState("all")
    const [salesFilter, setSalesFilter] = useState("all")
    const [materialFilter, setMaterialFilter] = useState("all")
    const [selectedItemIds, setSelectedItemIds] = useState<Set<number>>(new Set())
    const [collapsedOrders, setCollapsedOrders] = useState<Set<number>>(new Set())
    const activeRows = data.filter((row) => (row.isNoStock || row.allocations.length > 0) && row.status !== "GR Selesai")
    const historyRows = data.filter((row) => row.allocations.length > 0 && !activeRows.includes(row))
    const visibleRows = tab === "active" ? activeRows : historyRows
    const customers = useMemo(() => Array.from(new Set(data.map((row) => row.customerName))).sort(), [data])
    const salesPeople = useMemo(() => Array.from(new Set(data.map((row) => row.salesPersonName))).sort(), [data])
    const materials = useMemo(() => Array.from(new Set(data.map((row) => row.materialNumber))).sort(), [data])
    const filteredRows = useMemo(() => {
        const query = search.trim().toLowerCase()
        return visibleRows.filter((row) => {
            const searchable = [row.invoiceNumber, row.customerPo, row.customerName, row.salesPersonName, row.materialNumber, row.materialDescription, ...row.allocations.flatMap((allocation) => [allocation.eprPrNumber, allocation.vendorPoNumber, allocation.vendorPoItem?.toString()])].filter(Boolean).join(" ").toLowerCase()
            return (!query || searchable.includes(query)) && (customerFilter === "all" || row.customerName === customerFilter) && (salesFilter === "all" || row.salesPersonName === salesFilter) && (materialFilter === "all" || row.materialNumber === materialFilter)
        })
    }, [customerFilter, materialFilter, salesFilter, search, visibleRows])
    const groups = useMemo(() => groupRows(filteredRows), [filteredRows])
    const conflictCount = data.filter((row) => row.status === "Konflik").length
    const statusSummary = ["Belum Diisi", "PR Terhubung", "PO Terbit", "GR Parsial", "GR Selesai", "Konflik"].map((status) => ({ status, count: filteredRows.filter((row) => row.status === status).length }))
    const maxStatusCount = Math.max(...statusSummary.map((entry) => entry.count), 1)

    const selectedVisibleCount = filteredRows.filter((row) => selectedItemIds.has(row.itemId)).length
    const exportExcel = () => {
        const rowsToExport = selectedVisibleCount > 0 ? filteredRows.filter((row) => selectedItemIds.has(row.itemId)) : filteredRows
        const rows = rowsToExport.flatMap((row) => (row.allocations.length ? row.allocations : [undefined]).map((allocation) => ({
            "Sales Order": row.invoiceNumber || `SO-${row.orderId}`,
            "PO Customer": row.customerPo || "",
            Customer: row.customerName,
            Sales: row.salesPersonName,
            "Material Number": row.materialNumber,
            Description: row.materialDescription,
            "Outstanding SO": row.outstandingQty,
            "Stok": row.availableStock,
            "PR EPR": allocation?.eprPrNumber || "",
            "PO Vendor": allocation?.vendorPoNumber || allocation?.eprVendorPoNumber || "",
            "PO Item": allocation?.vendorPoItem || "",
            "Qty Alokasi": allocation?.allocatedQty || 0,
            Status: row.status,
            "Status EPR": allocation?.eprStatus || "",
            "GR SAP": allocation?.sapReceivedQty || 0,
            "GR Manual": allocation?.manualReceivedQty || 0,
        })))
        if (!rows.length) return toast.info("Tidak ada data untuk diekspor")
        const worksheet = XLSX.utils.json_to_sheet(rows)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, "No Stock Monitoring")
        XLSX.writeFile(workbook, `no-stock-monitoring-${new Date().toISOString().slice(0, 10)}.xlsx`)
    }

    const clearFilters = () => {
        setSearch("")
        setCustomerFilter("all")
        setSalesFilter("all")
        setMaterialFilter("all")
    }

    const toggleItem = (itemId: number) => setSelectedItemIds((current) => {
        const next = new Set(current)
        if (next.has(itemId)) next.delete(itemId)
        else next.add(itemId)
        return next
    })

    const toggleAllVisible = () => setSelectedItemIds((current) => {
        const next = new Set(current)
        const allSelected = filteredRows.length > 0 && filteredRows.every((row) => next.has(row.itemId))
        filteredRows.forEach((row) => allSelected ? next.delete(row.itemId) : next.add(row.itemId))
        return next
    })

    const toggleGroup = (orderId: number) => setCollapsedOrders((current) => {
        const next = new Set(current)
        if (next.has(orderId)) next.delete(orderId)
        else next.add(orderId)
        return next
    })

    return (
        <div className="space-y-4 p-4 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">No Stock Monitoring</h1>
                    <p className="text-sm text-muted-foreground">Sales Order ber-PO Customer yang membutuhkan tindak lanjut Procurement.</p>
                </div>
                <div className="flex gap-2"><Button variant="outline" onClick={exportExcel}><Download className="mr-2 h-4 w-4" />Export Excel{selectedVisibleCount > 0 && ` (${selectedVisibleCount})`}</Button><Button variant="outline" onClick={() => window.location.reload()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button></div>
            </div>
            {warning && <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800"><AlertTriangle className="h-4 w-4 shrink-0" />{warning}</div>}
            {conflictCount > 0 && <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"><AlertTriangle className="h-4 w-4 shrink-0" />{conflictCount} item memiliki konflik nomor PO lokal dan EPR.</div>}

            <div className="rounded-lg border bg-card p-3"><div className="mb-2 flex items-center justify-between text-sm font-medium"><span>Grafik Ringkasan Status</span><span className="text-xs text-muted-foreground">{filteredRows.length} item</span></div><div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">{statusSummary.map(({ status, count }) => <div key={status} className="min-w-0"><div className="mb-1 flex justify-between text-xs"><span className="truncate text-muted-foreground">{status}</span><span className="font-semibold">{count}</span></div><div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${(count / maxStatusCount) * 100}%` }} /></div></div>)}</div></div>

            <div className="flex gap-2 border-b">
                <button type="button" className={`border-b-2 px-3 py-2 text-sm font-medium ${tab === "active" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`} onClick={() => setTab("active")}>Aktif ({activeRows.length})</button>
                <button type="button" className={`border-b-2 px-3 py-2 text-sm font-medium ${tab === "history" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`} onClick={() => setTab("history")}>Histori ({historyRows.length})</button>
            </div>

            <div className="flex flex-wrap items-center gap-2"><div className="relative min-w-[220px] flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Cari SO, customer, sales, barang, PO..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><FilterSelect label="Customer" value={customerFilter} options={customers} onChange={setCustomerFilter} /><FilterSelect label="Sales" value={salesFilter} options={salesPeople} onChange={setSalesFilter} /><FilterSelect label="Barang" value={materialFilter} options={materials} onChange={setMaterialFilter} />{(search || customerFilter !== "all" || salesFilter !== "all" || materialFilter !== "all") && <Button type="button" variant="ghost" size="sm" onClick={clearFilters}><X className="mr-1 h-4 w-4" />Reset</Button>}</div>

            {groups.length === 0 ? <div className="rounded-lg border py-12 text-center text-sm text-muted-foreground">Tidak ada data yang sesuai.</div> : <div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[1200px] text-sm"><thead className="bg-muted/50"><tr className="border-b text-left"><th className="p-3"><input type="checkbox" checked={filteredRows.length > 0 && filteredRows.every((row) => selectedItemIds.has(row.itemId))} onChange={toggleAllVisible} aria-label="Pilih semua item yang tampil" /></th><th className="p-3">Status</th><th className="p-3">Barang</th><th className="p-3 text-right">Outstanding</th><th className="p-3 text-right">Stok</th><th className="p-3 text-right">Alokasi</th><th className="p-3">PR / PO Vendor</th><th className="p-3">EPR / GR</th></tr></thead>{groups.map((group) => { const collapsed = collapsedOrders.has(group.orderId); return <tbody key={group.orderId} className="divide-y"><tr className="bg-muted/30"><td colSpan={8} className="p-3"><div className="flex flex-wrap items-center gap-x-4 gap-y-1"><button type="button" onClick={() => toggleGroup(group.orderId)} aria-expanded={!collapsed} className="inline-flex items-center gap-1 font-mono font-semibold hover:text-primary"><ChevronDown className={`h-4 w-4 transition-transform ${collapsed ? "-rotate-90" : ""}`} />{group.invoiceNumber || `SO-${group.orderId}`}</button><Link href={`/dashboard/sales-orders/${group.orderId}/edit`} className="text-indigo-600 hover:underline">Buka SO</Link><span>PO Customer: {group.customerPo || "-"}</span><span>{group.customerName}</span><span>Sales: {group.salesPersonName}</span><Badge variant="secondary">{group.items.length} item</Badge></div></td></tr>{!collapsed && group.items.map((item) => <ItemTableRow key={item.itemId} item={item} selected={selectedItemIds.has(item.itemId)} onSelect={() => toggleItem(item.itemId)} />)}</tbody> })}</table></div>}
        </div>
    )
}
