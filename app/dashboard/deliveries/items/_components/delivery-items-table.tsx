"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { useMounted } from "@/hooks/use-mounted"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScoreCard } from "@/components/score-card"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Search, CheckCircle, PackageSearch, PackageOpen, Download, ChevronUp, ChevronDown } from "lucide-react"
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
import type { getDeliveryItemsFlat } from "@/app/actions/delivery"

type DeliveryItemFlat = Awaited<ReturnType<typeof getDeliveryItemsFlat>>[number]

interface DeliveryItemsTableProps {
    data: DeliveryItemFlat[]
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline" | "success" | "warning"> = {
    scheduled: "secondary",
    delivered: "success",
    partial: "warning",
    cancelled: "destructive",
}

export function DeliveryItemsTable({ data }: DeliveryItemsTableProps) {
    const mounted = useMounted()
    const [globalFilter, setGlobalFilter] = useState("")
    const [statusFilter, setStatusFilter] = useState("all")
    const [categoryFilter, setCategoryFilter] = useState("all")
    const [sorting, setSorting] = useState<SortingState>([{ id: "deliveryNumber", desc: true }])

    // Stats calculation based on full data
    const totalItems = data.length
    const deliveredCount = data.filter(i => i.status === 'delivered').length
    const partialCount = data.filter(i => i.status === 'partial').length

    // Unique categories for filter
    const categories = useMemo(() => {
        const unique = new Set(data.map(i => i.productCategory).filter(Boolean))
        return Array.from(unique).sort()
    }, [data])

    const columns = useMemo<ColumnDef<DeliveryItemFlat>[]>(() => [
        {
            id: "no",
            header: "No",
            cell: ({ row }) => <span className="text-muted-foreground">{row.index + 1}</span>,
            enableSorting: false,
        },
        {
            accessorKey: "productName",
            header: "Product",
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-medium text-slate-900 dark:text-slate-100">{row.original.productName}</span>
                    <span className="text-xs text-muted-foreground font-mono">{row.original.productNumber}</span>
                </div>
            ),
        },
        {
            accessorKey: "productCategory",
            header: "Category",
            cell: ({ row }) => (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800">
                    {row.original.productCategory}
                </Badge>
            ),
        },
        {
            accessorKey: "customerName",
            header: "Customer",
            cell: ({ row }) => <span className="font-medium">{row.original.customerName || "-"}</span>,
        },
        {
            accessorKey: "oldMaterialNo",
            header: "Old Material No.",
            cell: ({ row }) => row.original.oldMaterialNo || "-",
        },
        {
            accessorKey: "customerPo",
            header: "No PO Customer",
            cell: ({ row }) => row.original.customerPo || "-",
        },
        {
            accessorKey: "deliveryNumber",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4 h-8">
                    No DO
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
            cell: ({ row }) => <span className="font-mono text-purple-600 dark:text-purple-400 font-medium">{row.original.deliveryNumber || "-"}</span>,
        },
        {
            accessorKey: "invoiceNumber",
            header: "No SO Internal",
            cell: ({ row }) => <span className="font-mono text-blue-600 dark:text-blue-400 font-medium">{row.original.invoiceNumber || "-"}</span>,
        },
        {
            accessorKey: "deliveryDate",
            header: "Tgl Kirim / Actual",
            cell: ({ row }) => {
                const date = row.original.deliveryDate || row.original.scheduledDate
                return date ? new Date(date).toLocaleDateString("id-ID", {
                    day: "2-digit", month: "2-digit", year: "numeric",
                }) : "-"
            },
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => {
                const status = row.original.status
                if (!mounted) return <Badge variant={statusVariants[status]}>{status}</Badge>
                return (
                    <Badge variant={statusVariants[status] || "secondary"} className="capitalize">
                        {status}
                    </Badge>
                )
            },
        },
        {
            id: "quantities",
            header: "Qty",
            cell: ({ row }) => (
                <div className="flex gap-2 text-sm">
                    <span className="font-medium text-emerald-600" title="Delivered">{row.original.deliveredQuantity}</span>
                    <span className="text-muted-foreground">/</span>
                    <span className="text-slate-500" title="Ordered">{row.original.orderedQuantity}</span>
                </div>
            )
        },
        {
            accessorKey: "driverName",
            header: "Driver / Vendor",
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="text-sm">{row.original.isExternal ? row.original.vendorName : row.original.driverName || "-"}</span>
                    {row.original.vehicleNumber && (
                        <span className="text-xs text-muted-foreground uppercase">{row.original.vehicleNumber}</span>
                    )}
                </div>
            )
        }
    ], [mounted])

    const table = useReactTable({
        data,
        columns,
        state: {
            sorting,
            globalFilter,
        },
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        globalFilterFn: (row, columnId, filterValue) => {
            const term = filterValue.toLowerCase()
            const item = row.original
            const matchesSearch =
                item.productName.toLowerCase().includes(term) ||
                item.productNumber.toLowerCase().includes(term) ||
                item.oldMaterialNo?.toLowerCase().includes(term) ||
                item.deliveryNumber?.toLowerCase().includes(term) ||
                item.invoiceNumber?.toLowerCase().includes(term) ||
                item.customerPo?.toLowerCase().includes(term) ||
                item.customerName?.toLowerCase().includes(term)

            const matchesStatus = statusFilter === "all" || item.status === statusFilter
            const matchesCategory = categoryFilter === "all" || item.productCategory === categoryFilter

            return matchesSearch && matchesStatus && matchesCategory
        },
    })

    // Virtualization setup
    const parentRef = useRef<HTMLDivElement>(null)
    const { rows } = table.getRowModel()

    const rowVirtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 65, // slightly taller for double-line rows
        overscan: 20,
    })

    const [before, after] = rowVirtualizer.getVirtualItems().length > 0
        ? [
            rowVirtualizer.getVirtualItems()[0].start,
            rowVirtualizer.getTotalSize() - rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1].end,
        ]
        : [0, 0]

    const handleExport = () => {
        const headers = ["Product Name", "Product No", "Old Material No", "Category", "Customer", "PO Customer", "Delivery No (DO)", "SO Internal", "Delivery Date", "Status", "Qty Delivered", "Qty Ordered", "Driver/Vendor", "Vehicle", "Warehouse"]
        const csvData = table.getFilteredRowModel().rows.map(row => {
            const item = row.original
            const date = item.deliveryDate || item.scheduledDate
            return [
                `"${item.productName.replace(/"/g, '""')}"`,
                item.productNumber,
                item.oldMaterialNo || "",
                item.productCategory,
                `"${item.customerName || ""}"`,
                item.customerPo || "",
                item.deliveryNumber || "",
                item.invoiceNumber || "",
                date ? new Date(date).toLocaleDateString("id-ID") : "",
                item.status,
                item.deliveredQuantity,
                item.orderedQuantity,
                `"${item.isExternal ? (item.vendorName || "") : (item.driverName || "")}"`,
                item.vehicleNumber || "",
                `"${item.warehouseName || ""}"`
            ]
        })

        const csvContent = [headers.join(","), ...csvData.map(row => row.join(","))].join("\n")
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
        const link = document.createElement("a")
        const url = URL.createObjectURL(blob)
        link.setAttribute("href", url)
        link.setAttribute("download", `delivery-items-${new Date().toISOString().slice(0, 10)}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    // Effect to trigger filtration when dropdowns change
    useEffect(() => {
        table.setGlobalFilter(globalFilter)
    }, [statusFilter, categoryFilter, globalFilter, table])

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
                <ScoreCard
                    title="Total Items Delivered"
                    value={totalItems}
                    icon={PackageSearch}
                    description="Total individual product lines"
                    gradient="from-blue-500/10 via-blue-400/5 to-indigo-500/10 border-blue-200/50 dark:from-blue-500/20 dark:border-blue-500/30"
                    iconColor="text-blue-600 dark:text-blue-400"
                    textColor="text-blue-900 dark:text-blue-100"
                />
                <ScoreCard
                    title="Fully Delivered"
                    value={deliveredCount}
                    icon={CheckCircle}
                    description="Lines fully delivered"
                    gradient="from-emerald-500/10 via-emerald-400/5 to-teal-500/10 border-emerald-200/50 dark:from-emerald-500/20 dark:border-emerald-500/30"
                    iconColor="text-emerald-600 dark:text-emerald-400"
                    textColor="text-emerald-900 dark:text-emerald-100"
                />
                <ScoreCard
                    title="Partially Delivered"
                    value={partialCount}
                    icon={PackageOpen}
                    description="Incomplete delivery lines"
                    gradient="from-amber-500/10 via-amber-400/5 to-orange-500/10 border-amber-200/50 dark:from-amber-500/20 dark:border-amber-500/30"
                    iconColor="text-amber-600 dark:text-amber-400"
                    textColor="text-amber-900 dark:text-amber-100"
                />
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-card p-3 rounded-md border shadow-sm">
                <div className="relative w-full sm:w-80">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search product, DO, SO, customer..."
                        className="pl-8 bg-background"
                        value={globalFilter ?? ""}
                        onChange={(e) => setGlobalFilter(e.target.value)}
                    />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" onClick={handleExport} className="bg-background">
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV
                    </Button>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger className="w-[140px] bg-background">
                            <SelectValue placeholder="All Categories" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Categories</SelectItem>
                            {categories.map(cat => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[140px] bg-background">
                            <SelectValue placeholder="All Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="scheduled">Scheduled</SelectItem>
                            <SelectItem value="partial">Partial</SelectItem>
                            <SelectItem value="delivered">Delivered</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="rounded-md border bg-card overflow-hidden shadow-sm">
                <div ref={parentRef} className="overflow-auto h-[600px] relative scrollbar-thin scrollbar-thumb-accent">
                    <Table>
                        <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10 shadow-sm">
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => (
                                        <TableHead key={header.id} className="font-semibold text-slate-700 dark:text-slate-300">
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
                                        <TableCell colSpan={table.getVisibleFlatColumns().length} className="p-0" />
                                    </TableRow>
                                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                        const row = rows[virtualRow.index]
                                        return (
                                            <TableRow key={row.id} className="hover:bg-muted/50 transition-colors group">
                                                {row.getVisibleCells().map((cell) => (
                                                    <TableCell key={cell.id} className="py-3">
                                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                    </TableCell>
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
                                    <TableCell colSpan={columns.length} className="h-40 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
                                        <PackageSearch className="h-8 w-8 text-muted-foreground/50" />
                                        No delivery items found based on your filters.
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
