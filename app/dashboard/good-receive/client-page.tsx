"use client"

import * as React from "react"
import { useState, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
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
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"
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
    const router = useRouter()
    const [period, setPeriod] = useState<string>("this-month")
    const [startDate, setStartDate] = useState<string>("")
    const [endDate, setEndDate] = useState<string>("")
    const [rawData, setRawData] = useState<SAPGoodReceiveItem[]>([])
    const [isFetching, setIsFetching] = useState(false)
    const [targetWarehouseId, setTargetWarehouseId] = useState<string>("")
    const [isProcessing, setIsProcessing] = useState(false)
    const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending')

    const [sorting, setSorting] = useState<SortingState>([])
    const [globalFilter, setGlobalFilter] = useState("")
    const [rowSelection, setRowSelection] = useState({})
    const [isHydrated, setIsHydrated] = useState(false)

    React.useEffect(() => {
        setIsHydrated(true)
    }, [])

    // Watch period changes and update date pickers
    React.useEffect(() => {
        if (period === "custom") return;

        const today = new Date()
        let fetchStart = ""
        let fetchEnd = ""

        if (period === "today") {
            const dateStr = today.toISOString().split('T')[0]
            fetchStart = dateStr
            fetchEnd = dateStr
        } else if (period === "this-week") {
            const firstDay = new Date(today.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1)))
            const lastDay = new Date(today.setDate(today.getDate() - today.getDay() + 7))
            fetchStart = firstDay.toISOString().split('T')[0]
            fetchEnd = lastDay.toISOString().split('T')[0]
        } else if (period === "this-month") {
            const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
            const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)
            fetchStart = firstDay.toISOString().split('T')[0]
            fetchEnd = lastDay.toISOString().split('T')[0]
        } else if (period === "this-year") {
            const firstDay = new Date(today.getFullYear(), 0, 1)
            const lastDay = new Date(today.getFullYear(), 11, 31)
            fetchStart = firstDay.toISOString().split('T')[0]
            fetchEnd = lastDay.toISOString().split('T')[0]
        }

        setStartDate(fetchStart)
        setEndDate(fetchEnd)
    }, [period])

    const handleFetch = React.useCallback(async () => {
        if (!startDate || !endDate) {
            toast.error("Format tanggal tidak valid.")
            return
        }

        setIsFetching(true)
        setRawData([])
        setRowSelection({})

        try {
            const result = await fetchGoodReceiveFromSAP(startDate, endDate, activeTab)

            if (result.success && result.data) {
                setRawData(result.data)
                toast.success(`Berhasil menarik ${result.data.length} item SAP (${activeTab})`)
            } else {
                toast.error(result.error || "Gagal menarik data")
            }
        } catch {
            toast.error("Terjadi kesalahan sistem")
        } finally {
            setIsFetching(false)
        }
    }, [startDate, endDate, activeTab])

    React.useEffect(() => {
        if (isHydrated && startDate && endDate) {
            handleFetch()
        }
    }, [isHydrated, handleFetch])

    const itemHasMaterial = (item: SAPGoodReceiveItem) => {
        return !!(item.materialnumb && item.materialnumb !== "-") && !item.isProcessed
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
                quantity: item.togr,
                ponumb: item.ponumb,
                itemIndex: item.item || 0
            }
        })

        try {
            const warehouseIdInt = parseInt(targetWarehouseId)
            const result = await processGoodReceive(itemsToProcess, warehouseIdInt)
            if (result.success) {
                toast.success(`Berhasil memproses ${result.processed} item ke stok`)

                // Update local state to show remarks and disable items
                setRawData(prev => prev.map(item => {
                    const isProcessedNow = itemsToProcess.some(it =>
                        it.ponumb === item.ponumb && it.itemIndex === item.item
                    )
                    if (isProcessedNow) {
                        return {
                            ...item,
                            isProcessed: true,
                            processedDate: new Date(),
                            warehouseId: warehouseIdInt
                        }
                    }
                    return item
                }))

                router.refresh()
                setRowSelection({})
            } else {
                toast.error(result.error || "Gagal memproses item")
            }
        } catch {
            toast.error("Terjadi kesalahan sistem")
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
                    disabled={activeTab === 'history' || !itemHasMaterial(row.original)}
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
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-mono text-xs font-semibold">{row.getValue("ponumb")}</span>
                    <span className="text-[10px] text-muted-foreground">Item: {row.original.item}</span>
                </div>
            ),
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
            cell: ({ row }) => {
                const isProcessed = row.original.isProcessed
                const warehouseId = row.original.warehouseId
                const dateProcessed = row.original.processedDate

                if (isProcessed) {
                    const warehouseName = warehouses.find(w => w.id === warehouseId)?.description || `WH-${warehouseId}`
                    const dateStr = dateProcessed ? new Date(dateProcessed).toLocaleDateString() : ""
                    return (
                        <div className="flex flex-col items-end gap-1">
                            <div className="text-right text-sm tabular-nums text-muted-foreground line-through decoration-1 decoration-muted-foreground/50">
                                {row.getValue("togr")}
                            </div>
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 px-1.5 py-0.5 rounded leading-tight whitespace-nowrap text-right">
                                Masuk {warehouseName} <br />
                                {dateStr}
                            </span>
                        </div>
                    )
                }

                return <div className="text-right text-sm font-semibold tabular-nums text-indigo-600 dark:text-indigo-400">{row.getValue("togr")}</div>
            },
        },
    ], [activeTab, warehouses])

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

    if (!isHydrated) {
        return (
            <div className="flex flex-col gap-6 p-6 animate-pulse">
                <div className="h-24 bg-muted rounded-xl" />
                <div className="h-12 w-[400px] bg-muted rounded-lg" />
                <div className="h-40 bg-muted rounded-xl" />
                <div className="h-96 bg-muted rounded-xl" />
            </div>
        )
    }

    return (
        <TooltipProvider>
            <div className="flex flex-col gap-6 p-6">

                {/* Page Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-indigo-100 dark:bg-indigo-950/50 p-2">
                            <Warehouse className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">SAP Good Receive</h1>
                            <p className="text-muted-foreground text-sm">Synchronize incoming goods from SAP to local inventory.</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="flex items-center gap-1.5 text-xs border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 shadow-sm">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            SAP Connected
                        </Badge>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleFetch}
                            disabled={isFetching}
                            className="h-9 shadow-sm"
                        >
                            {isFetching ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <RefreshCw className="h-4 w-4 mr-2" />
                            )}
                            Refresh
                        </Button>
                    </div>
                </div>

                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-2">
                        <TabsList className="grid w-full md:w-[400px] grid-cols-2 shadow-sm">
                            <TabsTrigger value="pending" className="flex items-center gap-2">
                                <Package className="h-4 w-4" />
                                SAP Pending
                                {activeTab === 'pending' && rawData.length > 0 && (
                                    <Badge variant="secondary" className="h-5 px-1.5 min-w-[20px] justify-center text-[10px] ml-1">
                                        {rawData.length}
                                    </Badge>
                                )}
                            </TabsTrigger>
                            <TabsTrigger value="history" className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4" />
                                SAP History
                            </TabsTrigger>
                        </TabsList>

                        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                            <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-lg border">
                                <Select value={period} onValueChange={setPeriod}>
                                    <SelectTrigger className="w-[140px] h-8 border-none bg-transparent shadow-none focus:ring-0 text-xs">
                                        <CalendarDays className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                                        <SelectValue placeholder="Pilih Periode" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="today">Hari Ini</SelectItem>
                                        <SelectItem value="this-week">Minggu Ini</SelectItem>
                                        <SelectItem value="this-month">Bulan Ini</SelectItem>
                                        <SelectItem value="this-year">Tahun Ini</SelectItem>
                                        <SelectItem value="custom">Custom Range</SelectItem>
                                    </SelectContent>
                                </Select>

                                {period === "custom" && (
                                    <div className="flex items-center gap-1">
                                        <Input
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            className="h-7 w-[120px] text-[10px] px-2 focus-visible:ring-indigo-500"
                                        />
                                        <span className="text-muted-foreground">-</span>
                                        <Input
                                            type="date"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            className="h-7 w-[120px] text-[10px] px-2 focus-visible:ring-indigo-500"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Stats Strip */}
                    {rawData.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm border-l-4 border-l-indigo-500">
                                <div className="rounded-lg bg-indigo-100 dark:bg-indigo-950/40 p-2">
                                    <Package className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Items</p>
                                    <p className="text-xl font-bold text-indigo-700 dark:text-indigo-300 tabular-nums">{rawData.length}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm border-l-4 border-l-emerald-500">
                                <div className="rounded-lg bg-emerald-100 dark:bg-emerald-950/40 p-2">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Valid Items</p>
                                    <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">{validItemsCount}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm border-l-4 border-l-amber-500">
                                <div className="rounded-lg bg-amber-100 dark:bg-amber-950/40 p-2">
                                    <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Selected</p>
                                    <p className="text-xl font-bold text-amber-700 dark:text-amber-300 tabular-nums">{selectedCount}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Main Content Areas */}
                    <TabsContent value="pending" className="m-0 focus-visible:ring-0">
                        {rawData.length > 0 ? (
                            <Card className="shadow-sm border bg-card/50">
                                <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 py-4">
                                    <div>
                                        <CardTitle className="text-base">Pending PO Items</CardTitle>
                                        <CardDescription className="text-xs">Daftar barang dari SAP yang siap masuk stok.</CardDescription>
                                    </div>
                                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                                        <div className="relative w-full sm:w-64">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                            <Input
                                                placeholder="Cari PO, material..."
                                                value={globalFilter}
                                                onChange={(e) => setGlobalFilter(e.target.value)}
                                                className="pl-9 h-9"
                                            />
                                        </div>
                                        <div className="flex items-center gap-2 w-full sm:w-auto rounded-lg border bg-muted/20 p-1">
                                            <Select value={targetWarehouseId} onValueChange={setTargetWarehouseId}>
                                                <SelectTrigger className="w-full sm:w-[180px] h-8 border-none bg-transparent shadow-none focus:ring-0 text-sm">
                                                    <Warehouse className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                                                    <SelectValue placeholder="Gudang Tujuan" />
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
                                                className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                                                size="sm"
                                            >
                                                {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Package className="h-3.5 w-3.5 mr-1" />}
                                                Add to Stock ({selectedCount})
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <Separator />
                                <div className="relative overflow-hidden rounded-b-xl border-t">
                                    <div ref={parentRef} className="h-[500px] overflow-auto scrollbar-thin scrollbar-thumb-accent">
                                        <Table>
                                            <TableHeader className="sticky top-0 z-20 bg-muted/80 backdrop-blur-md">
                                                {table.getHeaderGroups().map((headerGroup) => (
                                                    <TableRow key={headerGroup.id} className="hover:bg-transparent border-b">
                                                        {headerGroup.headers.map((header) => (
                                                            <TableHead key={header.id} className="h-10 text-xs text-muted-foreground">
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
                                                                        "group hover:bg-muted/30 transition-colors h-10 border-b",
                                                                        !isSelectable && "opacity-50"
                                                                    )}
                                                                >
                                                                    {row.getVisibleCells().map((cell) => (
                                                                        <TableCell key={cell.id} className="py-2">
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
                                                        <TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground bg-muted/5">
                                                            No items found.
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </Card>
                        ) : !isFetching && (
                            <div className="flex flex-col items-center justify-center p-16 border-2 border-dashed border-muted rounded-xl bg-muted/10 opacity-60">
                                <Package className="h-10 w-10 text-muted-foreground/40 mb-3" />
                                <h3 className="font-medium text-muted-foreground">No Pending Items</h3>
                                <p className="text-xs text-muted-foreground mt-1">Gunakan fetch di atas untuk menarik data terbaru.</p>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="history" className="m-0 focus-visible:ring-0">
                        {rawData.length > 0 ? (
                            <Card className="shadow-sm border bg-card/50">
                                <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 py-4">
                                    <div>
                                        <CardTitle className="text-base text-emerald-700 dark:text-emerald-400">Processed Items History</CardTitle>
                                        <CardDescription className="text-xs">Barang yang sudah berhasil masuk ke stok lokal.</CardDescription>
                                    </div>
                                    <div className="relative w-full sm:w-64">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                        <Input
                                            placeholder="Cari riwayat..."
                                            value={globalFilter}
                                            onChange={(e) => setGlobalFilter(e.target.value)}
                                            className="pl-9 h-9"
                                        />
                                    </div>
                                </CardHeader>
                                <Separator />
                                <div className="relative overflow-hidden rounded-b-xl border-t">
                                    <div ref={parentRef} className="h-[500px] overflow-auto scrollbar-thin scrollbar-thumb-accent">
                                        <Table>
                                            <TableHeader className="sticky top-0 z-20 bg-muted/80 backdrop-blur-md">
                                                {table.getHeaderGroups().map((headerGroup) => (
                                                    <TableRow key={headerGroup.id} className="hover:bg-transparent border-b">
                                                        {headerGroup.headers.map((header) => (
                                                            <TableHead key={header.id} className="h-10 text-xs text-muted-foreground">
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
                                                            return (
                                                                <TableRow
                                                                    key={row.id}
                                                                    className="group hover:bg-muted/30 transition-colors h-10 border-b"
                                                                >
                                                                    {row.getVisibleCells().map((cell) => (
                                                                        <TableCell key={cell.id} className="py-2">
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
                                                        <TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground bg-muted/5">
                                                            No history for this period.
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </Card>
                        ) : !isFetching && (
                            <div className="flex flex-col items-center justify-center p-16 border-2 border-dashed border-muted rounded-xl bg-muted/10 opacity-60">
                                <CheckCircle2 className="h-10 w-10 text-muted-foreground/40 mb-3" />
                                <h3 className="font-medium text-muted-foreground">No History Data</h3>
                                <p className="text-xs text-muted-foreground mt-1">Data riwayat akan muncul di sini setelah item diproses.</p>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        </TooltipProvider>
    )
}
