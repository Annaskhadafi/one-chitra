"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
    AlertTriangle,
    ArrowUpDown,
    Bell,
    ChevronDown,
    ChevronRight,
    Download,
    ExternalLink,
    FileText,
    Layers,
    ListFilter,
    Package,
    RefreshCw,
    Search,
    SlidersHorizontal,
    X,
} from "lucide-react"
import * as XLSX from "xlsx"
import type { getNoStockMonitoringData } from "@/app/actions/no-stock-monitoring"
import {
    calculateGroupGrandTotals,
    calculatePoAgingDays,
    getMonitoringDashboardMetrics,
    getPoAgingUrgency,
    groupMonitoringByItem,
} from "@/lib/no-stock-monitoring"
import type { ItemGroupSummary } from "@/lib/no-stock-monitoring"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { NoStockMonitoringScorecards } from "./no-stock-monitoring-scorecards"
import { NoStockMonitoringCharts } from "./no-stock-monitoring-charts"
import { AllocationDialog } from "./allocation-dialog"
import { NoStockNotificationSettingsTab } from "./no-stock-notification-settings-tab"
import { PoPreviewDialog } from "@/components/po-preview-dialog"

type MonitoringData = Awaited<ReturnType<typeof getNoStockMonitoringData>>["data"]
type MonitoringItem = MonitoringData[number]

const statusClass: Record<string, string> = {
    "Belum Diisi": "border-slate-300 bg-slate-50 text-slate-700",
    "PR Terhubung": "border-indigo-300 bg-indigo-50 text-indigo-700",
    "PO Terbit": "border-amber-300 bg-amber-50 text-amber-700",
    "GR Parsial": "border-orange-300 bg-orange-50 text-orange-700",
    "GR Selesai": "border-emerald-300 bg-emerald-50 text-emerald-700",
    "Konflik": "border-red-300 bg-red-50 text-red-700",
}

function statusBadge(status: string) {
    return <Badge variant="outline" className={`font-medium ${statusClass[status] ?? ""}`}>{status}</Badge>
}

function formatNumber(value: number) {
    return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 }).format(value)
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]

function formatDate(date: Date | string | null | undefined) {
    if (!date) return "-"
    const d = new Date(date)
    if (isNaN(d.getTime())) return "-"
    const day = String(d.getDate()).padStart(2, "0")
    const month = MONTH_NAMES[d.getMonth()] ?? ""
    const year = d.getFullYear()
    return `${day} ${month} ${year}`
}

function PoAgingBadge({
    agingDays,
    poReceive,
}: {
    agingDays: number
    poReceive?: Date | string | null
}) {
    const urgency = getPoAgingUrgency(agingDays)

    return (
        <div className="space-y-0.5" suppressHydrationWarning>
            <Badge variant="outline" className={`text-xs px-2 py-0.5 whitespace-nowrap ${urgency.badgeClass}`}>
                {urgency.label}
            </Badge>
            {poReceive && (
                <div className="text-[11px] text-slate-400 font-mono" suppressHydrationWarning>
                    {formatDate(poReceive)}
                </div>
            )}
        </div>
    )
}

function FilterSelect({
    label,
    value,
    options,
    onChange,
}: {
    label: string
    value: string
    options: string[]
    onChange: (value: string) => void
}) {
    return (
        <select
            aria-label={`Filter ${label}`}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="h-9 rounded-md border border-slate-200 bg-background px-3 text-xs shadow-xs focus:border-indigo-500 focus:outline-none"
        >
            <option key={`${label}-all`} value="all">Semua {label}</option>
            {options.map((option) => (
                <option key={`${label}-${option}`} value={option}>{option}</option>
            ))}
        </select>
    )
}

// ---------------------- DETAIL SO ROW COMPONENT ----------------------
function DetailSoTableRow({
    item,
    selected,
    onSelect,
    onManageAllocations,
    onPreviewPo,
}: {
    item: MonitoringItem
    selected: boolean
    onSelect: () => void
    onManageAllocations: (item: MonitoringItem) => void
    onPreviewPo: (item: MonitoringItem) => void
}) {
    const totalAllocatedQty = item.allocations.reduce((sum, a) => sum + a.allocatedQty, 0)
    const agingDays = calculatePoAgingDays(item.poReceive, item.salesDate)

    return (
        <tr className="align-top hover:bg-slate-50/70 transition-colors">
            <td className="p-3">
                <input
                    type="checkbox"
                    checked={selected}
                    onChange={onSelect}
                    aria-label={`Pilih item ${item.itemId}`}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
            </td>
            <td className="whitespace-nowrap p-3">
                <Link
                    href={`/dashboard/sales-orders/${item.orderId}/edit`}
                    className="font-mono font-semibold text-indigo-600 hover:underline"
                >
                    {item.invoiceNumber || `SO-${item.orderId}`}
                </Link>
            </td>
            <td className="whitespace-nowrap p-3 font-medium text-slate-800">
                <div className="flex items-center gap-1.5">
                    <span>{item.customerPo || "-"}</span>
                    {item.poDocument && (
                        <button
                            type="button"
                            title="Lihat File PO"
                            onClick={() => onPreviewPo(item)}
                            className="text-slate-400 hover:text-indigo-600 transition-colors"
                        >
                            <FileText className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
            </td>
            <td className="whitespace-nowrap p-3 font-mono text-xs text-slate-700">
                <span suppressHydrationWarning>
                    {formatDate(item.poReceive || item.salesDate)}
                </span>
            </td>
            <td className="whitespace-nowrap p-3">
                <PoAgingBadge agingDays={agingDays} />
            </td>
            <td className="min-w-[150px] p-3 text-slate-800">
                <div className="font-medium truncate max-w-[200px]" title={item.customerName}>
                    {item.customerName}
                </div>
            </td>
            <td className="min-w-[120px] p-3 text-slate-600">
                <div className="truncate max-w-[150px]" title={item.salesPersonName}>
                    {item.salesPersonName}
                </div>
            </td>
            <td className="whitespace-nowrap p-3">
                {statusBadge(item.status)}
                <div className="mt-1 text-[11px] text-muted-foreground">Item #{item.itemId}</div>
            </td>
            <td className="min-w-[220px] p-3">
                <p className="font-mono font-bold text-slate-900">{item.materialNumber}</p>
                <p className="text-xs text-slate-500 line-clamp-2" title={item.materialDescription}>
                    {item.materialDescription}
                </p>
            </td>
            <td className="whitespace-nowrap p-3 text-right font-bold text-slate-900">
                {formatNumber(item.outstandingQty)}
            </td>
            <td className="whitespace-nowrap p-3 text-right font-medium text-slate-600">
                {formatNumber(item.availableStock)}
            </td>

            {/* KOLOM MANDIRI 1: No. PR / PE */}
            <td className="whitespace-nowrap p-3 font-mono text-xs">
                {item.allocations.length === 0 ? (
                    <span className="text-slate-400">-</span>
                ) : (
                    <div className="space-y-1">
                        {item.allocations.map((alloc) => {
                            const prSearch = alloc.eprPrNumber || alloc.effectivePoNumber
                            return (
                                <div key={alloc.id} className="flex items-center gap-1">
                                    <span className="font-semibold text-slate-800">
                                        {alloc.eprPrNumber || "-"}
                                    </span>
                                    {prSearch && (
                                        <Link
                                            href={`/dashboard/epr-integrasi?search=${encodeURIComponent(prSearch)}`}
                                            target="_blank"
                                            className="text-indigo-600 hover:text-indigo-800"
                                            title="Buka di EPR"
                                        >
                                            <ExternalLink className="h-3 w-3" />
                                        </Link>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </td>

            {/* KOLOM MANDIRI 2: No. PO Vendor & Item */}
            <td className="whitespace-nowrap p-3 font-mono text-xs">
                {item.allocations.length === 0 ? (
                    <span className="text-slate-400">-</span>
                ) : (
                    <div className="space-y-1">
                        {item.allocations.map((alloc) => {
                            const poNum = alloc.vendorPoNumber || alloc.eprVendorPoNumber
                            if (!poNum) return <span key={alloc.id} className="text-slate-400">-</span>
                            return (
                                <div key={alloc.id} className="font-semibold text-slate-800">
                                    {poNum}
                                    {alloc.vendorPoItem && (
                                        <span className="ml-1 text-slate-500 font-normal">#{alloc.vendorPoItem}</span>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </td>

            {/* KOLOM MANDIRI 3: Qty Alokasi */}
            <td className="whitespace-nowrap p-3 text-right font-bold text-slate-800">
                {item.allocations.length === 0 ? (
                    <span className="text-slate-400 font-normal">0</span>
                ) : (
                    <div className="space-y-1">
                        {item.allocations.map((alloc) => (
                            <div key={alloc.id} className="text-indigo-600">
                                {formatNumber(alloc.allocatedQty)}
                            </div>
                        ))}
                        {item.allocations.length > 1 && (
                            <div className="border-t border-slate-200 pt-0.5 text-[11px] text-slate-500 font-normal">
                                Total: {formatNumber(totalAllocatedQty)}
                            </div>
                        )}
                    </div>
                )}
            </td>

            {/* KOLOM 4: Status EPR / GR */}
            <td className="whitespace-nowrap p-3 text-xs text-slate-500">
                {item.allocations.length ? (
                    <div className="space-y-1">
                        {item.allocations.map((alloc) => (
                            <div key={alloc.id}>
                                <span className="font-medium text-slate-700">{alloc.eprStatus || "Pending"}</span>
                                <div className="text-[11px] text-slate-400">
                                    GR {formatNumber(alloc.receivedQty)} / {formatNumber(alloc.poQty)}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <span className="text-slate-400">-</span>
                )}
            </td>

            {/* KOLOM 5: Aksi */}
            <td className="whitespace-nowrap p-3 text-right">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-semibold text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                    onClick={() => onManageAllocations(item)}
                >
                    <SlidersHorizontal className="mr-1 h-3.5 w-3.5" />
                    Kelola Alokasi
                </Button>
            </td>
        </tr>
    )
}

// ---------------------- GROUPING BY ITEM ROW COMPONENT ----------------------
function GroupedItemTableRow({
    group,
    onManageAllocations,
}: {
    group: ItemGroupSummary<MonitoringItem>
    onManageAllocations: (item: MonitoringItem) => void
}) {
    const [isExpanded, setIsExpanded] = useState(false)

    return (
        <>
            <tr
                className="hover:bg-indigo-50/40 cursor-pointer transition-colors border-b"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <td className="p-3 text-center w-10">
                    <button
                        type="button"
                        aria-label={isExpanded ? "Tutup rincian" : "Buka rincian"}
                        className="p-1 text-slate-400 hover:text-slate-700"
                    >
                        {isExpanded ? <ChevronDown className="h-4 w-4 text-indigo-600" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                </td>
                <td className="p-3 min-w-[240px]">
                    <p className="font-mono font-bold text-slate-900">{group.materialNumber}</p>
                    <p className="text-xs text-slate-500 line-clamp-1" title={group.materialDescription}>
                        {group.materialDescription}
                    </p>
                </td>
                <td className="p-3 whitespace-nowrap text-center">
                    <Badge variant="secondary" className="font-medium bg-slate-100 text-slate-700">
                        {group.orderCount} SO
                    </Badge>
                </td>
                <td className="p-3 whitespace-nowrap text-center">
                    <PoAgingBadge agingDays={group.maxAgingDays} />
                </td>
                <td className="p-3 whitespace-nowrap text-right font-bold text-slate-900">
                    {formatNumber(group.totalOutstandingQty)}
                </td>
                <td className="p-3 whitespace-nowrap text-right font-medium text-slate-600">
                    {formatNumber(group.availableStock)}
                </td>
                <td className="p-3 whitespace-nowrap text-right font-bold text-indigo-600">
                    {formatNumber(group.totalAllocatedQty)}
                </td>
                <td className="p-3 whitespace-nowrap text-right font-bold">
                    {group.remainingRequirementQty > 0 ? (
                        <span className="text-amber-600">
                            {formatNumber(group.remainingRequirementQty)}
                        </span>
                    ) : (
                        <span className="text-emerald-600">0</span>
                    )}
                </td>
                <td className="p-3 text-xs font-mono">
                    {group.prNumbers.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {group.prNumbers.map((pr) => (
                                <Badge key={pr} variant="outline" className="bg-slate-50 text-[11px]">
                                    {pr}
                                </Badge>
                            ))}
                        </div>
                    ) : (
                        <span className="text-slate-400">-</span>
                    )}
                </td>
                <td className="p-3 text-xs font-mono">
                    {group.vendorPoNumbers.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-[220px]">
                            {group.vendorPoNumbers.map((po) => (
                                <Badge key={po} variant="outline" className="bg-indigo-50/50 text-indigo-700 text-[11px]">
                                    {po}
                                </Badge>
                            ))}
                        </div>
                    ) : (
                        <span className="text-slate-400">-</span>
                    )}
                </td>
                <td className="p-3 whitespace-nowrap">
                    {statusBadge(group.status)}
                </td>
                <td className="p-3 whitespace-nowrap text-right">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-indigo-600"
                        onClick={(e) => {
                            e.stopPropagation()
                            setIsExpanded(!isExpanded)
                        }}
                    >
                        {isExpanded ? "Tutup Rincian" : "Lihat SO"}
                    </Button>
                </td>
            </tr>

            {/* EXPANDED ACCORDION: RINCIAN SALES ORDER */}
            {isExpanded && (
                <tr className="bg-slate-50/80 border-b">
                    <td colSpan={12} className="p-4 pl-12">
                        <div className="rounded-lg border border-slate-200 bg-white shadow-xs overflow-hidden">
                            <div className="bg-slate-100/70 px-4 py-2 text-xs font-semibold text-slate-700 flex justify-between items-center">
                                <span>Rincian Sales Order untuk {group.materialNumber}</span>
                                <span className="text-slate-500 font-normal">{group.items.length} Order Terhubung</span>
                            </div>
                            <table className="w-full text-xs">
                                <thead className="border-b bg-slate-50 text-slate-500">
                                    <tr className="text-left">
                                        <th className="p-2.5">Sales Order</th>
                                        <th className="p-2.5">PO Customer</th>
                                        <th className="p-2.5">PO Date</th>
                                        <th className="p-2.5">PO Aging</th>
                                        <th className="p-2.5">Customer</th>
                                        <th className="p-2.5">Sales Person</th>
                                        <th className="p-2.5 text-right">Kebutuhan SO</th>
                                        <th className="p-2.5 text-right">Teralokasi</th>
                                        <th className="p-2.5">Status</th>
                                        <th className="p-2.5 text-right">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {group.items.map((soItem) => {
                                        const allocated = soItem.allocations.reduce((s, a) => s + a.allocatedQty, 0)
                                        return (
                                            <tr key={soItem.itemId} className="hover:bg-slate-50/50">
                                                <td className="p-2.5 font-mono font-semibold">
                                                    <Link
                                                        href={`/dashboard/sales-orders/${soItem.orderId}/edit`}
                                                        className="text-indigo-600 hover:underline"
                                                    >
                                                        {soItem.invoiceNumber || `SO-${soItem.orderId}`}
                                                    </Link>
                                                </td>
                                                <td className="p-2.5">{soItem.customerPo || "-"}</td>
                                                <td className="p-2.5 whitespace-nowrap font-mono text-slate-700">
                                                    <span suppressHydrationWarning>
                                                        {formatDate(soItem.poReceive || soItem.salesDate)}
                                                    </span>
                                                </td>
                                                <td className="p-2.5 whitespace-nowrap">
                                                    <PoAgingBadge
                                                        agingDays={calculatePoAgingDays(soItem.poReceive, soItem.salesDate)}
                                                    />
                                                </td>
                                                <td className="p-2.5 font-medium">{soItem.customerName}</td>
                                                <td className="p-2.5 text-slate-500">{soItem.salesPersonName}</td>
                                                <td className="p-2.5 text-right font-bold text-slate-800">
                                                    {formatNumber(soItem.outstandingQty)}
                                                </td>
                                                <td className="p-2.5 text-right font-bold text-indigo-600">
                                                    {formatNumber(allocated)}
                                                </td>
                                                <td className="p-2.5">{statusBadge(soItem.status)}</td>
                                                <td className="p-2.5 text-right">
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-7 text-xs text-indigo-600 border-indigo-200"
                                                        onClick={() => onManageAllocations(soItem)}
                                                    >
                                                        <SlidersHorizontal className="mr-1 h-3 w-3" />
                                                        Kelola Alokasi
                                                    </Button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </td>
                </tr>
            )}
        </>
    )
}

// ---------------------- MAIN CLIENT COMPONENT ----------------------
export function NoStockMonitoringClient({
    data,
    warning,
}: {
    data: MonitoringData
    warning: string | null
}) {
    const [tab, setTab] = useState<"active" | "history" | "settings">("active")
    const [groupByItem, setGroupByItem] = useState(false)
    const [agingSortOrder, setAgingSortOrder] = useState<"desc" | "asc" | "none">("desc")
    const [search, setSearch] = useState("")
    const [customerFilter, setCustomerFilter] = useState("all")
    const [salesFilter, setSalesFilter] = useState("all")
    const [materialFilter, setMaterialFilter] = useState("all")
    const [selectedItemIds, setSelectedItemIds] = useState<Set<number>>(new Set())
    const [managingItem, setManagingItem] = useState<MonitoringItem | null>(null)
    const [allocationDialogOpen, setAllocationDialogOpen] = useState(false)
    const [poPreviewItem, setPoPreviewItem] = useState<MonitoringItem | null>(null)
    const [poPreviewOpen, setPoPreviewOpen] = useState(false)

    const toggleAgingSort = () => {
        setAgingSortOrder((prev) => {
            if (prev === "desc") return "asc"
            if (prev === "asc") return "none"
            return "desc"
        })
    }

    const activeRows = data.filter(
        (row) => (row.isNoStock || row.allocations.length > 0) && row.status !== "GR Selesai"
    )
    const historyRows = data.filter(
        (row) => row.allocations.length > 0 && !activeRows.includes(row)
    )
    const visibleRows = tab === "history" ? historyRows : activeRows

    const customers = useMemo(() => Array.from(new Set(data.map((row) => row.customerName))).sort(), [data])
    const salesPeople = useMemo(() => Array.from(new Set(data.map((row) => row.salesPersonName))).sort(), [data])
    const materials = useMemo(() => Array.from(new Set(data.map((row) => row.materialNumber))).sort(), [data])

    const filteredRows = useMemo(() => {
        const query = search.trim().toLowerCase()
        const rows = visibleRows.filter((row) => {
            const searchable = [
                row.invoiceNumber,
                row.customerPo,
                row.customerName,
                row.salesPersonName,
                row.materialNumber,
                row.materialDescription,
                ...row.allocations.flatMap((alloc) => [
                    alloc.eprPrNumber,
                    alloc.vendorPoNumber,
                    alloc.vendorPoItem?.toString(),
                ]),
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()

            return (
                (!query || searchable.includes(query)) &&
                (customerFilter === "all" || row.customerName === customerFilter) &&
                (salesFilter === "all" || row.salesPersonName === salesFilter) &&
                (materialFilter === "all" || row.materialNumber === materialFilter)
            )
        })

        if (agingSortOrder !== "none") {
            rows.sort((a, b) => {
                const agingA = calculatePoAgingDays(a.poReceive, a.salesDate)
                const agingB = calculatePoAgingDays(b.poReceive, b.salesDate)
                return agingSortOrder === "desc" ? agingB - agingA : agingA - agingB
            })
        }

        return rows
    }, [agingSortOrder, customerFilter, materialFilter, salesFilter, search, visibleRows])

    // Grouping calculations
    const groupedItems = useMemo(() => {
        const groups = groupMonitoringByItem(filteredRows)
        if (agingSortOrder !== "none") {
            groups.sort((a, b) => {
                return agingSortOrder === "desc"
                    ? b.maxAgingDays - a.maxAgingDays
                    : a.maxAgingDays - b.maxAgingDays
            })
        }
        return groups
    }, [filteredRows, agingSortOrder])
    const grandTotals = useMemo(() => calculateGroupGrandTotals(groupedItems), [groupedItems])
    const dashboardMetrics = useMemo(() => getMonitoringDashboardMetrics(filteredRows), [filteredRows])

    const conflictCount = data.filter((row) => row.status === "Konflik").length
    const selectedVisibleCount = filteredRows.filter((row) => selectedItemIds.has(row.itemId)).length

    const handleOpenManageAllocations = (item: MonitoringItem) => {
        setManagingItem(item)
        setAllocationDialogOpen(true)
    }

    const exportExcel = () => {
        if (groupByItem) {
            // Ekspor mode Grouping by Item
            const rows: Array<Record<string, string | number>> = groupedItems.map((group) => ({
                "Material Number": group.materialNumber,
                "Deskripsi Barang": group.materialDescription,
                "Jumlah SO": group.orderCount,
                "Max PO Aging (Hari)": group.maxAgingDays,
                "Total Kebutuhan (Outstanding)": group.totalOutstandingQty,
                "Stok Gudang": group.availableStock,
                "Total Alokasi PO": group.totalAllocatedQty,
                "Sisa Kebutuhan (Defisit)": group.remainingRequirementQty,
                "PR EPR Terkait": group.prNumbers.join(", "),
                "PO Vendor Terkait": group.vendorPoNumbers.join(", "),
                "Status Barang": group.status,
            }))

            if (!rows.length) return toast.info("Tidak ada data untuk diekspor")

            // Tambahkan baris Grand Total
            rows.push({
                "Material Number": `GRAND TOTAL (${grandTotals.totalItems} Barang)`,
                "Deskripsi Barang": "-",
                "Jumlah SO": grandTotals.totalOrders,
                "Max PO Aging (Hari)": "-",
                "Total Kebutuhan (Outstanding)": grandTotals.totalOutstandingQty,
                "Stok Gudang": grandTotals.totalAvailableStock,
                "Total Alokasi PO": grandTotals.totalAllocatedQty,
                "Sisa Kebutuhan (Defisit)": grandTotals.totalRemainingRequirementQty,
                "PR EPR Terkait": "-",
                "PO Vendor Terkait": "-",
                "Status Barang": "-",
            })

            const worksheet = XLSX.utils.json_to_sheet(rows)
            const workbook = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(workbook, worksheet, "Ringkasan Per Barang")
            XLSX.writeFile(workbook, `no-stock-summary-by-item-${new Date().toISOString().slice(0, 10)}.xlsx`)
            return
        }

        // Ekspor mode Detail SO (dengan kolom mandiri)
        const rowsToExport = selectedVisibleCount > 0
            ? filteredRows.filter((row) => selectedItemIds.has(row.itemId))
            : filteredRows

        const rows = rowsToExport.flatMap((row) =>
            (row.allocations.length ? row.allocations : [undefined]).map((allocation) => ({
                "Sales Order": row.invoiceNumber || `SO-${row.orderId}`,
                "PO Customer": row.customerPo || "",
                "PO Date": formatDate(row.poReceive || row.salesDate),
                "PO Aging (Hari)": calculatePoAgingDays(row.poReceive, row.salesDate),
                Customer: row.customerName,
                Sales: row.salesPersonName,
                "Material Number": row.materialNumber,
                Description: row.materialDescription,
                "Outstanding SO": row.outstandingQty,
                "Stok": row.availableStock,
                "No. PR / PE": allocation?.eprPrNumber || "",
                "No. PO Vendor": allocation?.vendorPoNumber || allocation?.eprVendorPoNumber || "",
                "PO Item": allocation?.vendorPoItem || "",
                "Qty Alokasi": allocation?.allocatedQty || 0,
                Status: row.status,
                "Status EPR": allocation?.eprStatus || "",
                "GR SAP": allocation?.sapReceivedQty || 0,
                "GR Manual": allocation?.manualReceivedQty || 0,
            }))
        )

        if (!rows.length) return toast.info("Tidak ada data untuk diekspor")
        const worksheet = XLSX.utils.json_to_sheet(rows)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, "Detail No Stock")
        XLSX.writeFile(workbook, `no-stock-detail-${new Date().toISOString().slice(0, 10)}.xlsx`)
    }

    const clearFilters = () => {
        setSearch("")
        setCustomerFilter("all")
        setSalesFilter("all")
        setMaterialFilter("all")
    }

    const toggleItem = (itemId: number) => {
        setSelectedItemIds((current) => {
            const next = new Set(current)
            if (next.has(itemId)) next.delete(itemId)
            else next.add(itemId)
            return next
        })
    }

    const toggleAllVisible = () => {
        setSelectedItemIds((current) => {
            const next = new Set(current)
            const allSelected = filteredRows.length > 0 && filteredRows.every((row) => next.has(row.itemId))
            filteredRows.forEach((row) => (allSelected ? next.delete(row.itemId) : next.add(row.itemId)))
            return next
        })
    }

    return (
        <div className="space-y-5 p-4 sm:p-6 bg-slate-50/50 min-h-screen">
            {/* Header Title & Actions */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                        <span>Dashboard</span>
                        <span>&gt;</span>
                        <span className="font-semibold text-slate-800">No Stock Monitoring</span>
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                        No Stock Monitoring &amp; Procurement Tracking
                    </h1>
                    <p className="text-xs text-slate-500">
                        Monitoring kebutuhan pengadaan stok kosong untuk Sales Order ber-PO Customer.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={exportExcel}
                        className="bg-white shadow-xs text-xs font-semibold"
                    >
                        <Download className="mr-1.5 h-3.5 w-3.5" />
                        Export Excel{selectedVisibleCount > 0 && ` (${selectedVisibleCount})`}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.location.reload()}
                        className="bg-white shadow-xs text-xs"
                    >
                        <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Warnings Alert */}
            {warning && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {warning}
                </div>
            )}
            {conflictCount > 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-xs text-red-800">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {conflictCount} item memiliki konflik nomor PO lokal dan EPR.
                </div>
            )}

            {/* 1. SCORECARDS SECTION (Concept inspired by reference design) */}
            <NoStockMonitoringScorecards metrics={dashboardMetrics} />

            {/* 2. ANALYTICS CHARTS SECTION (3 Columns inspired by reference design) */}
            <NoStockMonitoringCharts metrics={dashboardMetrics} />

            {/* 3. CONTROLS, SWITCH GROUPING & FILTERS */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between border-b border-slate-100 pb-3">
                    {/* Switch: Grouping by Item */}
                    <div className="flex items-center gap-3">
                        <div className="flex items-center space-x-2 bg-slate-100/80 p-1 rounded-lg">
                            <button
                                type="button"
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                                    !groupByItem
                                        ? "bg-white text-indigo-700 shadow-xs"
                                        : "text-slate-600 hover:text-slate-900"
                                }`}
                                onClick={() => setGroupByItem(false)}
                            >
                                <ListFilter className="h-3.5 w-3.5" />
                                Detail per Sales Order
                            </button>
                            <button
                                type="button"
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                                    groupByItem
                                        ? "bg-indigo-600 text-white shadow-xs"
                                        : "text-slate-600 hover:text-slate-900"
                                }`}
                                onClick={() => setGroupByItem(true)}
                            >
                                <Layers className="h-3.5 w-3.5" />
                                Grouping by Item (Kebutuhan Barang)
                            </button>
                        </div>
                    </div>

                    {/* Tab Aktif / Histori / Setting Notifikasi */}
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                                tab === "active"
                                    ? "bg-slate-900 text-white"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                            onClick={() => setTab("active")}
                        >
                            Aktif ({activeRows.length})
                        </button>
                        <button
                            type="button"
                            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                                tab === "history"
                                    ? "bg-slate-900 text-white"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                            onClick={() => setTab("history")}
                        >
                            Histori ({historyRows.length})
                        </button>
                        <button
                            type="button"
                            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                                tab === "settings"
                                    ? "bg-indigo-600 text-white shadow-xs"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                            onClick={() => setTab("settings")}
                        >
                            <Bell className="h-3.5 w-3.5" />
                            Setting Notifikasi
                        </button>
                    </div>
                </div>

                {/* Search and Filters (hanya tampil jika bukan tab settings) */}
                {tab !== "settings" && (
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative min-w-[240px] flex-1">
                            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                className="h-9 pl-9 text-xs"
                                placeholder="Cari SO, customer, sales, barang, PO..."
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                            />
                        </div>
                        <FilterSelect label="Customer" value={customerFilter} options={customers} onChange={setCustomerFilter} />
                        <FilterSelect label="Sales" value={salesFilter} options={salesPeople} onChange={setSalesFilter} />
                        <FilterSelect label="Barang" value={materialFilter} options={materials} onChange={setMaterialFilter} />
                        {(search || customerFilter !== "all" || salesFilter !== "all" || materialFilter !== "all") && (
                            <Button type="button" variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-xs">
                                <X className="mr-1 h-3.5 w-3.5" />
                                Reset
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {/* 4. CONTENT SECTION (Settings Tab OR Table Section) */}
            {tab === "settings" ? (
                <NoStockNotificationSettingsTab />
            ) : filteredRows.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white py-14 text-center text-xs text-muted-foreground shadow-sm">
                    Tidak ada data yang sesuai dengan pencarian atau filter.
                </div>
            ) : groupByItem ? (
                /* =================== TABEL MODE GROUPING BY ITEM =================== */
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-3 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-indigo-600" />
                            <h2 className="text-sm font-bold text-slate-900">
                                Ringkasan Kebutuhan per Barang ({groupedItems.length} SKU)
                            </h2>
                        </div>
                        <span className="text-xs text-slate-500">
                            Klik baris untuk melihat rincian Sales Order yang membutuhkan barang ini.
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1200px] text-xs">
                            <thead className="bg-slate-100/80 text-slate-700">
                                <tr className="border-b text-left font-semibold">
                                    <th className="p-3 w-10 text-center"></th>
                                    <th className="p-3">Barang (Material &amp; Deskripsi)</th>
                                    <th className="p-3 text-center">Jumlah SO</th>
                                    <th className="p-3 text-center">
                                        <button
                                            type="button"
                                            onClick={toggleAgingSort}
                                            className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-indigo-600 transition-colors"
                                            title="Klik untuk mengurutkan berdasarkan Max PO Aging"
                                        >
                                            <span>Max Aging</span>
                                            <ArrowUpDown className={`h-3 w-3 ${agingSortOrder !== "none" ? "text-indigo-600" : "text-slate-400"}`} />
                                            {agingSortOrder === "desc" && <span className="text-[10px] text-indigo-600">(Tertua)</span>}
                                            {agingSortOrder === "asc" && <span className="text-[10px] text-indigo-600">(Terbaru)</span>}
                                        </button>
                                    </th>
                                    <th className="p-3 text-right">Total Kebutuhan</th>
                                    <th className="p-3 text-right">Stok Gudang</th>
                                    <th className="p-3 text-right">Total Alokasi PO</th>
                                    <th className="p-3 text-right">Sisa Kebutuhan</th>
                                    <th className="p-3">No. PR / PE Terkait</th>
                                    <th className="p-3">No. PO Vendor Terkait</th>
                                    <th className="p-3">Status Agregat</th>
                                    <th className="p-3 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {groupedItems.map((group) => (
                                    <GroupedItemTableRow
                                        key={group.materialNumber}
                                        group={group}
                                        onManageAllocations={handleOpenManageAllocations}
                                    />
                                ))}
                            </tbody>

                            {/* BARIS GRAND TOTAL */}
                            <tfoot className="bg-slate-900 text-white font-bold">
                                <tr>
                                    <td className="p-3.5 text-center">Σ</td>
                                    <td className="p-3.5 uppercase tracking-wide">
                                        GRAND TOTAL ({grandTotals.totalItems} Barang)
                                    </td>
                                    <td className="p-3.5 text-center">
                                        <Badge className="bg-slate-800 text-white font-semibold">
                                            {grandTotals.totalOrders} Order
                                        </Badge>
                                    </td>
                                    <td className="p-3.5 text-center text-xs text-slate-400 font-mono">
                                        -
                                    </td>
                                    <td className="p-3.5 text-right font-extrabold text-white text-sm">
                                        {formatNumber(grandTotals.totalOutstandingQty)}
                                    </td>
                                    <td className="p-3.5 text-right text-slate-300">
                                        {formatNumber(grandTotals.totalAvailableStock)}
                                    </td>
                                    <td className="p-3.5 text-right text-cyan-300 font-extrabold text-sm">
                                        {formatNumber(grandTotals.totalAllocatedQty)}
                                    </td>
                                    <td className="p-3.5 text-right font-extrabold text-amber-300 text-sm">
                                        {formatNumber(grandTotals.totalRemainingRequirementQty)}
                                    </td>
                                    <td colSpan={4} className="p-3.5 text-right text-xs text-slate-400 font-normal">
                                        Akumulasi seluruh barang &amp; alokasi procurement aktif
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            ) : (
                /* =================== TABEL MODE DETAIL SALES ORDER =================== */
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-3 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <ListFilter className="h-4 w-4 text-indigo-600" />
                            <h2 className="text-sm font-bold text-slate-900">
                                Daftar Detail Item Sales Order ({filteredRows.length} Item)
                            </h2>
                        </div>
                        <span className="text-xs text-slate-500">
                            Kolom No. PR/PE, No. PO Vendor, dan Qty mandiri memudahkan monitoring procurement.
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1600px] text-xs">
                            <thead className="bg-slate-100/80 text-slate-700">
                                <tr className="border-b text-left font-semibold">
                                    <th className="p-3 w-10">
                                        <input
                                            type="checkbox"
                                            checked={
                                                filteredRows.length > 0 &&
                                                filteredRows.every((row) => selectedItemIds.has(row.itemId))
                                            }
                                            onChange={toggleAllVisible}
                                            aria-label="Pilih semua item yang tampil"
                                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                    </th>
                                    <th className="p-3">Sales Order</th>
                                    <th className="p-3">PO Customer</th>
                                    <th className="p-3">PO Date</th>
                                    <th className="p-3">
                                        <button
                                            type="button"
                                            onClick={toggleAgingSort}
                                            className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-indigo-600 transition-colors"
                                            title="Klik untuk mengurutkan prioritas berdasarkan PO Aging"
                                        >
                                            <span>PO Aging</span>
                                            <ArrowUpDown className={`h-3 w-3 ${agingSortOrder !== "none" ? "text-indigo-600" : "text-slate-400"}`} />
                                            {agingSortOrder === "desc" && <span className="text-[10px] text-indigo-600 font-bold">(Tertua)</span>}
                                            {agingSortOrder === "asc" && <span className="text-[10px] text-indigo-600 font-bold">(Terbaru)</span>}
                                        </button>
                                    </th>
                                    <th className="p-3">Customer</th>
                                    <th className="p-3">Sales</th>
                                    <th className="p-3">Status</th>
                                    <th className="p-3">Barang</th>
                                    <th className="p-3 text-right">Outstanding SO</th>
                                    <th className="p-3 text-right">Stok Gudang</th>
                                    {/* Kolom Mandiri */}
                                    <th className="p-3">No. PR / PE</th>
                                    <th className="p-3">No. PO Vendor</th>
                                    <th className="p-3 text-right">Qty Alokasi</th>
                                    <th className="p-3">EPR / GR</th>
                                    <th className="p-3 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredRows.map((item) => (
                                    <DetailSoTableRow
                                        key={item.itemId}
                                        item={item}
                                        selected={selectedItemIds.has(item.itemId)}
                                        onSelect={() => toggleItem(item.itemId)}
                                        onManageAllocations={handleOpenManageAllocations}
                                        onPreviewPo={(item) => { setPoPreviewItem(item); setPoPreviewOpen(true) }}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* DIALOG MODAL KELOLA ALOKASI */}
            <AllocationDialog
                item={managingItem}
                open={allocationDialogOpen}
                onOpenChange={(open) => {
                    setAllocationDialogOpen(open)
                    if (!open) setManagingItem(null)
                }}
            />

            {/* DIALOG PREVIEW FILE PO */}
            <PoPreviewDialog
                open={poPreviewOpen}
                onOpenChange={(open) => {
                    setPoPreviewOpen(open)
                    if (!open) setPoPreviewItem(null)
                }}
                poDocument={poPreviewItem?.poDocument ?? null}
                title={`File PO: ${poPreviewItem?.customerPo || poPreviewItem?.invoiceNumber || "Customer PO"}`}
                editUrl={poPreviewItem ? `/dashboard/sales-orders/${poPreviewItem.orderId}/edit` : undefined}
            />
        </div>
    )
}
