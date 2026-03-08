"use client"

import { useMemo, useRef, useState } from "react"
import { Search, RefreshCcw, ChevronUp, ChevronDown, Box, AlertTriangle, TrendingUp, FilterX, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { ScoreCard } from "@/components/score-card"
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useQuery } from "@tanstack/react-query"
import { useVirtualizer } from "@tanstack/react-virtual"
import type { Warehouse } from "@/lib/types"
import { format, isAfter, startOfDay, subDays } from "date-fns"
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    ColumnDef,
    flexRender,
    SortingState,
} from "@tanstack/react-table"

type StockSAPNewItem = {
    stockId: number
    plantCode: string
    plantName: string
    materialNo: string
    oldMaterialNo: string
    materialDesc: string
    storLoc: string
    storLocDesc: string
    totalStock: number
    baseUnitOfMeasure: string
    valueStock: number
    currency: string
    extractedAt: string | null
    updatedAt: string | null
}

type StockSAPNewResponse = {
    status: "OK" | "ERROR"
    result?: StockSAPNewItem[]
    plants?: string[]
    stats?: {
        totalCount: number
        outOfStockCount: number
        totalValue: number
    }
    pagination?: {
        page: number
        pageSize: number
        totalCount: number
        totalPages: number
    }
    message?: string
}

interface StockSAPNewTableProps {
    defaultRate: string
    warehouses: Warehouse[]
}

export function StockSAPNewTable({ defaultRate, warehouses }: StockSAPNewTableProps) {
    const [searchTerm, setSearchTerm] = useState("")
    const [sorting, setSorting] = useState<SortingState>([{ id: "totalStock", desc: true }])
    const [activeTab, setActiveTab] = useState("all")
    const [filterPlant, setFilterPlant] = useState("all")
    const [filterStorLocDesc, setFilterStorLocDesc] = useState("")
    const [pageIndex, setPageIndex] = useState(0)
    const [pageSize, setPageSize] = useState(100)

    const parsedRate = useMemo(() => {
        const rate = parseFloat(defaultRate)
        return Number.isFinite(rate) ? rate : 16000
    }, [defaultRate])

    const CENTRAL_WAREHOUSE_TYPE = "Central Warehouse"

    const formatSloc = (value: string | null | undefined) => {
        const raw = (value || "").trim()
        if (!raw) return ""
        if (/^\d+$/.test(raw)) {
            return String(parseInt(raw, 10))
        }
        return raw.toUpperCase()
    }

    const normalizeSloc = (value: string | null | undefined) => formatSloc(value).toLowerCase()

    const safeNumber = (value: unknown) => {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : 0
    }

    const isCentralWarehouseSloc = (value: string | null | undefined) => {
        const normalized = normalizeSloc(value)
        return normalized === "101" || normalized === "1"
    }

    const warehouseTypeBySloc = useMemo(() => {
        const mapping = new Map<string, string>()
        for (const warehouse of warehouses) {
            if (warehouse.sloc) {
                mapping.set(normalizeSloc(warehouse.sloc), warehouse.type || "")
            }
        }
        return mapping
    }, [warehouses])

    const getDerivedWarehouseType = (item: StockSAPNewItem) => {
        if (item.plantCode === "2002") return "REPAIR"
        if (isCentralWarehouseSloc(item.storLoc)) return CENTRAL_WAREHOUSE_TYPE
        return warehouseTypeBySloc.get(normalizeSloc(item.storLoc)) || ""
    }

    const { data: responseData, isLoading, error, refetch } = useQuery({
        queryKey: ["zmc9-stock-sap", pageIndex, pageSize, searchTerm, activeTab, filterPlant, filterStorLocDesc],
        queryFn: async () => {
            const params = new URLSearchParams({
                page: (pageIndex + 1).toString(),
                pageSize: pageSize.toString(),
                search: searchTerm,
                warehouseType: activeTab,
                plant: filterPlant,
                slocDesc: filterStorLocDesc,
                ts: Date.now().toString()
            })
            const response = await fetch(`/api/stocks-sap-new?${params.toString()}`, { cache: "no-store" })
            const result: StockSAPNewResponse = await response.json()

            if (!response.ok || result.status !== "OK") {
                throw new Error(result.message || "Failed to fetch zmc9_stock_sap")
            }

            return result
        },
        staleTime: 5 * 60 * 1000,
    })

    const data = useMemo(() => responseData?.result ?? [], [responseData])
    const pagination = responseData?.pagination
    const apiStats = responseData?.stats

    // Menghitung status last update berdasarkan kapan data benar-benar berubah
    const updateStatus = useMemo(() => {
        if (!data || data.length === 0) return null;

        // Cari updatedAt yang paling baru (terbesar/max)
        let latestDate = new Date(0);
        for (const item of data) {
            // Gunakan updatedAt jika tersedia, fallback ke extractedAt
            const dateStr = item.updatedAt || item.extractedAt;
            if (dateStr) {
                const date = new Date(dateStr);
                if (date > latestDate) latestDate = date;
            }
        }

        if (latestDate.getTime() === 0) return null;

        // Aturan status: 
        // H-1 (kemarin) jam 00:00 adalah batas minimum data 'Up to Date'.
        const yesterdayStart = startOfDay(subDays(new Date(), 1));
        const isUpdated = isAfter(latestDate, yesterdayStart) || latestDate.getTime() === yesterdayStart.getTime();

        return {
            dateStr: format(latestDate, "dd MMM yyyy, HH:mm"),
            isUpdated,
            message: isUpdated ? "Data sudah diperbarui" : "Data belum diperbarui"
        };
    }, [data]);

    const plantOptions = useMemo(() => {
        return ["all", ...(responseData?.plants ?? []).sort()]
    }, [responseData?.plants])

    const warehouseTypeOptions = useMemo(() => {
        const types = new Set<string>()
        for (const warehouse of warehouses) {
            if (warehouse.type?.trim()) {
                types.add(warehouse.type.trim())
            }
        }
        const hasCentralStock = data.some(item => isCentralWarehouseSloc(item.storLoc))
        if (hasCentralStock) {
            types.add(CENTRAL_WAREHOUSE_TYPE)
        }
        return ["all", "repair-2002", ...Array.from(types).sort()]
    }, [warehouses, data])

    // Server-side filtering is handled by the API, so we use 'data' directly
    const preFilteredData = data

    const columns = useMemo<ColumnDef<StockSAPNewItem>[]>(
        () => [
            {
                accessorKey: "stockId",
                header: ({ column }) => (
                    <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4 h-8">
                        Stock ID
                        {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                    </Button>
                ),
                cell: ({ row }) => <span className="font-medium">{row.original.stockId}</span>,
            },
            {
                accessorKey: "plantCode",
                header: "Plant",
                cell: ({ row }) => (
                    <div className="flex flex-col">
                        <span>{row.original.plantCode}</span>
                        <span className="text-[10px] text-muted-foreground">{row.original.plantName}</span>
                    </div>
                ),
            },
            {
                accessorKey: "materialNo",
                header: "Material",
            },
            {
                accessorKey: "oldMaterialNo",
                header: "Old Material",
                cell: ({ row }) => <span className="text-muted-foreground">{row.original.oldMaterialNo}</span>,
            },
            {
                accessorKey: "materialDesc",
                header: "Description",
                cell: ({ row }) => <span className="text-xs truncate max-w-[220px]" title={row.original.materialDesc}>{row.original.materialDesc}</span>,
            },
            {
                accessorKey: "storLoc",
                header: "Storage Loc",
                cell: ({ row }) => <Badge variant="outline">{formatSloc(row.original.storLoc)}</Badge>,
            },
            {
                accessorKey: "storLocDesc",
                header: "Storage Loc Desc",
                cell: ({ row }) => <span className="text-muted-foreground text-xs italic truncate max-w-[140px]" title={row.original.storLocDesc}>{row.original.storLocDesc}</span>,
            },
            {
                id: "warehouseType",
                header: "Type",
                cell: ({ row }) => {
                    const warehouseType = getDerivedWarehouseType(row.original)
                    return <span className="text-xs font-medium">{warehouseType || "-"}</span>
                },
            },
            {
                accessorKey: "totalStock",
                header: ({ column }) => (
                    <div className="text-right">
                        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-mr-4 h-8">
                            Qty
                            {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                        </Button>
                    </div>
                ),
                cell: ({ row }) => <div className="text-right font-mono">{safeNumber(row.original.totalStock).toLocaleString()}</div>,
            },
            {
                accessorKey: "baseUnitOfMeasure",
                header: "UoM",
                cell: ({ row }) => <span className="text-xs">{row.original.baseUnitOfMeasure}</span>,
            },
            {
                accessorKey: "valueStock",
                header: ({ column }) => (
                    <div className="text-right">
                        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-mr-4 h-8">
                            Value
                            {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                        </Button>
                    </div>
                ),
                cell: ({ row }) => <div className="text-right font-mono text-[10px]">{row.original.currency || "USD"} {safeNumber(row.original.valueStock).toLocaleString()}</div>,
            },
            {
                accessorKey: "updatedAt",
                header: "Updated At",
                cell: ({ row }) => (
                    <span className="text-xs text-muted-foreground">
                        {row.original.updatedAt
                            ? new Date(row.original.updatedAt).toLocaleString()
                            : row.original.extractedAt
                                ? new Date(row.original.extractedAt).toLocaleString()
                                : "-"}
                    </span>
                ),
            },
        ],
        []
    )

    const table = useReactTable({
        data: preFilteredData,
        columns,
        state: {
            sorting,
            pagination: {
                pageIndex,
                pageSize,
            },
        },
        onSortingChange: setSorting,
        onPaginationChange: (updater) => {
            const next = typeof updater === "function"
                ? updater({ pageIndex, pageSize })
                : updater
            setPageIndex(next.pageIndex)
            setPageSize(next.pageSize)
        },
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        manualPagination: true,
        pageCount: pagination?.totalPages ?? -1,
    })

    const parentRef = useRef<HTMLDivElement>(null)
    const { rows } = table.getRowModel()
    const filteredRows = table.getFilteredRowModel().rows

    const stats = useMemo(() => {
        return {
            totalItems: apiStats?.totalCount ?? 0,
            outOfStock: apiStats?.outOfStockCount ?? 0,
            totalValuationIdr: (apiStats?.totalValue ?? 0) * parsedRate,
        }
    }, [apiStats, parsedRate])

    const rowVirtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 45,
        overscan: 20,
    })

    const [before, after] =
        rowVirtualizer.getVirtualItems().length > 0
            ? [
                rowVirtualizer.getVirtualItems()[0].start,
                rowVirtualizer.getTotalSize() - rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1].end,
            ]
            : [0, 0]

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                    <Skeleton className="h-28 rounded-xl" />
                    <Skeleton className="h-28 rounded-xl" />
                    <Skeleton className="h-28 rounded-xl" />
                </div>

                <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-end gap-4">
                        <Skeleton className="h-14 w-full sm:w-[220px] rounded-md" />
                        <Skeleton className="h-14 w-full sm:w-[280px] rounded-md" />
                        <Skeleton className="h-9 w-[140px] rounded-md" />
                    </div>
                    <Skeleton className="h-10 w-full max-w-sm rounded-md" />
                </div>

                <div className="rounded-md border bg-card p-4 space-y-3">
                    <div className="grid grid-cols-12 gap-3">
                        {Array.from({ length: 12 }).map((_, idx) => (
                            <Skeleton key={`header-skeleton-${idx}`} className="h-4 col-span-1 rounded" />
                        ))}
                    </div>
                    {Array.from({ length: 12 }).map((_, rowIdx) => (
                        <div key={`row-skeleton-${rowIdx}`} className="grid grid-cols-12 gap-3">
                            {Array.from({ length: 12 }).map((_, colIdx) => (
                                <Skeleton key={`cell-skeleton-${rowIdx}-${colIdx}`} className="h-6 col-span-1 rounded" />
                            ))}
                        </div>
                    ))}
                </div>

                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Fetching Data from zmc9_stock_sap...
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="h-[400px] flex flex-col items-center justify-center gap-2 border rounded-lg bg-card/50 px-4 text-center">
                <p className="text-sm font-medium text-red-600">Failed to load zmc9_stock_sap</p>
                <p className="text-xs text-muted-foreground">{error instanceof Error ? error.message : "Unknown error"}</p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Retry
                </Button>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <div className="flex items-center justify-between">
                    <TabsList>
                        <TabsTrigger value="all">All Stocks</TabsTrigger>
                        <TabsTrigger value="repair-2002">Repair Warehouse (2002)</TabsTrigger>
                        {warehouseTypeOptions
                            .filter(type => type !== "all" && type !== "repair-2002")
                            .map(type => (
                                <TabsTrigger key={type} value={type}>
                                    {type}
                                </TabsTrigger>
                            ))}
                    </TabsList>
                    <div className="ml-auto flex items-center gap-4">
                        {updateStatus && (
                            <div className="flex flex-col items-end text-right">
                                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                                    Last Data Update
                                </span>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-sm font-semibold">{updateStatus.dateStr}</span>
                                    <Badge variant={updateStatus.isUpdated ? "secondary" : "destructive"} className={updateStatus.isUpdated ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : ''}>
                                        {updateStatus.message}
                                    </Badge>
                                </div>
                            </div>
                        )}
                        <Button variant="outline" size="sm" onClick={() => refetch()}>
                            <RefreshCcw className="mr-2 h-4 w-4" />
                            Refresh DB Data
                        </Button>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    <ScoreCard
                        title="Total Stock Items"
                        value={stats.totalItems}
                        icon={Box}
                        description={
                            activeTab === "all"
                                ? "All unique stock units"
                                : activeTab === "repair-2002"
                                    ? "Stock units in Plant 2002 (Repair)"
                                    : `Stock units in warehouse type ${activeTab}`
                        }
                        gradient="from-blue-500/10 via-blue-400/5 to-indigo-500/10 border-blue-200/50 hover:shadow-lg"
                        iconColor="text-blue-600"
                        textColor="text-blue-900"
                    />
                    <ScoreCard
                        title="Low Stock Items"
                        value={stats.outOfStock}
                        icon={AlertTriangle}
                        description="Items below minimum level"
                        gradient="from-amber-500/10 via-amber-400/5 to-orange-500/10 border-amber-200/50 hover:shadow-lg"
                        iconColor="text-amber-600"
                        textColor="text-amber-900"
                    />
                    <ScoreCard
                        title="Total Valuation"
                        value={`IDR ${stats.totalValuationIdr.toLocaleString()}`}
                        icon={TrendingUp}
                        description={`Total inventory value (USD × ${parsedRate.toLocaleString()})`}
                        gradient="from-emerald-500/10 via-emerald-400/5 to-teal-500/10 border-emerald-200/50 hover:shadow-lg"
                        iconColor="text-emerald-600"
                        textColor="text-emerald-900"
                    />
                </div>

                <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-end gap-4">
                        <div className="w-full sm:w-[220px]">
                            <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Plant Filter</label>
                            <Select value={filterPlant} onValueChange={setFilterPlant}>
                                <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Select Plant" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Plants</SelectItem>
                                    {plantOptions.filter(p => p !== "all").map(plant => (
                                        <SelectItem key={plant} value={plant}>{plant}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="w-full sm:w-[280px]">
                            <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Sloc Description</label>
                            <Input
                                placeholder="Filter Sloc Desc..."
                                value={filterStorLocDesc}
                                onChange={(e) => setFilterStorLocDesc(e.target.value)}
                                className="h-9"
                            />
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setFilterPlant("all")
                                setFilterStorLocDesc("")
                                setSearchTerm("")
                                setActiveTab("all")
                            }}
                        >
                            <FilterX className="mr-2 h-4 w-4" />
                            Reset Filter
                        </Button>
                    </div>

                    <div className="flex justify-between items-center gap-4">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by material or sloc..."
                                className="pl-8"
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value)
                                    setPageIndex(0)
                                }}
                            />
                        </div>
                    </div>
                </div>

                <div className="rounded-md border bg-card">
                    <div ref={parentRef} className="h-[75vh] min-h-[720px] overflow-auto relative scrollbar-thin scrollbar-thumb-accent">
                        <Table>
                            <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
                                {table.getHeaderGroups().map((headerGroup) => (
                                    <TableRow key={headerGroup.id}>
                                        {headerGroup.headers.map((header) => (
                                            <TableHead key={header.id}>
                                                {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableHeader>
                            <TableBody>
                                {rowVirtualizer.getVirtualItems().length > 0 ? (
                                    <>
                                        <TableRow style={{ height: `${before}px` }} className="border-none">
                                            <TableCell colSpan={columns.length} className="p-0" />
                                        </TableRow>
                                        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                            const row = rows[virtualRow.index]
                                            return (
                                                <TableRow key={row.id}>
                                                    {row.getVisibleCells().map((cell) => (
                                                        <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                                                    ))}
                                                </TableRow>
                                            )
                                        })}
                                        <TableRow style={{ height: `${after}px` }} className="border-none">
                                            <TableCell colSpan={columns.length} className="p-0" />
                                        </TableRow>
                                    </>
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={columns.length} className="h-24 text-center">
                                            No records found in zmc9_stock_sap for current filter.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Rows per page</span>
                        <Select
                            value={String(pageSize)}
                            onValueChange={(value) => {
                                setPageSize(Number(value))
                                setPageIndex(0)
                            }}
                        >
                            <SelectTrigger className="h-8 w-[110px]">
                                <SelectValue placeholder="Page size" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="50">50</SelectItem>
                                <SelectItem value="100">100</SelectItem>
                                <SelectItem value="200">200</SelectItem>
                                <SelectItem value="500">500</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => table.previousPage()}
                            disabled={!table.getCanPreviousPage()}
                        >
                            Previous
                        </Button>
                        <span className="text-sm text-muted-foreground">
                            Page {table.getState().pagination.pageIndex + 1} of {Math.max(table.getPageCount(), 1)}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => table.nextPage()}
                            disabled={!table.getCanNextPage()}
                        >
                            Next
                        </Button>
                    </div>
                </div>

                <div className="text-sm text-muted-foreground">
                    Showing {data.length} of {apiStats?.totalCount ?? 0} records
                </div>
            </Tabs>
        </div>
    )
}
