"use client"

import * as React from "react"
import { useState, useMemo, useRef } from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon, Check, Loader2, Search, Warehouse, Package, ArrowRight, RefreshCcw, ChevronUp, ChevronDown } from "lucide-react"
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
        } catch (error) {
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
        } catch (error) {
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
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4 h-8">
                    PO Number
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
        },
        {
            accessorKey: "podate",
            header: "Date",
        },
        {
            accessorKey: "vendor",
            header: "Vendor",
            cell: ({ row }) => (
                <div className="max-w-[150px] truncate" title={row.getValue("vendor")}>
                    {row.getValue("vendor")}
                </div>
            ),
        },
        {
            accessorKey: "materialnumb",
            header: "Material No.",
            cell: ({ row }) => <span className="font-mono">{row.getValue("materialnumb") || "-"}</span>,
        },
        {
            accessorKey: "material",
            header: "Description",
            cell: ({ row }) => (
                <div className="max-w-[200px] truncate" title={row.getValue("material")}>
                    {row.getValue("material")}
                </div>
            ),
        },
        {
            accessorKey: "poqty",
            header: () => <div className="text-right">PO Qty</div>,
            cell: ({ row }) => <div className="text-right">{row.getValue("poqty")}</div>,
        },
        {
            accessorKey: "toinvo",
            header: () => <div className="text-right">To Inv</div>,
            cell: ({ row }) => <div className="text-right">{row.getValue("toinvo")}</div>,
        },
        {
            accessorKey: "togr",
            header: () => <div className="text-right">To GR</div>,
            cell: ({ row }) => <div className="text-right font-medium text-primary">{row.getValue("togr")}</div>,
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

    return (
        <div className="flex flex-col gap-6 p-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">SAP Good Receive</h1>
                    <p className="text-muted-foreground text-sm">Synchronize incoming goods from SAP to local inventory.</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Fetch Data from SAP</CardTitle>
                    <CardDescription>Select a date range to retrieve Purchase Order data.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row gap-4 items-end">
                    <div className="grid gap-2 w-full sm:w-auto">
                        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Start Date</label>
                        <Input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full sm:w-[200px]"
                        />
                    </div>
                    <div className="grid gap-2 w-full sm:w-auto">
                        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">End Date</label>
                        <Input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full sm:w-[200px]"
                        />
                    </div>
                    <Button onClick={handleFetch} disabled={isFetching} className="w-full sm:w-auto">
                        {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                        Fetch SAP Data
                    </Button>
                </CardContent>
            </Card>

            {rawData.length > 0 && (
                <Card>
                    <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div>
                            <CardTitle className="text-lg">PO Items List</CardTitle>
                            <CardDescription>Found {rawData.length} items from SAP.</CardDescription>
                        </div>
                        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Filter items..."
                                    value={globalFilter}
                                    onChange={(e) => setGlobalFilter(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                            <div className="flex items-center gap-2 w-full sm:w-auto border rounded-lg p-1 bg-muted/30">
                                <Select value={targetWarehouseId} onValueChange={setTargetWarehouseId}>
                                    <SelectTrigger className="w-full sm:w-[200px] border-none bg-transparent shadow-none focus:ring-0">
                                        <Warehouse className="mr-2 h-4 w-4 text-muted-foreground" />
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
                                <Button
                                    onClick={handleProcess}
                                    disabled={isProcessing || selectedCount === 0 || !targetWarehouseId}
                                    className="whitespace-nowrap"
                                >
                                    {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Package className="mr-2 h-4 w-4" />}
                                    Add to Stock ({selectedCount})
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border bg-card relative">
                            <div
                                ref={parentRef}
                                className="h-[500px] overflow-auto relative scrollbar-thin scrollbar-thumb-accent"
                            >
                                <Table>
                                    <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
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
                                                                "group transition-colors",
                                                                !isSelectable && "opacity-50 bg-muted/30 grayscale-[0.5]"
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
                        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                            <div>Selected {selectedCount} of {table.getFilteredRowModel().rows.filter(r => itemHasMaterial(r.original)).length} valid items</div>
                            <div>Total valid items: {rawData.filter(itemHasMaterial).length}</div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {!rawData.length && !isFetching && startDate && endDate && (
                <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-xl bg-muted/20">
                    <div className="p-4 bg-background rounded-full shadow-sm mb-4">
                        <ArrowRight className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold">No data fetched</h3>
                    <p className="text-muted-foreground max-w-xs text-center">Click "Fetch SAP Data" to retrieve Purchase Order items for the selected range.</p>
                </div>
            )}
        </div>
    )
}
