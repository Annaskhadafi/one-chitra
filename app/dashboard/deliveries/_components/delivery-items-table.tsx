"use client"

import { useState, useMemo, useEffect } from "react"
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
import { DataTableFacetedFilter } from "@/app/dashboard/billing/_components/data-table-faceted-filter"
import { Search, CheckCircle, PackageSearch, PackageOpen, Download, ChevronUp, ChevronDown } from "lucide-react"
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    ColumnDef,
    flexRender,
    SortingState,
    PaginationState,
} from "@tanstack/react-table"
import type { getDeliveryItemsFlat } from "@/app/actions/delivery"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

type DeliveryItemFlat = Awaited<ReturnType<typeof getDeliveryItemsFlat>>[number]

interface DeliveryItemsTableProps {
    data: DeliveryItemFlat[]
}

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200, 300, 500, 1000]
const DEFAULT_PAGE_SIZE = 25

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline" | "success" | "warning"> = {
    scheduled: "secondary",
    delivered: "success",
    partial: "warning",
    cancelled: "destructive",
}

export function DeliveryItemsTable({ data }: DeliveryItemsTableProps) {
    const mounted = useMounted()
    const [globalFilter, setGlobalFilter] = useState("")
    const [statusFilter, setStatusFilter] = useState<string[]>([])
    const [categoryFilter, setCategoryFilter] = useState<string[]>([])
    const [customerFilter, setCustomerFilter] = useState<string[]>([])
    const [yearFilter, setYearFilter] = useState<string[]>([])
    const [monthFilter, setMonthFilter] = useState<string[]>([])
    const [sorting, setSorting] = useState<SortingState>([{ id: "deliveryNumber", desc: true }])
    const [pagination, setPagination] = useState<PaginationState>({
        pageIndex: 0,
        pageSize: DEFAULT_PAGE_SIZE,
    })

    // Stats calculation based on full data
    const totalItems = data.length
    const deliveredCount = data.filter(i => i.status === 'delivered').length
    const partialCount = data.filter(i => i.status === 'partial').length

    // Unique categories for filter
    const categories = useMemo(() => {
        const unique = new Set(data.map(i => i.productCategory).filter(Boolean))
        return Array.from(unique).sort()
    }, [data])

    const years = useMemo(() => {
        return Array.from(
            new Set(
                data
                    .map(i => {
                        const date = i.scheduledDate ? new Date(i.scheduledDate) : null
                        return date ? date.getFullYear().toString() : null
                    })
                    .filter((year): year is string => Boolean(year))
            )
        ).sort().reverse()
    }, [data])

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    const uniqueMonths = useMemo(() => {
        return Array.from(
            new Set(
                data
                    .map(i => {
                        const date = (i.deliveryDate || i.scheduledDate) ? new Date(i.deliveryDate || i.scheduledDate) : null
                        return date ? months[date.getMonth()] : null
                    })
                    .filter((month): month is string => Boolean(month))
            )
        )
    }, [data])

    const customers = useMemo(() => {
        return Array.from(
            new Set(data.map(i => i.customerName).filter((name): name is string => Boolean(name)))
        ).sort((a, b) => a.localeCompare(b))
    }, [data])

    const statuses = useMemo(() => {
        return Array.from(new Set(data.map(i => i.status).filter(Boolean))).sort()
    }, [data])

    const filteredData = useMemo(() => {
        return data.filter(item => {
            const dateValue = item.deliveryDate || item.scheduledDate
            const date = dateValue ? new Date(dateValue) : null
            const itemYear = date ? date.getFullYear().toString() : ""
            const itemMonth = date ? months[date.getMonth()] : ""

            const matchesStatus = statusFilter.length === 0 || statusFilter.includes(item.status)
            const matchesCategory = categoryFilter.length === 0 || categoryFilter.includes(item.productCategory)
            const matchesCustomer = customerFilter.length === 0 || customerFilter.includes(item.customerName || "")
            const matchesYear = yearFilter.length === 0 || yearFilter.includes(itemYear)
            const matchesMonth = monthFilter.length === 0 || monthFilter.includes(itemMonth)

            return matchesStatus && matchesCategory && matchesCustomer && matchesYear && matchesMonth
        })
    }, [data, statusFilter, categoryFilter, customerFilter, yearFilter, monthFilter])

    const columns = useMemo<ColumnDef<DeliveryItemFlat>[]>(() => [
        {
            id: "no",
            header: "No",
            cell: ({ row }) => <span className="text-muted-foreground">{row.index + 1}</span>,
            enableSorting: false,
        },
        {
            accessorKey: "productName",
            header: "Product Name",
            cell: ({ row }) => (
                <span className="font-medium text-slate-900 dark:text-slate-100">{row.original.productName}</span>
            ),
        },
        {
            accessorKey: "productNumber",
            header: "Material No.",
            cell: ({ row }) => (
                <span className="font-mono text-slate-700 dark:text-slate-300">{row.original.productNumber || "-"}</span>
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
        data: filteredData,
        columns,
        state: {
            sorting,
            globalFilter,
            pagination,
        },
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        onPaginationChange: setPagination,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
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
            return matchesSearch
        },
    })

    const rows = table.getRowModel().rows

    useEffect(() => {
        setPagination((prev) => ({ ...prev, pageIndex: 0 }))
    }, [globalFilter, statusFilter, categoryFilter, customerFilter, yearFilter, monthFilter])

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

            <div className="flex justify-end mb-2">
                <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Rows</span>
                    <Select
                        value={String(pagination.pageSize)}
                        onValueChange={(value) => table.setPageSize(Number(value))}
                    >
                        <SelectTrigger className="w-[90px] h-8">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {PAGE_SIZE_OPTIONS.map((size) => (
                                <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <span className="text-muted-foreground whitespace-nowrap">
                        Page {table.getState().pagination.pageIndex + 1} / {Math.max(1, table.getPageCount())}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        Prev
                    </Button>
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

            <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search product, DO, SO, customer..."
                            value={globalFilter ?? ""}
                            onChange={(e) => setGlobalFilter(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={handleExport} className="shrink-0">
                            <Download className="mr-2 h-4 w-4" />
                            <span className="hidden sm:inline">Export</span>
                        </Button>

                        <div className="hidden sm:flex flex-wrap items-center gap-2">
                            <DataTableFacetedFilter
                                title="Year"
                                options={years}
                                selectedValues={yearFilter}
                                onFilterChange={setYearFilter}
                            />
                            <DataTableFacetedFilter
                                title="Month"
                                options={uniqueMonths}
                                selectedValues={monthFilter}
                                onFilterChange={setMonthFilter}
                            />
                            <DataTableFacetedFilter
                                title="Category"
                                options={categories}
                                selectedValues={categoryFilter}
                                onFilterChange={setCategoryFilter}
                            />
                            <DataTableFacetedFilter
                                title="Customer"
                                options={customers}
                                selectedValues={customerFilter}
                                onFilterChange={setCustomerFilter}
                            />
                            <DataTableFacetedFilter
                                title="Status"
                                options={statuses}
                                selectedValues={statusFilter}
                                onFilterChange={setStatusFilter}
                            />
                        </div>
                    </div>
                </div>

                <div className="sm:hidden flex items-center gap-2 overflow-x-auto pb-1">
                    <DataTableFacetedFilter
                        title="Year"
                        options={years}
                        selectedValues={yearFilter}
                        onFilterChange={setYearFilter}
                    />
                    <DataTableFacetedFilter
                        title="Month"
                        options={uniqueMonths}
                        selectedValues={monthFilter}
                        onFilterChange={setMonthFilter}
                    />
                    <DataTableFacetedFilter
                        title="Category"
                        options={categories}
                        selectedValues={categoryFilter}
                        onFilterChange={setCategoryFilter}
                    />
                    <DataTableFacetedFilter
                        title="Customer"
                        options={customers}
                        selectedValues={customerFilter}
                        onFilterChange={setCustomerFilter}
                    />
                    <DataTableFacetedFilter
                        title="Status"
                        options={statuses}
                        selectedValues={statusFilter}
                        onFilterChange={setStatusFilter}
                    />
                </div>
            </div>

            <div className="rounded-md border bg-card shadow-sm">
                <div
                    className="overflow-x-auto relative scrollbar-thin scrollbar-thumb-accent"
                >
                    <Table>
                        <TableHeader className="bg-background shadow-sm">
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => (
                                        <TableHead key={header.id} className="sticky top-[var(--header-height)] z-[60] bg-background shadow-[inset_0_-1px_0_hsl(var(--border))] font-semibold text-slate-700 dark:text-slate-300">
                                            {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            {rows.length > 0 ? (
                                rows.map((row) => (
                                    <TableRow key={row.id} className="hover:bg-muted/50 transition-colors group">
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell key={cell.id} className="py-3">
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={table.getVisibleFlatColumns().length} className="h-40 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
                                        <PackageSearch className="h-8 w-8 text-muted-foreground/50" />
                                        No delivery items found based on your filters.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm">
                <div className="text-muted-foreground">
                    Showing {table.getRowModel().rows.length} of {table.getFilteredRowModel().rows.length} records
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Rows</span>
                    <Select
                        value={String(pagination.pageSize)}
                        onValueChange={(value) => table.setPageSize(Number(value))}
                    >
                        <SelectTrigger className="w-[90px] h-8">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {PAGE_SIZE_OPTIONS.map((size) => (
                                <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <span className="text-muted-foreground whitespace-nowrap">
                        Page {table.getState().pagination.pageIndex + 1} / {Math.max(1, table.getPageCount())}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        Prev
                    </Button>
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
        </div>
    )
} 
