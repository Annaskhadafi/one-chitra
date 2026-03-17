"use client"

import * as React from "react"
import { useState, useMemo, useRef, useEffect } from "react"
import { deleteStock, bulkDeleteStocks, bulkUpdateStockMinStock, getStocks } from "@/app/actions/stock"
import { StockDialog } from "./stock-dialog"
import { StockCSVUpload } from "./stock-csv-upload"
import { Search, MoreHorizontal, Trash2, Pencil, Box, AlertTriangle, TrendingUp, RefreshCcw, ChevronUp, ChevronDown, Check, ListFilter, X, Loader2, Copy } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { ScoreCard } from "@/components/score-card"
import { BulkActions } from "@/components/bulk-actions"
import { toast } from "sonner"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { updateSetting } from "@/app/actions/settings"
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
import type { Product, Warehouse, Stock } from "@/lib/types"

interface StockTableProps {
    data: Stock[] // Initial data for query hydrantion if needed
    products: Product[]
    warehouses: Warehouse[]
    defaultRate?: string
}

export function StockTable({ data: initialData, products, warehouses, defaultRate }: StockTableProps) {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    const { data: stocks = initialData, isLoading, refetch } = useQuery<Stock[]>({
        queryKey: ["stocks"],
        queryFn: async () => {
            return await getStocks()
        },
        staleTime: 60 * 1000,
    })

    const [globalFilter, setGlobalFilter] = useState("")
    const [sorting, setSorting] = useState<SortingState>([])
    const [rowSelection, setRowSelection] = useState({})
    const [activeTab, setActiveTab] = useState("all")
    const [filterCategory, setFilterCategory] = useState("all")
    const [filterSlocDesc, setFilterSlocDesc] = useState("")
    const [manualRate, setManualRate] = useState<string>(defaultRate || "1")
    const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false)

    const productCategories = useMemo(() => {
        const categories = new Set(products.map(p => p.category).filter(Boolean))
        return ["all", ...Array.from(categories).sort()]
    }, [products])

    const warehouseTypes: string[] = useMemo(() => {
        const types = new Set(warehouses.map(w => w.type).filter((t): t is string => Boolean(t)))
        return ["all", ...Array.from(types).sort()]
    }, [warehouses])

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value)
    }

    const calculateValuation = (stock: number, costSap: string | null) => {
        if (!costSap) return 0
        const cost = parseFloat(costSap.toString().replace(/,/g, "")) || 0
        const rate = parseFloat(manualRate) || 0
        return stock * cost * rate
    }

    const columns = useMemo<ColumnDef<Stock>[]>(() => [
        {
            id: "select",
            header: ({ table }) => (
                <Checkbox
                    checked={table.getIsAllPageRowsSelected()}
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="Select all"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label="Select row"
                />
            ),
        },
        {
            accessorKey: "product.plant",
            header: "Plnt",
            cell: ({ row }) => row.original.product?.plant || "-",
        },
        {
            accessorKey: "product.category",
            header: "Category",
            cell: ({ row }) => row.original.product?.category || "-",
        },
        {
            accessorKey: "product.brand",
            header: "Brand",
            cell: ({ row }) => row.original.product?.brand || "-",
        },
        {
            accessorKey: "product.materialNumber",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4 h-8">
                    Material #
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
            cell: ({ row }) => (
                <span className="font-medium text-blue-600">
                    {row.original.product?.materialNumber}
                </span>
            ),
        },
        {
            accessorKey: "product.oldMaterialNo",
            header: "Old Mat. No",
            cell: ({ row }) => row.original.product?.oldMaterialNo || "-",
        },
        {
            accessorKey: "product.materialDescription",
            header: "Description",
            cell: ({ row }) => (
                <div className="max-w-[200px] truncate" title={row.original.product?.materialDescription || ""}>
                    {row.original.product?.materialDescription}
                </div>
            ),
        },
        {
            accessorKey: "warehouse.sloc",
            header: "SLoc",
            cell: ({ row }) => row.original.warehouse?.sloc,
        },
        {
            accessorKey: "warehouse.description",
            header: "Sloc Desc",
            cell: ({ row }) => (
                <div className="max-w-[150px] truncate" title={row.original.warehouse?.description || ""}>
                    {row.original.warehouse?.description}
                </div>
            ),
        },
        {
            accessorKey: "totalStock",
            header: ({ column }) => (
                <div className="text-right">
                    <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-mr-4 h-8">
                        Act Stock
                        {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                    </Button>
                </div>
            ),
            cell: ({ row }) => (
                <div className="text-right font-mono font-bold">
                    {row.original.totalStock.toLocaleString("id-ID")}
                </div>
            ),
        },
        {
            accessorKey: "minStock",
            header: ({ column }) => (
                <div className="text-right">
                    <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-mr-4 h-8">
                        Min Stock
                        {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                    </Button>
                </div>
            ),
            cell: ({ row }) => (
                <div className="text-right font-mono text-orange-600">
                    {row.original.minStock?.toLocaleString("id-ID") || 0}
                </div>
            ),
        },
        {
            id: "valuation",
            header: () => <div className="text-right">Valuation</div>,
            cell: ({ row }) => {
                const val = calculateValuation(row.original.totalStock, row.original.product?.costSap ?? null)
                return (
                    <div className="text-right font-mono">
                        {formatCurrency(val)}
                        {manualRate !== "1" && manualRate !== "" && (
                            <span className="block text-[10px] text-muted-foreground">
                                x{manualRate}
                            </span>
                        )}
                    </div>
                )
            },
        },
        {
            accessorKey: "warehouse.type",
            header: "Type Warehouse",
            cell: ({ row }) => (
                <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
                    {row.original.warehouse?.type || "N/A"}
                </span>
            ),
        },
        {
            id: "actions",
            cell: ({ row }) => (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <StockDialog
                            stock={row.original}
                            products={products}
                            warehouses={warehouses}
                            onSuccess={() => refetch()}
                            trigger={
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Edit
                                </DropdownMenuItem>
                            }
                        />
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <DropdownMenuItem
                                    onSelect={(e) => e.preventDefault()}
                                    className="text-destructive focus:text-destructive"
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This will remove the stock record for this sloc. This action cannot be undone.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={async () => {
                                            const result = await deleteStock(row.original.id)
                                            if (result.success) toast.success("Stock entry deleted")
                                            else toast.error("error" in result ? result.error : "Failed to delete stock")
                                        }}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                        Delete
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </DropdownMenuContent>
                </DropdownMenu>
            ),
        },
    ], [manualRate, products, warehouses])

    // Pre-filter by tab/category/slocDesc so TanStack Table always sees changed data
    const preFilteredData = useMemo(() => {
        let filtered = stocks.filter(item => {
            const matchesTab = activeTab === "all" || item.warehouse?.type === activeTab
            const matchesCategory = filterCategory === "all" || item.product?.category === filterCategory
            const matchesSlocDesc = !filterSlocDesc || item.warehouse?.description?.toLowerCase().includes(filterSlocDesc.toLowerCase())
            return matchesTab && matchesCategory && matchesSlocDesc
        })

        if (showDuplicatesOnly) {
            // Build key map for duplicate detection
            const keyCounts = new Map<string, number>()
            filtered.forEach(item => {
                const key = [
                    item.product?.plant, item.product?.category, item.product?.brand,
                    item.product?.materialNumber, item.product?.oldMaterialNo,
                    item.product?.materialDescription, item.warehouse?.sloc,
                    item.warehouse?.description
                ].map(v => (v || '').toString().toLowerCase().trim()).join('|')
                keyCounts.set(key, (keyCounts.get(key) || 0) + 1)
            })
            // Filter only duplicates
            filtered = filtered.filter(item => {
                const key = [
                    item.product?.plant, item.product?.category, item.product?.brand,
                    item.product?.materialNumber, item.product?.oldMaterialNo,
                    item.product?.materialDescription, item.warehouse?.sloc,
                    item.warehouse?.description
                ].map(v => (v || '').toString().toLowerCase().trim()).join('|')
                return (keyCounts.get(key) || 0) > 1
            })
            // Sort so duplicates are grouped together
            filtered.sort((a, b) => {
                const keyA = [
                    a.product?.plant, a.product?.category, a.product?.brand,
                    a.product?.materialNumber, a.product?.oldMaterialNo,
                    a.product?.materialDescription, a.warehouse?.sloc,
                    a.warehouse?.description
                ].map(v => (v || '').toString().toLowerCase().trim()).join('|')
                const keyB = [
                    b.product?.plant, b.product?.category, b.product?.brand,
                    b.product?.materialNumber, b.product?.oldMaterialNo,
                    b.product?.materialDescription, b.warehouse?.sloc,
                    b.warehouse?.description
                ].map(v => (v || '').toString().toLowerCase().trim()).join('|')
                return keyA.localeCompare(keyB)
            })
        }

        return filtered
    }, [stocks, activeTab, filterCategory, filterSlocDesc, showDuplicatesOnly])

    const table = useReactTable({
        data: preFilteredData,
        columns,
        state: {
            sorting,
            globalFilter,
            rowSelection,
        },
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        onRowSelectionChange: setRowSelection,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getRowId: (row) => row.id.toString(),
        globalFilterFn: (row, columnId, filterValue): boolean => {
            const term = filterValue.toLowerCase()
            const item = row.original

            return !!(
                item.product?.materialNumber?.toLowerCase().includes(term) ||
                item.product?.materialDescription?.toLowerCase().includes(term) ||
                item.product?.oldMaterialNo?.toLowerCase().includes(term) ||
                item.warehouse?.sloc?.toLowerCase().includes(term) ||
                item.warehouse?.description?.toLowerCase().includes(term) ||
                item.warehouse?.type?.toLowerCase().includes(term)
            )
        },
    })

    const { rows } = table.getRowModel()
    const filteredRows = table.getFilteredRowModel().rows

    const stats = useMemo(() => {
        return {
            totalItems: filteredRows.length,
            lowStock: filteredRows.filter(row => row.original.totalStock <= row.original.minStock).length,
            totalValuation: filteredRows.reduce((sum, row) => {
                return sum + calculateValuation(row.original.totalStock, row.original.product?.costSap ?? null)
            }, 0)
        }
    }, [filteredRows, manualRate])

    const parentRef = useRef<HTMLDivElement>(null)
    const rowVirtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 45,
        overscan: 20,
    })

    const [before, after] = rowVirtualizer.getVirtualItems().length > 0
        ? [
            rowVirtualizer.getVirtualItems()[0].start,
            rowVirtualizer.getTotalSize() - rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1].end,
        ]
        : [0, 0]

    const handleBulkDelete = async () => {
        const selectedIds = table.getSelectedRowModel().flatRows.map(r => r.original.id)
        if (confirm("Are you sure you want to delete selected stock entries?")) {
            const result = await bulkDeleteStocks(selectedIds)
            if (result.success) {
                toast.success("Stock entries deleted successfully")
                setRowSelection({})
                refetch()
            } else {
                toast.error(result.error)
            }
        }
    }

    const handleBulkUpdateMinStock = async () => {
        const selectedIds = table.getSelectedRowModel().flatRows.map(r => r.original.id)
        const minStockStr = prompt("Enter new minimum stock level for selected items:")
        if (minStockStr) {
            const minStock = parseInt(minStockStr)
            if (isNaN(minStock)) {
                toast.error("Invalid number")
                return
            }
            const result = await bulkUpdateStockMinStock(selectedIds, minStock)
            if (result.success) {
                toast.success("Minimum stock levels updated successfully")
                setRowSelection({})
                refetch()
            } else {
                toast.error(result.error)
            }
        }
    }

    if (!mounted) {
        return (
            <div className="h-[400px] flex flex-col items-center justify-center gap-4 border rounded-lg bg-card/50">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Preparing stock interface...</p>
            </div>
        )
    }

    if (isLoading && !stocks.length) {
        return (
            <div className="h-[400px] flex flex-col items-center justify-center gap-4 border rounded-lg bg-card/50">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Fetching Stock Levels...</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="max-w-[calc(100vw-7rem)] overflow-x-auto sm:max-w-none">
                        <TabsList className="w-max min-w-max flex-nowrap">
                            <TabsTrigger value="all">All Stocks</TabsTrigger>
                            {warehouseTypes.filter(t => t !== "all").map(type => (
                                <TabsTrigger key={type || "unknown"} value={type || "unknown"}>
                                    {type}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => refetch()} className="ml-auto">
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        Refresh
                    </Button>
                </div>

                {/* Duplicate Warning Banner */}
                {(() => {
                    const keyCounts = new Map<string, number>()
                    stocks.forEach(item => {
                        const key = [
                            item.product?.plant, item.product?.category, item.product?.brand,
                            item.product?.materialNumber, item.product?.oldMaterialNo,
                            item.product?.materialDescription, item.warehouse?.sloc,
                            item.warehouse?.description
                        ].map(v => (v || '').toString().toLowerCase().trim()).join('|')
                        keyCounts.set(key, (keyCounts.get(key) || 0) + 1)
                    })
                    const dupCount = stocks.filter(item => {
                        const key = [
                            item.product?.plant, item.product?.category, item.product?.brand,
                            item.product?.materialNumber, item.product?.oldMaterialNo,
                            item.product?.materialDescription, item.warehouse?.sloc,
                            item.warehouse?.description
                        ].map(v => (v || '').toString().toLowerCase().trim()).join('|')
                        return (keyCounts.get(key) || 0) > 1
                    }).length
                    if (dupCount === 0) return null
                    return (
                        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-lg">
                            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
                            <div className="flex-1">
                                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                                    ⚠ Terdeteksi {dupCount} data duplikat!
                                </p>
                                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                                    Terdapat data dengan kolom identik (Plant, Category, Brand, Material#, Old Mat No, Description, SLoc, Sloc Desc). Mohon dicek dan divalidasi, hapus salah satu jika perlu.
                                </p>
                            </div>
                            {!showDuplicatesOnly && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setShowDuplicatesOnly(true)}
                                    className="shrink-0 border-amber-400 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/50 gap-1.5"
                                >
                                    <Copy className="h-3.5 w-3.5" />
                                    Lihat Duplikat
                                </Button>
                            )}
                        </div>
                    )
                })()}

                <div className="grid gap-4 md:grid-cols-4">
                    <ScoreCard
                        title="Total Stock Items"
                        value={stats.totalItems}
                        icon={Box}
                        description={activeTab === 'all' ? "All unique stock units" : `Stock units in ${activeTab}`}
                        gradient="from-blue-500/10 via-blue-400/5 to-indigo-500/10 border-blue-200/50 hover:shadow-lg"
                        iconColor="text-blue-600"
                        textColor="text-blue-900"
                    />
                    <ScoreCard
                        title="Low Stock Items"
                        value={stats.lowStock}
                        icon={AlertTriangle}
                        description="Items below minimum level"
                        gradient="from-amber-500/10 via-amber-400/5 to-orange-500/10 border-amber-200/50 hover:shadow-lg"
                        iconColor="text-amber-600"
                        textColor="text-amber-900"
                    />
                    <ScoreCard
                        title="Total Valuation"
                        value={`IDR ${stats.totalValuation.toLocaleString("id-ID")}`}
                        icon={TrendingUp}
                        description="Total inventory value"
                        gradient="from-emerald-500/10 via-emerald-400/5 to-teal-500/10 border-emerald-200/50 hover:shadow-lg"
                        iconColor="text-emerald-600"
                        textColor="text-emerald-900"
                    />
                    <div
                        className={`relative overflow-hidden rounded-xl border p-4 cursor-pointer transition-all ${
                            showDuplicatesOnly
                                ? 'bg-gradient-to-br from-violet-500/20 via-violet-400/10 to-purple-500/20 border-violet-400 ring-2 ring-violet-400/50 shadow-lg'
                                : 'bg-gradient-to-br from-violet-500/10 via-violet-400/5 to-purple-500/10 border-violet-200/50 hover:shadow-lg'
                        }`}
                        onClick={() => setShowDuplicatesOnly(!showDuplicatesOnly)}
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-violet-600">Duplikat</p>
                                <p className={`text-2xl font-bold text-violet-900 dark:text-violet-300`}>
                                    {(() => {
                                        const keyCounts = new Map<string, number>()
                                        stocks.forEach(item => {
                                            const key = [
                                                item.product?.plant, item.product?.category, item.product?.brand,
                                                item.product?.materialNumber, item.product?.oldMaterialNo,
                                                item.product?.materialDescription, item.warehouse?.sloc,
                                                item.warehouse?.description
                                            ].map(v => (v || '').toString().toLowerCase().trim()).join('|')
                                            keyCounts.set(key, (keyCounts.get(key) || 0) + 1)
                                        })
                                        return stocks.filter(item => {
                                            const key = [
                                                item.product?.plant, item.product?.category, item.product?.brand,
                                                item.product?.materialNumber, item.product?.oldMaterialNo,
                                                item.product?.materialDescription, item.warehouse?.sloc,
                                                item.warehouse?.description
                                            ].map(v => (v || '').toString().toLowerCase().trim()).join('|')
                                            return (keyCounts.get(key) || 0) > 1
                                        }).length
                                    })()}
                                </p>
                            </div>
                            <Copy className={`h-5 w-5 text-violet-600`} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {showDuplicatesOnly ? '✓ Filter aktif — klik untuk nonaktifkan' : 'Data identik semua kolom'}
                        </p>
                    </div>
                </div>

                <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="w-full sm:w-[200px]">
                            <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Manual Rate Exchange</label>
                            <Input
                                type="number"
                                placeholder="Rate..."
                                value={manualRate}
                                onChange={(e) => setManualRate(e.target.value)}
                                onBlur={(e) => {
                                    if (e.target.value) {
                                        updateSetting("manual_usd_rate", e.target.value)
                                    }
                                }}
                                className="h-9"
                            />
                        </div>
                        <div className="w-full sm:w-[200px]">
                            <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Sloc Description</label>
                            <Input
                                placeholder="Filter Sloc Desc..."
                                value={filterSlocDesc}
                                onChange={(e) => setFilterSlocDesc(e.target.value)}
                                className="h-9"
                            />
                        </div>
                        <div className="w-full sm:w-[200px]">
                            <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Product Type</label>
                            <Select value={filterCategory} onValueChange={setFilterCategory}>
                                <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Select Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    {productCategories.filter(c => c !== 'all').map(category => (
                                        <SelectItem key={category} value={category}>{category}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex justify-between items-center gap-4">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by material or sloc..."
                                className="pl-8"
                                value={globalFilter}
                                onChange={(e) => setGlobalFilter(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant={showDuplicatesOnly ? "default" : "outline"}
                                size="sm"
                                onClick={() => setShowDuplicatesOnly(!showDuplicatesOnly)}
                                className={showDuplicatesOnly ? "bg-violet-600 hover:bg-violet-700 text-white gap-1.5" : "gap-1.5"}
                            >
                                <Copy className="h-3.5 w-3.5" />
                                {showDuplicatesOnly ? 'Showing Duplicates' : 'Duplikat'}
                            </Button>
                            <StockCSVUpload onSuccess={() => refetch()} />
                            <StockDialog products={products} warehouses={warehouses} onSuccess={() => refetch()} />
                        </div>
                    </div>
                </div>

                <div className="rounded-md border bg-card">
                    <div
                        ref={parentRef}
                        className="h-[600px] overflow-auto relative scrollbar-thin scrollbar-thumb-accent"
                    >
                        <Table>
                            <TableHeader>
                                {table.getHeaderGroups().map((headerGroup) => (
                                    <TableRow key={headerGroup.id} className="bg-muted/50">
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
                                            <TableCell colSpan={columns.length} />
                                        </TableRow>
                                        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                            const row = rows[virtualRow.index]
                                            return (
                                                <TableRow key={row.id} className="group transition-colors hover:bg-muted/50">
                                                    {row.getVisibleCells().map((cell) => (
                                                        <TableCell key={cell.id}>
                                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                        </TableCell>
                                                    ))}
                                                </TableRow>
                                            )
                                        })}
                                        <TableRow style={{ height: `${after}px` }} className="border-none">
                                            <TableCell colSpan={columns.length} />
                                        </TableRow>
                                    </>
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground">
                                            <Box className="h-8 w-8 mb-2 opacity-20 mx-auto" />
                                            No stock levels found for {activeTab === 'all' ? 'any type' : activeTab}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                <div className="text-sm text-muted-foreground">
                    Showing {filteredRows.length} of {stocks.length} records
                </div>

                <BulkActions
                    selectedCount={table.getSelectedRowModel().flatRows.length}
                    onDelete={handleBulkDelete}
                    onEdit={handleBulkUpdateMinStock}
                    entityName="stock item"
                />
            </Tabs>
        </div>
    )
}
