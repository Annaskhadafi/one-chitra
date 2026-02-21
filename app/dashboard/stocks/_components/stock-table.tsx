"use client"

import * as React from "react"
import { useState, useMemo, useRef, useEffect } from "react"
import { deleteStock, bulkDeleteStocks, bulkUpdateStockMinStock, getStocks } from "@/app/actions/stock"
import { StockDialog } from "./stock-dialog"
import { StockCSVUpload } from "./stock-csv-upload"
import { Search, MoreHorizontal, Trash2, Pencil, Box, AlertTriangle, TrendingUp, RefreshCcw, ChevronUp, ChevronDown, Check, ListFilter, X, Loader2 } from "lucide-react"
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
import { cn } from "@/lib/utils"

interface StockTableProps {
    data: any[] // Initial data for query hydrantion if needed
    products: any[]
    warehouses: any[]
    defaultRate?: string
}

export function StockTable({ data: initialData, products, warehouses, defaultRate }: StockTableProps) {
    const { data: stocks = initialData, isLoading, refetch } = useQuery({
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

    const productCategories = useMemo(() => {
        const categories = new Set(products.map(p => p.category).filter(Boolean))
        return ["all", ...Array.from(categories).sort()]
    }, [products])

    const warehouseTypes = useMemo(() => {
        const types = new Set(warehouses.map(w => w.type).filter(Boolean))
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

    const columns = useMemo<ColumnDef<any>[]>(() => [
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
                    {row.original.totalStock.toLocaleString()}
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
                    {row.original.minStock?.toLocaleString() || 0}
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
                                            else toast.error(result.error)
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

    const table = useReactTable({
        data: stocks,
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
        globalFilterFn: (row, columnId, filterValue) => {
            const term = filterValue.toLowerCase()
            const item = row.original

            const matchesSearch = !!(
                item.product?.materialNumber.toLowerCase().includes(term) ||
                item.product?.materialDescription?.toLowerCase().includes(term) ||
                item.product?.oldMaterialNo?.toLowerCase().includes(term) ||
                item.warehouse?.sloc.toLowerCase().includes(term) ||
                item.warehouse?.description?.toLowerCase().includes(term) ||
                item.warehouse?.type?.toLowerCase().includes(term)
            )

            const matchesTab = activeTab === "all" || item.warehouse?.type === activeTab
            const matchesCategory = filterCategory === "all" || item.product?.category === filterCategory
            const matchesSlocDesc = !filterSlocDesc || item.warehouse?.description?.toLowerCase().includes(filterSlocDesc.toLowerCase())

            return matchesSearch && matchesTab && matchesCategory && matchesSlocDesc
        },
    })

    useEffect(() => {
        table.setGlobalFilter(globalFilter)
    }, [activeTab, filterCategory, filterSlocDesc, globalFilter, table])

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
        const selectedIds = Object.keys(rowSelection).map(id => parseInt(id))
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
        const selectedIds = Object.keys(rowSelection).map(id => parseInt(id))
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
                    <TabsList>
                        <TabsTrigger value="all">All Stocks</TabsTrigger>
                        {warehouseTypes.filter(t => t !== "all").map(type => (
                            <TabsTrigger key={type} value={type}>
                                {type}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                    <Button variant="outline" size="sm" onClick={() => refetch()} className="ml-auto">
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        Refresh
                    </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
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
                        value={`IDR ${stats.totalValuation.toLocaleString()}`}
                        icon={TrendingUp}
                        description="Total inventory value"
                        gradient="from-emerald-500/10 via-emerald-400/5 to-teal-500/10 border-emerald-200/50 hover:shadow-lg"
                        iconColor="text-emerald-600"
                        textColor="text-emerald-900"
                    />
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
                            <StockCSVUpload />
                            <StockDialog products={products} warehouses={warehouses} />
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
                    selectedCount={Object.keys(rowSelection).length}
                    onDelete={handleBulkDelete}
                    onEdit={handleBulkUpdateMinStock}
                    entityName="stock item"
                />
            </Tabs>
        </div>
    )
}
