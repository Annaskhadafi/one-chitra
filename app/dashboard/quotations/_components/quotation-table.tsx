"use client"

import { useState, useMemo, useRef } from "react"
import { deleteQuotation, bulkDeleteQuotations, getQuotations } from "@/app/actions/quotation"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
import { Search, Pencil, Trash2, Eye, FileText, Clock, CheckCircle, XCircle, ArrowRightLeft, Send, User, ChevronUp, ChevronDown, Loader2 } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import type { Customer, Product } from "@/lib/types"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"
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

interface QuotationWithRelations {
    id: number
    quotationNumber: string | null
    customerId: number
    quotationDate: Date
    validUntil: Date | null
    subject: string | null
    status: string
    discount: string
    tax: string
    shipping: string
    salesOrderId: number | null
    createdAt: Date
    customer: Customer
    createdByUser: { id: string; name: string; email: string } | null
    items: {
        id: number
        productId: number
        quantity: number
        unitPrice: string
        discount: string
        tax: string
        product: Product
    }[]
}

interface QuotationTableProps {
    data: QuotationWithRelations[]
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    draft: "secondary",
    sent: "outline",
    approved: "default",
    rejected: "destructive",
    expired: "secondary",
    converted: "default",
}

const statusIcons: Record<string, React.ElementType> = {
    draft: FileText,
    sent: Send,
    approved: CheckCircle,
    rejected: XCircle,
    expired: Clock,
    converted: ArrowRightLeft,
}

const STATUS_COLORS: Record<string, string> = {
    draft: "hsl(217, 91%, 60%)",
    sent: "hsl(43, 96%, 56%)",
    approved: "hsl(160, 84%, 39%)",
    rejected: "hsl(346, 77%, 49%)",
    expired: "hsl(220, 9%, 46%)",
    converted: "hsl(270, 76%, 53%)",
}

function formatCurrency(value: number) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(value)
}

function calculateGrandTotal(quotation: QuotationWithRelations) {
    const itemsTotal = quotation.items.reduce((sum, item) => {
        return sum + (item.quantity * Number(item.unitPrice) - Number(item.discount) + Number(item.tax))
    }, 0)
    return itemsTotal - Number(quotation.discount) + Number(quotation.tax) + Number(quotation.shipping)
}

function formatDate(date: Date) {
    return new Date(date).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    })
}

export function QuotationTable({ data: initialData }: QuotationTableProps) {
    const { data: quotations = initialData, isLoading, refetch } = useQuery({
        queryKey: ["quotations"],
        queryFn: async () => {
            const result = await getQuotations()
            return result as QuotationWithRelations[]
        },
        initialData,
        staleTime: 60 * 1000,
    })

    const [sorting, setSorting] = useState<SortingState>([{ id: "quotationDate", desc: true }])
    const [globalFilter, setGlobalFilter] = useState("")
    const [statusFilter, setStatusFilter] = useState("all")
    const [rowSelection, setRowSelection] = useState({})

    // Chart data: status breakdown
    const chartData = useMemo(() => {
        const statusCounts: Record<string, number> = {}
        quotations.forEach(q => {
            statusCounts[q.status] = (statusCounts[q.status] || 0) + 1
        })
        return Object.entries(statusCounts).map(([status, count]) => ({
            status: status.charAt(0).toUpperCase() + status.slice(1),
            count,
            fill: STATUS_COLORS[status] || "hsl(var(--primary))",
        }))
    }, [quotations])

    const columns = useMemo<ColumnDef<QuotationWithRelations>[]>(() => [
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
                    aria-label="Select row"
                />
            ),
            enableSorting: false,
            enableHiding: false,
        },
        {
            accessorKey: "quotationNumber",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4 h-8">
                    QT Number
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
            cell: ({ row }) => (
                <Link
                    href={`/dashboard/quotations/${row.original.id}`}
                    className="font-mono text-sm font-medium text-primary hover:underline"
                >
                    {row.original.quotationNumber}
                </Link>
            ),
        },
        {
            accessorKey: "customer.name",
            header: "Customer",
            cell: ({ row }) => (
                <div>
                    <p className="font-medium">{row.original.customer.name}</p>
                    <p className="text-xs text-muted-foreground">{row.original.customer.customerCode}</p>
                </div>
            ),
        },
        {
            accessorKey: "subject",
            header: "Subject",
            cell: ({ row }) => <div className="max-w-[200px] truncate text-sm text-muted-foreground">{row.original.subject || "-"}</div>,
        },
        {
            accessorKey: "quotationDate",
            header: "Date",
            cell: ({ row }) => <div className="text-sm">{formatDate(row.original.quotationDate)}</div>,
        },
        {
            accessorKey: "validUntil",
            header: "Valid Until",
            cell: ({ row }) => {
                const q = row.original
                const isExpired = q.validUntil && new Date(q.validUntil) < new Date() && q.status !== "converted" && q.status !== "approved"
                return (
                    <div className="text-sm">
                        {q.validUntil ? (
                            <span className={isExpired ? "text-destructive font-medium" : ""}>
                                {formatDate(q.validUntil)}
                                {isExpired && " (Expired)"}
                            </span>
                        ) : "-"}
                    </div>
                )
            },
        },
        {
            id: "grandTotal",
            header: "Grand Total",
            cell: ({ row }) => <div className="font-medium">{formatCurrency(calculateGrandTotal(row.original))}</div>,
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => {
                const status = row.original.status
                const StatusIcon = statusIcons[status] || FileText
                return (
                    <Badge variant={statusVariants[status] || "secondary"} className="gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                    </Badge>
                )
            },
        },
        {
            accessorKey: "createdByUser.name",
            header: "Created By",
            cell: ({ row }) => (
                <div className="flex items-center gap-1.5 text-sm">
                    {row.original.createdByUser ? (
                        <>
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span>{row.original.createdByUser.name}</span>
                        </>
                    ) : "-"}
                </div>
            ),
        },
        {
            id: "actions",
            header: () => <div className="text-right">Actions</div>,
            cell: ({ row }) => (
                <div className="flex justify-end items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link href={`/dashboard/quotations/${row.original.id}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Eye className="h-3.5 w-3.5" />
                        </Button>
                    </Link>
                    <Link href={`/dashboard/quotations/${row.original.id}/edit`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Pencil className="h-3.5 w-3.5" />
                        </Button>
                    </Link>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Delete quotation?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will permanently delete quotation {row.original.quotationNumber} and all its items.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={async () => {
                                        const result = await deleteQuotation(row.original.id)
                                        if (result.success) {
                                            toast.success("Quotation deleted")
                                            refetch()
                                        } else {
                                            toast.error(result.error || "Failed to delete")
                                        }
                                    }}
                                >
                                    Delete
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            ),
        },
    ], [refetch])

    const table = useReactTable({
        data: quotations,
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
            const q = row.original

            const matchesSearch = !!(
                q.quotationNumber?.toLowerCase().includes(term) ||
                q.customer.name.toLowerCase().includes(term) ||
                q.subject?.toLowerCase().includes(term) ||
                q.createdByUser?.name?.toLowerCase().includes(term)
            )

            const matchesStatus = statusFilter === "all" || q.status === statusFilter
            return matchesSearch && matchesStatus
        },
    })

    const selectedIds = useMemo(() =>
        Object.keys(rowSelection).map(id => parseInt(id)),
        [rowSelection]
    )

    const handleBulkDelete = async () => {
        try {
            const result = await bulkDeleteQuotations(selectedIds)
            if (result.success) {
                toast.success(`${selectedIds.length} quotations deleted`)
                setRowSelection({})
                refetch()
            } else {
                toast.error(result.error || "Failed to delete")
            }
        } catch {
            toast.error("Failed to delete quotations")
        }
    }

    // Virtualization
    const parentRef = useRef<HTMLDivElement>(null)
    const { rows } = table.getRowModel()

    const rowVirtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 64,
        overscan: 20,
    })

    const [before, after] = rowVirtualizer.getVirtualItems().length > 0
        ? [
            rowVirtualizer.getVirtualItems()[0].start,
            rowVirtualizer.getTotalSize() - rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1].end,
        ]
        : [0, 0]

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading quotations...</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Status Chart */}
            {quotations.length > 0 && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Quotation Status Overview</CardTitle>
                        <CardDescription>{quotations.length} total quotations</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                                <XAxis type="number" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                                <YAxis dataKey="status" type="category" width={80} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "hsl(var(--card))",
                                        border: "1px solid hsl(var(--border))",
                                        borderRadius: "8px",
                                        color: "hsl(var(--foreground))",
                                    }}
                                />
                                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by QT number, customer, subject, or user..."
                        value={globalFilter ?? ""}
                        onChange={(e) => setGlobalFilter(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <Select value={statusFilter} onValueChange={(val) => {
                    setStatusFilter(val)
                    // Trigger table filter update
                    table.setGlobalFilter(globalFilter)
                }}>
                    <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="sent">Sent</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                        <SelectItem value="converted">Converted</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Bulk Actions */}
            {selectedIds.length > 0 && (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
                    <span className="text-sm font-medium">{selectedIds.length} selected</span>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                                <Trash2 className="mr-2 h-3 w-3" />
                                Delete Selected
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Delete {selectedIds.length} quotations?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action cannot be undone. All selected quotations and their items will be permanently deleted.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleBulkDelete}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            )}

            {/* Table */}
            <div className="rounded-lg border overflow-hidden bg-card">
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
                                    <TableCell colSpan={columns.length} className="h-32 text-center">
                                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                            <FileText className="h-10 w-10 opacity-30" />
                                            <p>No quotations found</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Footer Info */}
            <div className="text-sm text-muted-foreground">
                Showing {table.getFilteredRowModel().rows.length} of {quotations.length} quotations
            </div>
        </div>
    )
}
