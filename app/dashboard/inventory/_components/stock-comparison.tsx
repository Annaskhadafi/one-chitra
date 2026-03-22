"use client"

import * as React from "react"
import { useState, useMemo, useRef } from "react"
import {
    Search, Loader2, RefreshCcw, Download,
    Box, AlertTriangle, TrendingUp, CheckCircle2, BarChart3, ChevronUp, ChevronDown,
    ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend,
} from "recharts"
import {
    ChartContainer,
} from "@/components/ui/chart"
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
import { useQuery } from "@tanstack/react-query"
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    ColumnDef,
    flexRender,
    SortingState,
} from "@tanstack/react-table"
import { useVirtualizer } from "@tanstack/react-virtual"
import type { Warehouse } from "@/lib/types"
import { exportInventoryComparisonToExcel } from "@/app/actions/stock"
import { toast } from "sonner"

// ─── Types ───────────────────────────────────────────────────────────
interface ComparisonRow {
    key?: string
    materialNumber: string
    description: string
    sloc: string
    slocDesc: string
    warehouseType: string
    localStock: number
    sapStock: number
    gap: number
    status: "match" | "over" | "under"
    category: string
    plant: string
}

const chartConfig = {
    gap: { label: "Gap", color: "hsl(var(--chart-1))" },
    localStock: { label: "Stock Lokal", color: "hsl(var(--chart-2))" },
    sapStock: { label: "Stock SAP", color: "hsl(var(--chart-3))" },
}

// ─── Component ───────────────────────────────────────────────────────
interface StockComparisonProps {
    localStocks: unknown[] // Tidak digunakan lagi, data dari API
    warehouses: Warehouse[]
}

export function StockComparison({ warehouses }: StockComparisonProps) {

    const normalizeSloc = (value: string | null | undefined) => {
        const raw = (value || "").trim()
        if (!raw) return ""
        if (/^\d+$/.test(raw)) return String(parseInt(raw, 10))
        return raw.toUpperCase()
    }

    // Mapping warehouse type by sloc untuk filter
    React.useMemo(() => {
        const mapping = new Map<string, string>()
        for (const warehouse of warehouses) {
            const sloc = normalizeSloc(warehouse.sloc)
            if (!sloc) continue
            mapping.set(sloc, warehouse.type || "")
        }
        return mapping
    }, [warehouses])

    // --- Data Fetching dengan API yang lebih efisien ---
    // Gunakan API endpoint baru yang sudah pre-aggregated
    const { data: comparisonResponse, isLoading: isLoadingComparison, error: comparisonError, refetch: refetchComparison } = useQuery({
        queryKey: ["inventory-comparison"],
        queryFn: async () => {
            const response = await fetch(`/api/inventory-comparison`, { cache: "no-store" })
            const result = await response.json()
            if (response.ok && result.status === "OK") {
                return result
            }
            throw new Error(result.message || "Failed to fetch comparison data")
        },
        staleTime: 10 * 60 * 1000, // 10 menit
        gcTime: 15 * 60 * 1000, // 15 menit
        refetchOnWindowFocus: false,
    })

    // Memoize comparisonData untuk menghindari re-render yang tidak perlu
    const memoizedComparisonData = useMemo(() => comparisonResponse?.data || [], [comparisonResponse?.data])
    const apiStats = comparisonResponse?.stats

    const [searchTerm, setSearchTerm] = useState("")
    const [statusFilter, setStatusFilter] = useState<"all" | "match" | "over" | "under">("all")
    const [warehouseTypeFilter, setWarehouseTypeFilter] = useState("all")
    const [sorting, setSorting] = useState<SortingState>([{ id: "gap", desc: true }])
    const [pageSize, setPageSize] = useState(100)
    const [pageIndex, setPageIndex] = useState(0)
    const [isExporting, setIsExporting] = useState(false)

    // Debounce search untuk performa lebih baik
    const [debouncedSearch, setDebouncedSearch] = useState("")

    React.useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm)
        }, 300)
        return () => clearTimeout(timer)
    }, [searchTerm])

    const warehouseTypeOptions = useMemo(() => {
        const types = new Set<string>()
        for (const row of memoizedComparisonData) {
            if (row.warehouseType?.trim()) {
                types.add(row.warehouseType.trim())
            }
        }
        return ["all", ...Array.from(types).sort()]
    }, [memoizedComparisonData])

    const filteredComparisonData = useMemo(() => {
        return memoizedComparisonData.filter((item: ComparisonRow) => {
            const matchesStatus = statusFilter === "all" || item.status === statusFilter
            const matchesWarehouseType = warehouseTypeFilter === "all" || item.warehouseType === warehouseTypeFilter
            return matchesStatus && matchesWarehouseType
        })
    }, [memoizedComparisonData, statusFilter, warehouseTypeFilter])

    const columns = useMemo<ColumnDef<ComparisonRow>[]>(() => [
        {
            accessorKey: "materialNumber",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4 h-8">
                    Material #
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
            cell: ({ row }) => <span className="font-medium text-blue-600 font-mono text-xs">{row.original.materialNumber}</span>,
        },
        {
            accessorKey: "description",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4 h-8">
                    Description
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
            cell: ({ row }) => <span className="text-xs truncate max-w-[200px]" title={row.original.description}>{row.original.description || "—"}</span>,
        },
        {
            accessorKey: "sloc",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4 h-8">
                    SLoc
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
            cell: ({ row }) => <Badge variant="outline" className="text-xs">{row.original.sloc}</Badge>,
        },
        {
            accessorKey: "slocDesc",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4 h-8">
                    SLoc Desc
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
            cell: ({ row }) => <span className="text-xs text-muted-foreground italic truncate max-w-[120px]" title={row.original.slocDesc}>{row.original.slocDesc || "—"}</span>,
        },
        {
            accessorKey: "localStock",
            header: ({ column }) => (
                <div className="text-right">
                    <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-mr-4 h-8">
                        Stock Lokal
                        {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                    </Button>
                </div>
            ),
            cell: ({ row }) => <div className="text-right font-mono text-sm font-semibold">{row.original.localStock.toLocaleString()}</div>,
        },
        {
            accessorKey: "sapStock",
            header: ({ column }) => (
                <div className="text-right">
                    <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-mr-4 h-8">
                        Stock SAP
                        {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                    </Button>
                </div>
            ),
            cell: ({ row }) => <div className="text-right font-mono text-sm">{row.original.sapStock.toLocaleString()}</div>,
        },
        {
            accessorKey: "gap",
            header: ({ column }) => (
                <div className="text-right">
                    <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-mr-4 h-8">
                        Gap
                        {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                    </Button>
                </div>
            ),
            cell: ({ row }) => {
                const gap = row.original.gap
                return (
                    <div className={`text-right font-mono text-sm font-bold ${gap > 0 ? "text-blue-600" : gap < 0 ? "text-red-600" : "text-green-600"}`}>
                        {gap > 0 ? "+" : ""}{gap.toLocaleString()}
                    </div>
                )
            },
            sortingFn: (rowA, rowB) => Math.abs(rowA.original.gap) - Math.abs(rowB.original.gap)
        },
        {
            accessorKey: "status",
            header: ({ column }) => (
                <div className="text-center">
                    <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="h-8">
                        Status
                        {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                    </Button>
                </div>
            ),
            cell: ({ row }) => {
                const status = row.original.status
                return (
                    <div className="text-center">
                        {status === "match" && <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200 text-[10px]">Match</Badge>}
                        {status === "over" && <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200 text-[10px]">Over</Badge>}
                        {status === "under" && <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200 text-[10px]">Under</Badge>}
                    </div>
                )
            }
        },
    ], [])

    const table = useReactTable({
        data: filteredComparisonData,
        columns,
        state: {
            sorting,
            globalFilter: debouncedSearch,
            pagination: {
                pageIndex,
                pageSize,
            },
        },
        pageCount: Math.ceil(filteredComparisonData.length / pageSize),
        onSortingChange: setSorting,
        onGlobalFilterChange: setDebouncedSearch,
        onPaginationChange: (updater) => {
            if (typeof updater === "function") {
                const newState = updater({ pageIndex, pageSize })
                setPageIndex(newState.pageIndex)
                setPageSize(newState.pageSize)
            }
        },
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        manualPagination: false,
        globalFilterFn: (row, _columnId, filterValue): boolean => {
            const term = (filterValue as string).toLowerCase()
            if (!term) return true
            const item = row.original
            return !!(
                item.materialNumber.toLowerCase().includes(term) ||
                item.description.toLowerCase().includes(term) ||
                item.sloc.toLowerCase().includes(term) ||
                item.slocDesc.toLowerCase().includes(term) ||
                item.warehouseType.toLowerCase().includes(term)
            )
        }
    })

    // Virtualization dengan overscan yang lebih kecil untuk performa
    const parentRef = useRef<HTMLDivElement>(null)
    const { rows } = table.getRowModel()

    // Get paginated rows
    const paginatedRows = rows.slice(
        pageIndex * pageSize,
        (pageIndex + 1) * pageSize
    )

    const rowVirtualizer = useVirtualizer({
        count: paginatedRows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 45,
        overscan: 10, // Dikurangi dari 20 ke 10 untuk performa lebih baik
    })

    // ─── Stats dari API atau fallback ke perhitungan lokal ──────────────────────────────────────────────────
    const stats = useMemo(() => {
        if (apiStats) return apiStats

        const matched = memoizedComparisonData.filter((r: ComparisonRow) => r.status === "match").length
        const over = memoizedComparisonData.filter((r: ComparisonRow) => r.status === "over").length
        const under = memoizedComparisonData.filter((r: ComparisonRow) => r.status === "under").length
        const totalAbsGap = memoizedComparisonData.reduce((sum: number, r: ComparisonRow) => sum + Math.abs(r.gap), 0)
        const withGap = memoizedComparisonData.filter((r: ComparisonRow) => r.gap !== 0).length

        return { total: memoizedComparisonData.length, matched, over, under, totalAbsGap, withGap }
    }, [memoizedComparisonData, apiStats])

    // ─── Chart data dengan memoization yang lebih baik ─────────────────────────────────────────────
    const barChartData = useMemo(() => {
        const filtered = memoizedComparisonData.filter((r: ComparisonRow) => r.gap !== 0)
        if (filtered.length === 0) return []

        return filtered
            .sort((a: ComparisonRow, b: ComparisonRow) => Math.abs(b.gap) - Math.abs(a.gap))
            .slice(0, 15)
            .map((r: ComparisonRow) => ({
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
    }, [memoizedComparisonData])

    const pieChartData = useMemo(() => {
        if (stats.total === 0) return []
        return [
            { name: "Match", value: stats.matched, color: "#22c55e" },
            { name: "Over Stock", value: stats.over, color: "#3b82f6" },
            { name: "Under Stock", value: stats.under, color: "#ef4444" },
        ]
    }, [stats])

    // ─── Export Handler ──────────────────────────────────────────────
    const handleExportExcel = async () => {
        setIsExporting(true)
        try {
            const result = await exportInventoryComparisonToExcel()

            if (result.success && result.data) {
                // Convert base64 to blob and download
                const byteCharacters = atob(result.data.buffer)
                const byteNumbers = new Array(byteCharacters.length)
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i)
                }
                const byteArray = new Uint8Array(byteNumbers)
                const blob = new Blob([byteArray], { type: result.data.mimeType })

                // Create download link
                const url = window.URL.createObjectURL(blob)
                const link = document.createElement("a")
                link.href = url
                link.download = result.data.filename
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
                window.URL.revokeObjectURL(url)

                toast.success("Export berhasil!", {
                    description: `File ${result.data.filename} telah diunduh`
                })
            } else {
                toast.error("Export gagal", {
                    description: result.message || "Terjadi kesalahan saat export"
                })
            }
        } catch (error) {
            console.error("Export error:", error)
            toast.error("Export gagal", {
                description: "Terjadi kesalahan saat export ke Excel"
            })
        } finally {
            setIsExporting(false)
        }
    }

    // ─── Loading state ──────────────────────────────────────────────
    if (isLoadingComparison) {
        return (
            <div className="space-y-6 animate-in fade-in duration-500">
                {/* Scorecards Skeleton */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {[1, 2, 3, 4].map((i) => (
                        <Card key={i}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-4 w-4" />
                            </CardHeader>
                            <CardContent>
                                <Skeleton className="h-8 w-16 mb-1" />
                                <Skeleton className="h-3 w-32" />
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Charts Skeleton */}
                <div className="grid gap-6 lg:grid-cols-3">
                    <Card className="lg:col-span-2">
                        <CardHeader className="pb-2">
                            <div className="flex items-center gap-2">
                                <Skeleton className="h-4 w-4" />
                                <Skeleton className="h-4 w-40" />
                            </div>
                            <Skeleton className="h-3 w-60 mt-1" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-[350px] w-full" />
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-40 mt-1" />
                        </CardHeader>
                        <CardContent className="flex justify-center">
                            <Skeleton className="h-[300px] w-[300px] rounded-full" />
                        </CardContent>
                    </Card>
                </div>

                {/* Filters Skeleton */}
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <Skeleton className="h-10 flex-1 max-w-sm" />
                        <Skeleton className="h-10 w-full sm:w-[180px]" />
                        <Skeleton className="h-10 w-full sm:w-[220px]" />
                        <Skeleton className="h-9 w-24" />
                        <Skeleton className="h-9 w-32" />
                    </div>
                </div>

                {/* Table Skeleton */}
                <div className="rounded-md border bg-card overflow-hidden">
                    <div className="h-10 border-b bg-muted/50 flex items-center px-4 gap-4">
                        <Skeleton className="h-4 w-8" />
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 flex-1" />
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-20" />
                    </div>
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="h-12 border-b flex items-center px-4 gap-4 last:border-0">
                            <Skeleton className="h-4 w-8" />
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-4 flex-1" />
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-4 w-20" />
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    if (comparisonError) {
        return (
            <div className="h-[400px] flex flex-col items-center justify-center gap-2 border rounded-lg bg-card/50 px-4 text-center">
                <p className="text-sm font-medium text-red-600">Failed to load inventory comparison</p>
                <p className="text-xs text-muted-foreground">{comparisonError instanceof Error ? comparisonError.message : "Unknown error"}</p>
                <Button variant="outline" size="sm" onClick={() => refetchComparison()}>
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Retry
                </Button>
            </div>
        )
    }

    // ─── Render ─────────────────────────────────────────────────────
    return (
        <div className="space-y-6">
            {/* ── Scorecards & Charts in Accordion ───────────────── */}
            <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="analytics" className="border rounded-xl bg-card shadow-sm px-6">
                    <AccordionTrigger className="hover:no-underline py-4">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-muted-foreground" />
                            <span className="font-semibold text-base">Ringkasan & Grafik Perbandingan</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-6 space-y-6">
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
                    </AccordionContent>
                </AccordionItem>
            </Accordion>

            {/* ── Filters ────────────────────────────────────────── */}
            <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search material, description, sloc…"
                            className="pl-8"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm !== debouncedSearch && (
                            <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                        )}
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
                    <div className="w-full sm:w-[220px]">
                        <Select value={warehouseTypeFilter} onValueChange={setWarehouseTypeFilter}>
                            <SelectTrigger className="h-9">
                                <SelectValue placeholder="Filter Type Warehouse" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Type Warehouse</SelectItem>
                                {warehouseTypeOptions.filter(type => type !== "all").map(type => (
                                    <SelectItem key={type} value={type}>{type}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => refetchComparison()} className="shrink-0">
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        Refresh
                    </Button>
                    <Button
                        variant="default"
                        size="sm"
                        onClick={handleExportExcel}
                        disabled={isExporting || memoizedComparisonData.length === 0}
                        className="shrink-0"
                    >
                        {isExporting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Exporting...
                            </>
                        ) : (
                            <>
                                <Download className="mr-2 h-4 w-4" />
                                Export Excel
                            </>
                        )}
                    </Button>
                </div>

                {/* Pagination Controls */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t pt-4">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Rows per page:</span>
                        <Select
                            value={pageSize.toString()}
                            onValueChange={(value) => {
                                setPageSize(Number(value))
                                setPageIndex(0)
                            }}
                        >
                            <SelectTrigger className="h-8 w-[100px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="100">100</SelectItem>
                                <SelectItem value="200">200</SelectItem>
                                <SelectItem value="500">500</SelectItem>
                                <SelectItem value="1000">1000</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                            Showing {pageIndex * pageSize + 1} to {Math.min((pageIndex + 1) * pageSize, table.getFilteredRowModel().rows.length)} of {table.getFilteredRowModel().rows.length} items
                        </span>
                    </div>

                    <div className="flex items-center gap-1">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPageIndex(0)}
                            disabled={pageIndex === 0}
                        >
                            <ChevronsLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPageIndex(pageIndex - 1)}
                            disabled={pageIndex === 0}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm px-2">
                            Page {pageIndex + 1} of {Math.max(1, Math.ceil(table.getFilteredRowModel().rows.length / pageSize))}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPageIndex(pageIndex + 1)}
                            disabled={pageIndex >= Math.ceil(table.getFilteredRowModel().rows.length / pageSize) - 1}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPageIndex(Math.ceil(table.getFilteredRowModel().rows.length / pageSize) - 1)}
                            disabled={pageIndex >= Math.ceil(table.getFilteredRowModel().rows.length / pageSize) - 1}
                        >
                            <ChevronsRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* ── Comparison Table ───────────────────────────────── */}
            <div className="rounded-md border bg-card">
                <div
                    ref={parentRef}
                    className="h-[600px] overflow-auto relative scrollbar-thin scrollbar-thumb-accent"
                >
                    <Table>
                        <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
                                    <TableHead className="w-[50px] text-center">#</TableHead>
                                    {headerGroup.headers.map((header) => (
                                        <TableHead key={header.id}>
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            {rowVirtualizer.getVirtualItems().length > 0 ? (
                                <>
                                    <TableRow style={{ height: `${rowVirtualizer.getVirtualItems()[0].start}px` }} className="border-none">
                                        <TableCell colSpan={columns.length + 1} className="p-0" />
                                    </TableRow>
                                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                        const row = paginatedRows[virtualRow.index]
                                        return (
                                            <TableRow
                                                key={row.id}
                                                className={
                                                    row.original.status === "under"
                                                        ? "bg-red-50/40 dark:bg-red-950/10"
                                                        : row.original.status === "over"
                                                            ? "bg-blue-50/40 dark:bg-blue-950/10"
                                                            : ""
                                                }
                                            >
                                                <TableCell className="text-center text-muted-foreground text-xs">
                                                    {pageIndex * pageSize + virtualRow.index + 1}
                                                </TableCell>
                                                {row.getVisibleCells().map((cell) => (
                                                    <TableCell key={cell.id}>
                                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        )
                                    })}
                                    <TableRow
                                        style={{
                                            height: `${rowVirtualizer.getTotalSize() -
                                                rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1].end}px`,
                                        }}
                                        className="border-none"
                                    >
                                        <TableCell colSpan={columns.length + 1} className="p-0" />
                                    </TableRow>
                                </>
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={columns.length + 1} className="h-24 text-center">
                                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                                            <Box className="h-8 w-8 mb-2 opacity-20" />
                                            <p>No comparison data found.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    )
}
