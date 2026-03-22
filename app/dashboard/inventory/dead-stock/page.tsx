"use client"

import { useState, useEffect, useMemo } from "react"
import { getDeadStockReport, type DeadStockReport } from "@/app/actions/dead-stock"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Download, RefreshCw, Search, ArrowUpDown, ArrowUp, ArrowDown, DollarSign, Package, Clock, AlertTriangle, Layers } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { formatCurrency as formatCurrencyShort } from "@/lib/formatters"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import * as XLSX from "xlsx"
import { ReportPieChart, ReportBarChart } from "@/components/reports/report-charts"

type SortField = "productName" | "quantity" | "value" | "daysInactive"
type SortDirection = "asc" | "desc"

function getSeverity(days: number): { label: string; variant: "default" | "secondary" | "outline" | "destructive" } {
    if (days > 365) return { label: "Critical", variant: "destructive" }
    if (days > 180) return { label: "High", variant: "destructive" }
    if (days > 90) return { label: "Medium", variant: "secondary" }
    return { label: "Low", variant: "outline" }
}

// Aging band colors
const AGING_COLORS = [
    "hsl(47, 93%, 58%)",   // 30-60 days: yellow
    "hsl(30, 85%, 55%)",   // 60-90 days: orange
    "hsl(20, 85%, 50%)",   // 90-180 days: deep orange
    "hsl(340, 82%, 52%)",  // 180-365 days: red-pink
    "hsl(0, 72%, 51%)",    // 365+ days: red
]

// KPI card skeleton
function KPISkeleton() {
    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
                <Card key={i} className="overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-8 w-8 rounded-lg" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-7 w-24 mb-1" />
                        <Skeleton className="h-3 w-36" />
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}

export default function DeadStockPage() {
    const [loading, setLoading] = useState(true)
    const [report, setReport] = useState<DeadStockReport | null>(null)
    const [threshold, setThreshold] = useState("90")

    // Filter states
    const [search, setSearch] = useState("")
    const [categoryFilter, setCategoryFilter] = useState("all")
    const [warehouseFilter, setWarehouseFilter] = useState("all")

    // Sort states
    const [sortField, setSortField] = useState<SortField>("value")
    const [sortDirection, setSortDirection] = useState<SortDirection>("desc")

    async function loadData() {
        setLoading(true)
        const days = parseInt(threshold) || 90
        const result = await getDeadStockReport(days)
        if (result.success && result.data) {
            setReport(result.data)
        } else {
            toast.error("Failed to load dead stock data")
        }
        setLoading(false)
    }

    useEffect(() => {
        // Reset filters when threshold changes
        setSearch("")
        setCategoryFilter("all")
        setWarehouseFilter("all")
        loadData()
    }, [threshold])

    const items = report?.items ?? []

    // Unique filter options
    const categories = useMemo(() => {
        const unique = [...new Set(items.map(i => i.category))]
        return unique.sort()
    }, [items])

    const warehouses = useMemo(() => {
        const unique = [...new Set(items.map(i => i.warehouseName))]
        return unique.sort()
    }, [items])

    // Filtered + sorted items
    const filteredItems = useMemo(() => {
        let result = items

        // Search filter
        if (search.trim()) {
            const q = search.toLowerCase()
            result = result.filter(
                item => item.productName.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q)
            )
        }

        // Category filter
        if (categoryFilter !== "all") {
            result = result.filter(item => item.category === categoryFilter)
        }

        // Warehouse filter
        if (warehouseFilter !== "all") {
            result = result.filter(item => item.warehouseName === warehouseFilter)
        }

        // Sort
        result = [...result].sort((a, b) => {
            const aVal = a[sortField]
            const bVal = b[sortField]
            if (typeof aVal === "string" && typeof bVal === "string") {
                return sortDirection === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
            }
            return sortDirection === "asc"
                ? (aVal as number) - (bVal as number)
                : (bVal as number) - (aVal as number)
        })

        return result
    }, [items, search, categoryFilter, warehouseFilter, sortField, sortDirection])

    function handleSort(field: SortField) {
        if (sortField === field) {
            setSortDirection(prev => prev === "asc" ? "desc" : "asc")
        } else {
            setSortField(field)
            setSortDirection("desc")
        }
    }

    function SortIcon({ field }: { field: SortField }) {
        if (sortField !== field) return <ArrowUpDown className="ml-1 h-3 w-3 inline opacity-40" />
        return sortDirection === "asc"
            ? <ArrowUp className="ml-1 h-3 w-3 inline" />
            : <ArrowDown className="ml-1 h-3 w-3 inline" />
    }

    // KPI card data
    const kpiCards = report ? [
        {
            title: "Total Dead Stock Value",
            value: formatCurrencyShort(report.summary.totalValue),
            description: "Total modal yang tertahan",
            icon: DollarSign,
            colorClass: "text-rose-600 dark:text-rose-400",
            bgClass: "from-rose-500/10 via-rose-400/5 to-pink-500/10 border-rose-200/50 dark:from-rose-500/20 dark:via-rose-400/10 dark:to-pink-500/20",
        },
        {
            title: "Affected SKUs",
            value: report.summary.totalItems.toLocaleString(),
            description: `Produk tidak aktif > ${threshold} hari`,
            icon: Package,
            colorClass: "text-amber-600 dark:text-amber-400",
            bgClass: "from-amber-500/10 via-amber-400/5 to-orange-500/10 border-amber-200/50 dark:from-amber-500/20 dark:via-amber-400/10 dark:to-orange-500/20",
        },
        {
            title: "Avg Days Inactive",
            value: `${report.summary.avgDaysInactive} hari`,
            description: "Rata-rata hari tidak ada pergerakan",
            icon: Clock,
            colorClass: "text-amber-600 dark:text-amber-400",
            bgClass: "from-amber-500/10 via-amber-400/5 to-orange-500/10 border-amber-200/50 dark:from-amber-500/20 dark:via-amber-400/10 dark:to-orange-500/20",
        },
        {
            title: "Total Qty Tertahan",
            value: items.reduce((s, i) => s + i.quantity, 0).toLocaleString(),
            description: "Total unit yang tidak bergerak",
            icon: Layers,
            colorClass: "text-amber-600 dark:text-amber-400",
            bgClass: "from-amber-500/10 via-amber-400/5 to-orange-500/10 border-amber-200/50 dark:from-amber-500/20 dark:via-amber-400/10 dark:to-orange-500/20",
        },
        {
            title: "Highest Value Item",
            value: formatCurrencyShort(report.summary.highestValueAmount),
            description: report.summary.highestValueItem?.length > 35
                ? report.summary.highestValueItem.substring(0, 35) + "…"
                : (report.summary.highestValueItem || "-"),
            icon: AlertTriangle,
            colorClass: "text-rose-600 dark:text-rose-400",
            bgClass: "from-rose-500/10 via-rose-400/5 to-pink-500/10 border-rose-200/50 dark:from-rose-500/20 dark:via-rose-400/10 dark:to-pink-500/20",
        },
    ] : []

    // Chart data: category pie
    const categoryChartData = report?.categoryBreakdown.slice(0, 8).map(c => ({
        name: c.name,
        value: c.value,
    })) ?? []

    // Chart data: warehouse bar
    const warehouseChartData = report?.warehouseBreakdown.slice(0, 10).map(w => ({
        name: w.name,
        value: w.value,
    })) ?? []

    // Chart data: aging bands
    const agingChartData = report?.agingBands.map(a => ({
        name: a.band,
        value: a.value,
        secondary: a.count,
    })) ?? []

    const handleExport = () => {
        // Items sheet
        const wsItems = XLSX.utils.json_to_sheet(filteredItems.map(item => ({
            "Product": item.productName,
            "SKU": item.sku,
            "Category": item.category,
            "Brand": item.brand,
            "Warehouse": item.warehouseName,
            "Quantity": item.quantity,
            "Value": item.value,
            "Last Movement": item.lastMovementDate ? new Date(item.lastMovementDate).toLocaleDateString() : "-",
            "Days Inactive": item.daysInactive,
            "Risk Level": getSeverity(item.daysInactive).label,
        })))

        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, wsItems, "Dead Stock Items")

        // Summary sheet
        if (report) {
            const summaryRows = [
                { "Metric": "Total Dead Stock Value", "Value": report.summary.totalValue },
                { "Metric": "Total Affected SKUs", "Value": report.summary.totalItems },
                { "Metric": "Average Days Inactive", "Value": report.summary.avgDaysInactive },
                { "Metric": "Highest Value Item", "Value": report.summary.highestValueItem },
                { "Metric": "Highest Value Amount", "Value": report.summary.highestValueAmount },
                { "Metric": "Threshold (Days)", "Value": parseInt(threshold) },
                { "Metric": "Export Date", "Value": new Date().toLocaleDateString() },
            ]
            const wsSummary = XLSX.utils.json_to_sheet(summaryRows)
            XLSX.utils.book_append_sheet(wb, wsSummary, "Summary")

            // Category breakdown sheet
            const wsCat = XLSX.utils.json_to_sheet(report.categoryBreakdown.map(c => ({
                "Category": c.name,
                "Total Value": c.value,
                "SKU Count": c.count,
            })))
            XLSX.utils.book_append_sheet(wb, wsCat, "By Category")

            // Warehouse breakdown sheet
            const wsWh = XLSX.utils.json_to_sheet(report.warehouseBreakdown.map(w => ({
                "Warehouse": w.name,
                "Total Value": w.value,
                "SKU Count": w.count,
            })))
            XLSX.utils.book_append_sheet(wb, wsWh, "By Warehouse")
        }

        XLSX.writeFile(wb, `dead-stock-report-${threshold}days-${new Date().toISOString().split('T')[0]}.xlsx`)
    }

    return (
        <div className="space-y-6 p-4 sm:p-6">
            {/* Header */}
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Dead Stock Analysis</h1>
                    <p className="text-muted-foreground">Identify slow-moving inventory and stuck capital.</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                    <Select value={threshold} onValueChange={setThreshold}>
                        <SelectTrigger className="w-full sm:w-[180px]">
                            <SelectValue placeholder="Select period" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="30">Inactive &gt; 30 Days</SelectItem>
                            <SelectItem value="60">Inactive &gt; 60 Days</SelectItem>
                            <SelectItem value="90">Inactive &gt; 90 Days</SelectItem>
                            <SelectItem value="180">Inactive &gt; 180 Days</SelectItem>
                            <SelectItem value="365">Inactive &gt; 1 Year</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="outline" size="icon" className="w-full sm:w-9" onClick={loadData} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button variant="outline" className="w-full sm:w-auto" onClick={handleExport} disabled={loading || items.length === 0}>
                        <Download className="mr-2 h-4 w-4" />
                        Export Excel
                    </Button>
                </div>
            </div>

            {/* KPI Cards */}
            {loading ? (
                <KPISkeleton />
            ) : report && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    {kpiCards.map((card) => (
                        <Card key={card.title} className={`relative overflow-hidden bg-gradient-to-br ${card.bgClass} transition-all duration-300 hover:shadow-lg`}>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardDescription className="text-sm font-medium">{card.title}</CardDescription>
                                <div className="rounded-lg p-2 bg-white/80 dark:bg-slate-800/80 shadow-sm">
                                    <card.icon className={`h-4 w-4 ${card.colorClass}`} />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold tabular-nums">{card.value}</div>
                                <p className="text-xs text-muted-foreground mt-1 truncate">{card.description}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Charts Row */}
            {loading ? (
                <div className="grid gap-4 md:grid-cols-2">
                    {[0, 1].map(i => (
                        <Card key={i}>
                            <CardHeader>
                                <Skeleton className="h-5 w-48" />
                                <Skeleton className="h-3 w-64 mt-1" />
                            </CardHeader>
                            <CardContent>
                                <Skeleton className="h-[300px] w-full rounded-lg" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : report && report.items.length > 0 && (
                <div className="grid gap-4 md:grid-cols-2">
                    <ReportPieChart
                        data={categoryChartData}
                        title="Dead Stock Value by Category"
                        description={`Top ${categoryChartData.length} kategori berdasarkan nilai tertahan`}
                        variant="donut"
                        height={300}
                    />
                    <ReportBarChart
                        data={warehouseChartData}
                        title="Dead Stock Value by Warehouse"
                        description={`Top ${warehouseChartData.length} warehouse dengan dead stock tertinggi`}
                        height={300}
                    />
                </div>
            )}

            {/* Aging Band Distribution */}
            {loading ? (
                <Card>
                    <CardHeader>
                        <Skeleton className="h-5 w-48" />
                        <Skeleton className="h-3 w-72 mt-1" />
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <Skeleton key={i} className="h-24 rounded-lg" />
                            ))}
                        </div>
                    </CardContent>
                </Card>
            ) : report && agingChartData.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Aging Band Distribution</CardTitle>
                        <CardDescription>Nilai dan jumlah dead stock berdasarkan periode tidak aktif</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                            {report.agingBands.map((band, idx) => (
                                <div
                                    key={band.band}
                                    className="rounded-lg border p-4 text-center"
                                    style={{ borderLeftColor: AGING_COLORS[idx % AGING_COLORS.length], borderLeftWidth: 4 }}
                                >
                                    <div className="text-xs font-medium text-muted-foreground mb-1">{band.band}</div>
                                    <div className="text-lg font-bold">{formatCurrencyShort(band.value)}</div>
                                    <div className="text-xs text-muted-foreground">{band.count} SKU{band.count !== 1 ? "s" : ""}</div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Data Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Inactive Inventory Items</CardTitle>
                    <CardDescription>
                        {filteredItems.length === items.length
                            ? `${items.length} items with no stock movement for the selected period.`
                            : `Showing ${filteredItems.length} of ${items.length} items.`}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Filters */}
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by product name or SKU..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-8"
                            />
                        </div>
                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <SelectValue placeholder="All Categories" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Categories</SelectItem>
                                {categories.map(c => (
                                    <SelectItem key={c} value={c}>{c}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                            <SelectTrigger className="w-full sm:w-[220px]">
                                <SelectValue placeholder="All Warehouses" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Warehouses</SelectItem>
                                {warehouses.map(w => (
                                    <SelectItem key={w} value={w}>{w}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Table */}
                    <div className="hidden overflow-x-auto rounded-md border md:block">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead
                                        className="cursor-pointer select-none"
                                        onClick={() => handleSort("productName")}
                                    >
                                        Product <SortIcon field="productName" />
                                    </TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Warehouse</TableHead>
                                    <TableHead
                                        className="text-right cursor-pointer select-none"
                                        onClick={() => handleSort("quantity")}
                                    >
                                        Qty <SortIcon field="quantity" />
                                    </TableHead>
                                    <TableHead
                                        className="text-right cursor-pointer select-none"
                                        onClick={() => handleSort("value")}
                                    >
                                        Est. Value <SortIcon field="value" />
                                    </TableHead>
                                    <TableHead>Last Movement</TableHead>
                                    <TableHead
                                        className="text-right cursor-pointer select-none"
                                        onClick={() => handleSort("daysInactive")}
                                    >
                                        Days Inactive <SortIcon field="daysInactive" />
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center">
                                            Loading analysis...
                                        </TableCell>
                                    </TableRow>
                                ) : filteredItems.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                            {items.length === 0
                                                ? "No dead stock found for this period. Great job!"
                                                : "No items match the current filters."}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredItems.map((item) => {
                                        const severity = getSeverity(item.daysInactive)
                                        return (
                                            <TableRow key={`${item.productId}-${item.warehouseName}`}>
                                                <TableCell>
                                                    <div className="font-medium">{item.productName}</div>
                                                    <div className="text-xs text-muted-foreground">{item.sku}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="text-xs">
                                                        {item.category}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-sm">{item.warehouseName}</TableCell>
                                                <TableCell className="text-right tabular-nums">{item.quantity.toLocaleString()}</TableCell>
                                                <TableCell className="text-right tabular-nums">{formatCurrency(item.value)}</TableCell>
                                                <TableCell>
                                                    {item.lastMovementDate ? new Date(item.lastMovementDate).toLocaleDateString() : "Never"}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Badge variant={severity.variant}>
                                                        {item.daysInactive} days · {severity.label}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="space-y-3 md:hidden">
                        {loading ? (
                            <div className="rounded-md border px-4 py-10 text-center text-sm text-muted-foreground">
                                Loading analysis...
                            </div>
                        ) : filteredItems.length === 0 ? (
                            <div className="rounded-md border px-4 py-10 text-center text-sm text-muted-foreground">
                                {items.length === 0
                                    ? "No dead stock found for this period. Great job!"
                                    : "No items match the current filters."}
                            </div>
                        ) : (
                            filteredItems.map((item) => {
                                const severity = getSeverity(item.daysInactive)
                                return (
                                    <div key={`${item.productId}-${item.warehouseName}`} className="rounded-lg border p-4 shadow-sm">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="break-words font-medium">{item.productName}</div>
                                                <div className="break-all text-xs text-muted-foreground">{item.sku}</div>
                                            </div>
                                            <Badge variant={severity.variant} className="shrink-0">
                                                {severity.label}
                                            </Badge>
                                        </div>
                                        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                                            <div>
                                                <div className="text-xs text-muted-foreground">Category</div>
                                                <div>{item.category}</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-muted-foreground">Warehouse</div>
                                                <div>{item.warehouseName}</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-muted-foreground">Qty</div>
                                                <div>{item.quantity.toLocaleString()}</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-muted-foreground">Est. Value</div>
                                                <div>{formatCurrency(item.value)}</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-muted-foreground">Last Movement</div>
                                                <div>{item.lastMovementDate ? new Date(item.lastMovementDate).toLocaleDateString() : "Never"}</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-muted-foreground">Inactive</div>
                                                <div>{item.daysInactive} days</div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
