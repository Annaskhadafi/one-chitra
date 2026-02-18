"use client"

import * as React from "react"
import { useState, useMemo } from "react"
import {
    Search, Loader2, RefreshCcw, ArrowUpDown, ArrowDown, ArrowUp,
    Box, AlertTriangle, TrendingUp, CheckCircle2, BarChart3
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend,
} from "recharts"
import {
    ChartContainer, ChartTooltip, ChartTooltipContent,
} from "@/components/ui/chart"

// ─── Types ───────────────────────────────────────────────────────────
interface SAPStockItem {
    idInv: string
    plant: string
    plantName: string
    material: string
    oldMaterial: string
    description: string
    sloc: string
    slocDesc: string
    qtyStock: number
    valueStock: number
}

interface LocalStockItem {
    id: number
    product: {
        materialNumber: string
        materialDescription: string | null
        plant: string | null
        category: string
        oldMaterialNo: string | null
        costSap: string | null
    } | null
    warehouse: { sloc: string; description: string | null; type: string | null } | null
    totalStock: number
    minStock: number
    valuationValue: string
    productId: number
    warehouseId: number
}

interface ComparisonRow {
    key: string
    materialNumber: string
    description: string
    sloc: string
    slocDesc: string
    localStock: number
    sapStock: number
    gap: number
    status: "match" | "over" | "under"
    category: string
    plant: string
}

type SortField = "gap" | "localStock" | "sapStock" | "materialNumber"
type SortDirection = "asc" | "desc"

// ─── Component ───────────────────────────────────────────────────────
interface StockComparisonProps {
    localStocks: LocalStockItem[]
}

const PIE_COLORS = ["#22c55e", "#3b82f6", "#ef4444"]

const chartConfig = {
    gap: { label: "Gap", color: "hsl(var(--chart-1))" },
    localStock: { label: "Stock Lokal", color: "hsl(var(--chart-2))" },
    sapStock: { label: "Stock SAP", color: "hsl(var(--chart-3))" },
}

export function StockComparison({ localStocks }: StockComparisonProps) {
    const [sapData, setSapData] = useState<SAPStockItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    const [statusFilter, setStatusFilter] = useState<"all" | "match" | "over" | "under">("all")
    const [sortField, setSortField] = useState<SortField>("gap")
    const [sortDirection, setSortDirection] = useState<SortDirection>("desc")

    const fetchSAPData = React.useCallback(async () => {
        setIsLoading(true)
        try {
            const response = await fetch(
                "https://ics.chitraparatama.co.id/product/api/apiconnect.php?function=get_inventory"
            )
            const result = await response.json()
            if (result.status === "OK") {
                const mapped: SAPStockItem[] = result.result.map((item: Record<string, string>) => ({
                    idInv: item.idinv?.toString().trim() ?? "",
                    plant: item.plant?.toString().trim() ?? "",
                    plantName: item.plantname?.toString().trim() ?? "",
                    material: item.material?.toString().trim() ?? "",
                    oldMaterial: item.oldmaterial?.toString().trim() ?? "",
                    description: item.desc?.toString().trim() ?? "",
                    sloc: item.sloc?.toString().trim() ?? "",
                    slocDesc: item.slocdesc?.toString().trim() ?? "",
                    qtyStock: Number(item.qtystock) || 0,
                    valueStock: Number(item.valuestock) || 0,
                }))
                setSapData(mapped)
            }
        } catch {
            toast.error("Failed to fetch SAP data")
        } finally {
            setIsLoading(false)
        }
    }, [])

    React.useEffect(() => {
        fetchSAPData()
    }, [fetchSAPData])

    // ─── Build comparison data ─────────────────────────────────────
    const comparisonData = useMemo<ComparisonRow[]>(() => {
        // Build a map: key = materialNumber|sloc
        const localMap = new Map<string, LocalStockItem>()
        for (const item of localStocks) {
            if (!item.product || !item.warehouse) continue
            const key = `${item.product.materialNumber}|${item.warehouse.sloc}`
            localMap.set(key, item)
        }

        const sapMap = new Map<string, SAPStockItem>()
        for (const item of sapData) {
            // SAP uses idInv as the primary material number for mapping
            const key = `${item.idInv}|${item.sloc}`
            sapMap.set(key, item)
        }

        const allKeys = new Set([...localMap.keys(), ...sapMap.keys()])
        const rows: ComparisonRow[] = []

        for (const key of allKeys) {
            const local = localMap.get(key)
            const sap = sapMap.get(key)

            const localStock = local?.totalStock ?? 0
            const sapStock = sap?.qtyStock ?? 0
            const gap = localStock - sapStock

            const materialNumber = local?.product?.materialNumber ?? sap?.idInv ?? ""
            const description = local?.product?.materialDescription ?? sap?.description ?? ""
            const sloc = local?.warehouse?.sloc ?? sap?.sloc ?? ""
            const slocDesc = local?.warehouse?.description ?? sap?.slocDesc ?? ""
            const category = local?.product?.category ?? ""
            const plant = local?.product?.plant ?? sap?.plant ?? ""

            let status: "match" | "over" | "under" = "match"
            if (gap > 0) status = "over"
            else if (gap < 0) status = "under"

            rows.push({
                key,
                materialNumber,
                description,
                sloc,
                slocDesc,
                localStock,
                sapStock,
                gap,
                status,
                category,
                plant,
            })
        }

        return rows
    }, [localStocks, sapData])

    // ─── Filtered & sorted data ────────────────────────────────────
    const filteredData = useMemo(() => {
        let result = comparisonData

        if (statusFilter !== "all") {
            result = result.filter(r => r.status === statusFilter)
        }

        if (searchTerm) {
            const term = searchTerm.toLowerCase()
            result = result.filter(r =>
                r.materialNumber.toLowerCase().includes(term) ||
                r.description.toLowerCase().includes(term) ||
                r.sloc.toLowerCase().includes(term) ||
                r.slocDesc.toLowerCase().includes(term)
            )
        }

        result.sort((a, b) => {
            let cmp = 0
            if (sortField === "gap") cmp = Math.abs(b.gap) - Math.abs(a.gap)
            else if (sortField === "localStock") cmp = a.localStock - b.localStock
            else if (sortField === "sapStock") cmp = a.sapStock - b.sapStock
            else cmp = a.materialNumber.localeCompare(b.materialNumber)

            return sortDirection === "desc" ? -cmp : cmp
        })

        return result
    }, [comparisonData, statusFilter, searchTerm, sortField, sortDirection])

    // ─── Stats ──────────────────────────────────────────────────────
    const stats = useMemo(() => {
        const matched = comparisonData.filter(r => r.status === "match").length
        const over = comparisonData.filter(r => r.status === "over").length
        const under = comparisonData.filter(r => r.status === "under").length
        const totalAbsGap = comparisonData.reduce((sum, r) => sum + Math.abs(r.gap), 0)
        const withGap = comparisonData.filter(r => r.gap !== 0).length

        return { total: comparisonData.length, matched, over, under, totalAbsGap, withGap }
    }, [comparisonData])

    // ─── Chart data ─────────────────────────────────────────────────
    const barChartData = useMemo(() => {
        return [...comparisonData]
            .filter(r => r.gap !== 0)
            .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
            .slice(0, 15)
            .map(r => ({
                name: r.materialNumber.length > 12
                    ? r.materialNumber.slice(0, 12) + "…"
                    : r.materialNumber,
                fullName: r.materialNumber,
                description: r.description,
                gap: r.gap,
                localStock: r.localStock,
                sapStock: r.sapStock,
                fill: r.gap > 0 ? "#3b82f6" : "#ef4444",
            }))
    }, [comparisonData])

    const pieChartData = useMemo(() => [
        { name: "Match", value: stats.matched, color: "#22c55e" },
        { name: "Over Stock", value: stats.over, color: "#3b82f6" },
        { name: "Under Stock", value: stats.under, color: "#ef4444" },
    ], [stats])

    // ─── Sort handler ───────────────────────────────────────────────
    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(d => d === "asc" ? "desc" : "asc")
        } else {
            setSortField(field)
            setSortDirection("desc")
        }
    }

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <ArrowUpDown className="ml-1 h-3 w-3 inline opacity-40" />
        return sortDirection === "asc"
            ? <ArrowUp className="ml-1 h-3 w-3 inline text-primary" />
            : <ArrowDown className="ml-1 h-3 w-3 inline text-primary" />
    }

    // ─── Loading state ──────────────────────────────────────────────
    if (isLoading) {
        return (
            <div className="h-[400px] flex flex-col items-center justify-center gap-4 border rounded-lg bg-card/50">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Fetching SAP data for comparison…</p>
            </div>
        )
    }

    // ─── Render ─────────────────────────────────────────────────────
    return (
        <div className="space-y-6">
            {/* ── Scorecards ─────────────────────────────────────── */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Compared</CardTitle>
                        <Box className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.total}</div>
                        <p className="text-xs text-muted-foreground">Unique material + sloc combinations</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Matched</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{stats.matched}</div>
                        <p className="text-xs text-muted-foreground">Items with zero gap</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Items with Gap</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-600">{stats.withGap}</div>
                        <p className="text-xs text-muted-foreground">
                            {stats.over} over · {stats.under} under
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Abs. Gap</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalAbsGap.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">Sum of absolute differences</p>
                    </CardContent>
                </Card>
            </div>

            {/* ── Charts ─────────────────────────────────────────── */}
            <div className="grid gap-6 lg:grid-cols-3">
                {/* Bar Chart */}
                <Card className="lg:col-span-2">
                    <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-muted-foreground" />
                            <CardTitle className="text-sm font-medium">Top 15 Gap Analysis</CardTitle>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-500 mr-1" /> Over Stock (Local &gt; SAP)
                            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-500 ml-3 mr-1" /> Under Stock (SAP &gt; Local)
                        </p>
                    </CardHeader>
                    <CardContent>
                        {barChartData.length === 0 ? (
                            <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                                All stocks are matched — no gaps detected!
                            </div>
                        ) : (
                            <ChartContainer config={chartConfig} className="h-[350px] w-full">
                                <BarChart
                                    data={barChartData}
                                    layout="vertical"
                                    margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" fontSize={11} />
                                    <YAxis
                                        dataKey="name"
                                        type="category"
                                        width={100}
                                        fontSize={10}
                                        tickLine={false}
                                    />
                                    <Tooltip
                                        content={({ active, payload }) => {
                                            if (!active || !payload?.length) return null
                                            const d = payload[0].payload
                                            return (
                                                <div className="rounded-lg border bg-background p-3 shadow-md text-xs space-y-1">
                                                    <p className="font-semibold">{d.fullName}</p>
                                                    <p className="text-muted-foreground truncate max-w-[200px]">{d.description}</p>
                                                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 pt-1 border-t">
                                                        <span className="text-muted-foreground">Stock Lokal:</span>
                                                        <span className="font-mono text-right">{d.localStock.toLocaleString()}</span>
                                                        <span className="text-muted-foreground">Stock SAP:</span>
                                                        <span className="font-mono text-right">{d.sapStock.toLocaleString()}</span>
                                                        <span className="text-muted-foreground font-medium">Gap:</span>
                                                        <span className={`font-mono text-right font-bold ${d.gap > 0 ? "text-blue-600" : "text-red-600"}`}>
                                                            {d.gap > 0 ? "+" : ""}{d.gap.toLocaleString()}
                                                        </span>
                                                    </div>
                                                </div>
                                            )
                                        }}
                                    />
                                    <Bar dataKey="gap" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ChartContainer>
                        )}
                    </CardContent>
                </Card>

                {/* Pie Chart */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Gap Distribution</CardTitle>
                        <p className="text-xs text-muted-foreground">Match vs Over vs Under</p>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieChartData}
                                        cx="50%"
                                        cy="45%"
                                        innerRadius={60}
                                        outerRadius={90}
                                        paddingAngle={3}
                                        dataKey="value"
                                        label={({ name, percent }) =>
                                            `${name} ${(percent * 100).toFixed(0)}%`
                                        }
                                        labelLine={false}
                                        fontSize={11}
                                    >
                                        {pieChartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value: number, name: string) => [
                                            `${value.toLocaleString()} items`,
                                            name,
                                        ]}
                                    />
                                    <Legend
                                        verticalAlign="bottom"
                                        iconType="circle"
                                        iconSize={8}
                                        wrapperStyle={{ fontSize: "11px" }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ── Filters ────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search material, description, sloc…"
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="w-full sm:w-[180px]">
                    <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                        <SelectTrigger className="h-9">
                            <SelectValue placeholder="Filter Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="match">✅ Match</SelectItem>
                            <SelectItem value="over">🔵 Over Stock</SelectItem>
                            <SelectItem value="under">🔴 Under Stock</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <Button variant="outline" size="sm" onClick={fetchSAPData} className="shrink-0">
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Refresh SAP
                </Button>
                <div className="text-xs text-muted-foreground ml-auto">
                    Showing {filteredData.length} of {comparisonData.length} items
                </div>
            </div>

            {/* ── Comparison Table ───────────────────────────────── */}
            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50px] text-center">#</TableHead>
                            <TableHead
                                className="cursor-pointer select-none"
                                onClick={() => handleSort("materialNumber")}
                            >
                                Material # <SortIcon field="materialNumber" />
                            </TableHead>
                            <TableHead className="min-w-[180px]">Description</TableHead>
                            <TableHead>SLoc</TableHead>
                            <TableHead>SLoc Desc</TableHead>
                            <TableHead
                                className="text-right cursor-pointer select-none"
                                onClick={() => handleSort("localStock")}
                            >
                                Stock Lokal <SortIcon field="localStock" />
                            </TableHead>
                            <TableHead
                                className="text-right cursor-pointer select-none"
                                onClick={() => handleSort("sapStock")}
                            >
                                Stock SAP <SortIcon field="sapStock" />
                            </TableHead>
                            <TableHead
                                className="text-right cursor-pointer select-none"
                                onClick={() => handleSort("gap")}
                            >
                                Gap <SortIcon field="gap" />
                            </TableHead>
                            <TableHead className="text-center">Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={9} className="h-24 text-center">
                                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                                        <Box className="h-8 w-8 mb-2 opacity-20" />
                                        <p>No comparison data found.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredData.map((row, idx) => (
                                <TableRow
                                    key={row.key}
                                    className={
                                        row.status === "under"
                                            ? "bg-red-50/40 dark:bg-red-950/10"
                                            : row.status === "over"
                                                ? "bg-blue-50/40 dark:bg-blue-950/10"
                                                : ""
                                    }
                                >
                                    <TableCell className="text-center text-muted-foreground text-xs">
                                        {idx + 1}
                                    </TableCell>
                                    <TableCell className="font-medium text-blue-600 font-mono text-xs">
                                        {row.materialNumber}
                                    </TableCell>
                                    <TableCell className="text-xs max-w-[200px] truncate" title={row.description}>
                                        {row.description || "—"}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="text-xs">{row.sloc}</Badge>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground italic max-w-[120px] truncate" title={row.slocDesc}>
                                        {row.slocDesc || "—"}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-sm font-semibold">
                                        {row.localStock.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-sm">
                                        {row.sapStock.toLocaleString()}
                                    </TableCell>
                                    <TableCell className={`text-right font-mono text-sm font-bold ${row.gap > 0 ? "text-blue-600" : row.gap < 0 ? "text-red-600" : "text-green-600"
                                        }`}>
                                        {row.gap > 0 ? "+" : ""}{row.gap.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {row.status === "match" && (
                                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200 text-[10px]">
                                                Match
                                            </Badge>
                                        )}
                                        {row.status === "over" && (
                                            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200 text-[10px]">
                                                Over
                                            </Badge>
                                        )}
                                        {row.status === "under" && (
                                            <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200 text-[10px]">
                                                Under
                                            </Badge>
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
