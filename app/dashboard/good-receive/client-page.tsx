"use client"

import * as React from "react"
import { useState, useMemo, useRef } from "react"
import { Loader2, Search, Warehouse, Package, ArrowRight, ChevronUp, ChevronDown, CalendarDays, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import { fetchGoodReceiveFromSAP, processGoodReceive, type SAPGoodReceiveItem } from "@/app/actions/good-receive"

import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    flexRender,
    ColumnDef,
    SortingState,
} from "@tanstack/react-table"
import { useVirtualizer } from "@tanstack/react-virtual"

interface GoodReceiveClientProps {
    warehouses: { id: number; sloc: string; description: string | null }[]
}

export default function GoodReceiveClient({ warehouses }: GoodReceiveClientProps) {
    const [startDate, setStartDate] = useState<string>("")
    const [endDate, setEndDate] = useState<string>("")
    const [rawData, setRawData] = useState<SAPGoodReceiveItem[]>([])
    const [isFetching, setIsFetching] = useState(false)
    const [targetWarehouseId, setTargetWarehouseId] = useState<string>("")
    const [isProcessing, setIsProcessing] = useState(false)

    const [sorting, setSorting] = useState<SortingState>([])
    const [globalFilter, setGlobalFilter] = useState("")
    const [rowSelection, setRowSelection] = useState({})

    const handleFetch = async () => {
        if (!startDate || !endDate) {
            toast.error("Please select both start and end dates")
            return
        }

        setIsFetching(true)
        setRawData([])
        setRowSelection({})

        try {
            const result = await fetchGoodReceiveFromSAP(startDate, endDate)
            if (result.success && result.data) {
                setRawData(result.data)
                toast.success(`Fetched ${result.data.length} items`)
            } else {
                toast.error(result.error || "Failed to fetch data")
            }
        } catch {
            toast.error("An unexpected error occurred")
        } finally {
            setIsFetching(false)
        }
    }

    const itemHasMaterial = (item: SAPGoodReceiveItem) => {
        return !!(item.materialnumb && item.materialnumb !== "-")
    }

    const handleProcess = async () => {
        const selectedRows = table.getSelectedRowModel().flatRows
        if (selectedRows.length === 0) {
            toast.error("No items selected")
            return
        }
        if (!targetWarehouseId) {
            toast.error("Please select a target warehouse")
            return
        }

        setIsProcessing(true)

        const itemsToProcess = selectedRows.map(row => {
            const item = row.original
            return {
                materialNumber: item.materialnumb!.trim(),
                quantity: item.togr
            }
        })

        try {
            const result = await processGoodReceive(itemsToProcess, parseInt(targetWarehouseId))
            if (result.success) {
                toast.success(`Successfully processed ${result.processed} items`)
                if (result.errors) {
                    toast.warning(`Some items had errors: ${result.errors.length}`)
                }
                setRowSelection({})
            } else {
                toast.error(result.error || "Failed to process items")
            }
        } catch {
            toast.error("An unexpected error occurred")
        } finally {
            setIsProcessing(false)
        }
    }

    const columns = useMemo<ColumnDef<SAPGoodReceiveItem>[]>(() => [
        {
            id: "select",
            header: ({ table }) => (
                <Checkbox
                    checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="Select all"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    disabled={!itemHasMaterial(row.original)}
                    aria-label="Select row"
                />
            ),
            enableSorting: false,
        },
        {
            accessorKey: "ponumb",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4 h-8 text-xs font-semibold uppercase tracking-wider">
                    PO Number
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-3 w-3" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-3 w-3" /> : null}
                </Button>
            ),
            cell: ({ row }) => <span className="font-mono text-xs">{row.getValue("ponumb")}</span>,
        },
        {
            accessorKey: "podate",
            header: () => <span className="text-xs font-semibold uppercase tracking-wider">Date</span>,
            cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.getValue("podate")}</span>,
        },
        {
            accessorKey: "vendor",
            header: () => <span className="text-xs font-semibold uppercase tracking-wider">Vendor</span>,
            cell: ({ row }) => (
                <div className="max-w-[150px] truncate text-sm" title={row.getValue("vendor")}>
                    {row.getValue("vendor")}
                </div>
            ),
        },
        {
            accessorKey: "materialnumb",
            header: () => <span className="text-xs font-semibold uppercase tracking-wider">Material No.</span>,
            cell: ({ row }) => {
                const val = row.getValue("materialnumb") as string | undefined
                if (!val || val === "-") {
                    return <Badge variant="outline" className="text-xs text-muted-foreground border-dashed">No Material</Badge>
                }
                return <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{val}</span>
            },
        },
        {
            accessorKey: "material",
            header: () => <span className="text-xs font-semibold uppercase tracking-wider">Description</span>,
            cell: ({ row }) => (
                <div className="max-w-[200px] truncate text-sm" title={row.getValue("material")}>
                    {row.getValue("material")}
                </div>
            ),
        },
        {
            accessorKey: "poqty",
            header: () => <div className="text-right text-xs font-semibold uppercase tracking-wider">PO Qty</div>,
            cell: ({ row }) => <div className="text-right text-sm tabular-nums">{row.getValue("poqty")}</div>,
        },
        {
            accessorKey: "toinvo",
            header: () => <div className="text-right text-xs font-semibold uppercase tracking-wider">To Inv</div>,
            cell: ({ row }) => <div className="text-right text-sm tabular-nums text-muted-foreground">{row.getValue("toinvo")}</div>,
        },
        {
            accessorKey: "togr",
            header: () => <div className="text-right text-xs font-semibold uppercase tracking-wider">To GR</div>,
            cell: ({ row }) => <div className="text-right text-sm font-semibold tabular-nums text-indigo-600 dark:text-indigo-400">{row.getValue("togr")}</div>,
        },
    ], [])

    const table = useReactTable({
        data: rawData,
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
        globalFilterFn: (row, columnId, filterValue) => {
            const term = filterValue.toLowerCase()
            const item = row.original
            return !!(
                item.ponumb.toLowerCase().includes(term) ||
                item.vendor.toLowerCase().includes(term) ||
                item.materialnumb?.toLowerCase().includes(term) ||
                item.material.toLowerCase().includes(term)
            )
        },
    })

    const { rows } = table.getRowModel()
    const parentRef = useRef<HTMLDivElement>(null)

    const rowVirtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 45,
        overscan: 20,
    })

    const selectedCount = Object.keys(rowSelection).length
    const validItemsCount = rawData.filter(itemHasMaterial).length

    return (
        <TooltipProvider>
            <div className="flex flex-col gap-6 p-6">

                {/* Page Header */}
                <div className="flex items-start justify-between">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-indigo-100 dark:bg-indigo-950/50 p-2">
                                <Warehouse className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight">SAP Good Receive</h1>
                                <p className="text-muted-foreground text-sm">Synchronize incoming goods from SAP to local inventory.</p>
                            </div>
                        </div>
                    </div>
                    <Badge variant="outline" className="flex items-center gap-1.5 text-xs border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        SAP Connected
                    </Badge>
                </div>

                {/* Fetch Card */}
                <Card className="shadow-sm border bg-gradient-to-br from-indigo-50/50 to-background dark:from-indigo-950/20 dark:to-background">
                    <CardHeader className="pb-4">
                        <div className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 text-indigo-500" />
                            <CardTitle className="text-base">Fetch Data from SAP</CardTitle>
                        </div>
                        <CardDescription className="text-xs">Select a date range to retrieve Purchase Order data from the SAP system.</CardDescription>
                    </CardHeader>
                    <Separator />
                    <CardContent className="pt-5">
                        <div className="flex flex-col sm:flex-row gap-4 items-end">
                            <div className="grid gap-1.5 w-full sm:w-auto">
                                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Start Date</label>
                                <div className="relative">
                                    <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                    <Input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="pl-9 w-full sm:w-[200px] focus-visible:ring-indigo-500"
                                    />
                                </div>
                            </div>
                            <div className="grid gap-1.5 w-full sm:w-auto">
                                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">End Date</label>
                                <div className="relative">
                                    <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                    <Input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="pl-9 w-full sm:w-[200px] focus-visible:ring-indigo-500"
                                    />
                                </div>
                            </div>
                            <Button
                                onClick={handleFetch}
                                disabled={isFetching}
                                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                            >
                                {isFetching
                                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Fetching...</>
                                    : <><RefreshCw className="mr-2 h-4 w-4" />Fetch SAP Data</>
                                }
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Stats Strip — shown after successful fetch */}
                {rawData.length > 0 && (
                    <div className="grid grid-cols-3 gap-4">
                        <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm">
                            <div className="rounded-lg bg-indigo-100 dark:bg-indigo-950/40 p-2">
                                <Package className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground font-medium">Total Items</p>
                                <p className="text-xl font-bold text-indigo-700 dark:text-indigo-300 tabular-nums">{rawData.length}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm">
                            <div className="rounded-lg bg-emerald-100 dark:bg-emerald-950/40 p-2">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground font-medium">Valid Items</p>
                                <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">{validItemsCount}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm">
                            <div className="rounded-lg bg-amber-100 dark:bg-amber-950/40 p-2">
                                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground font-medium">Selected</p>
                                <p className="text-xl font-bold text-amber-700 dark:text-amber-300 tabular-nums">{selectedCount}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* PO Items Table */}
                {rawData.length > 0 && (
                    <Card className="shadow-sm border">
                        <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                            <div>
                                <CardTitle className="text-base">PO Items List</CardTitle>
                                <CardDescription className="text-xs">
                                    Found <span className="font-semibold text-foreground">{rawData.length}</span> items from SAP.
                                    Select valid items to add to stock.
                                </CardDescription>
                            </div>
                            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                                <div className="relative w-full sm:w-64">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Filter by PO, vendor, material..."
                                        value={globalFilter}
                                        onChange={(e) => setGlobalFilter(e.target.value)}
                                        className="pl-9 focus-visible:ring-indigo-500"
                                    />
                                </div>
                                <div className="flex items-center gap-2 w-full sm:w-auto rounded-xl border bg-muted/30 p-1.5">
                                    <Select value={targetWarehouseId} onValueChange={setTargetWarehouseId}>
                                        <SelectTrigger className="w-full sm:w-[200px] border-none bg-transparent shadow-none focus:ring-0 text-sm">
                                            <Warehouse className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                                            <SelectValue placeholder="Target Warehouse" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {warehouses.map((w) => (
                                                <SelectItem key={w.id} value={w.id.toString()}>
                                                    {w.sloc} - {w.description}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span>
                                                <Button
                                                    onClick={handleProcess}
                                                    disabled={isProcessing || selectedCount === 0 || !targetWarehouseId}
                                                    className="whitespace-nowrap bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                                                >
                                                    {isProcessing
                                                        ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
                                                        : <><Package className="mr-2 h-4 w-4" />Add to Stock ({selectedCount})</>
                                                    }
                                                </Button>
                                            </span>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" className="max-w-[200px] text-center">
                                            {!targetWarehouseId
                                                ? "Select a target warehouse first"
                                                : selectedCount === 0
                                                    ? "Select items from the table to process"
                                                    : `Process ${selectedCount} selected item(s) into stock`
                                            }
                                        </TooltipContent>
                                    </Tooltip>
                                </div>
                            </div>
                        </CardHeader>
                        <Separator />
                        <CardContent className="pt-0 px-0 pb-0">
                            <div className="relative">
                                <div
                                    ref={parentRef}
                                    className="h-[500px] overflow-auto relative"
                                >
                                    <Table>
                                        <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
                                            {table.getHeaderGroups().map((headerGroup) => (
                                                <TableRow key={headerGroup.id} className="bg-muted/50 hover:bg-muted/50">
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
                                                    <TableRow style={{ height: `${rowVirtualizer.getVirtualItems()[0].start}px` }} className="border-none">
                                                        <TableCell colSpan={columns.length} className="p-0" />
                                                    </TableRow>
                                                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                                        const row = rows[virtualRow.index]
                                                        const isSelectable = itemHasMaterial(row.original)
                                                        return (
                                                            <TableRow
                                                                key={row.id}
                                                                data-state={row.getIsSelected() && "selected"}
                                                                className={cn(
                                                                    "group transition-colors hover:bg-muted/30",
                                                                    !isSelectable && "opacity-50 bg-muted/20"
                                                                )}
                                                            >
                                                                {row.getVisibleCells().map((cell) => (
                                                                    <TableCell key={cell.id}>
                                                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                                    </TableCell>
                                                                ))}
                                                            </TableRow>
                                                        )
                                                    })}
                                                    <TableRow style={{ height: `${rowVirtualizer.getTotalSize() - rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1].end}px` }} className="border-none">
                                                        <TableCell colSpan={columns.length} className="p-0" />
                                                    </TableRow>
                                                </>
                                            ) : (
                                                <TableRow>
                                                    <TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground">
                                                        {globalFilter ? "No matching items found." : "No data fetched yet."}
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                            <Separator />
                            <div className="px-4 py-3 flex items-center justify-between text-sm text-muted-foreground">
                                <div className="flex items-center gap-1.5">
                                    Selected
                                    <Badge variant="secondary" className="tabular-nums font-semibold">{selectedCount}</Badge>
                                    of
                                    <span className="font-medium text-foreground">{table.getFilteredRowModel().rows.filter(r => itemHasMaterial(r.original)).length}</span>
                                    valid items
                                </div>
                                <div className="text-xs">
                                    Total valid items: <span className="font-semibold text-foreground">{validItemsCount}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Empty State — dates set but no fetch yet */}
                {!rawData.length && !isFetching && startDate && endDate && (
                    <div className="flex flex-col items-center justify-center p-16 border-2 border-dashed border-indigo-200 dark:border-indigo-800 rounded-xl bg-indigo-50/30 dark:bg-indigo-950/10">
                        <div className="rounded-full bg-indigo-100 dark:bg-indigo-900/50 p-5 mb-4 shadow-sm">
                            <ArrowRight className="h-8 w-8 text-indigo-500" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground">Ready to Fetch</h3>
                        <p className="text-muted-foreground text-sm max-w-xs text-center mt-1">
                            Click <span className="font-medium text-indigo-600 dark:text-indigo-400">&quot;Fetch SAP Data&quot;</span> to retrieve Purchase Order items for the selected date range.
                        </p>
                    </div>
                )}
            </div>
        </TooltipProvider>
    )
}
