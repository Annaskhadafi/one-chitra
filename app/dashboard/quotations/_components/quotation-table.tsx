"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { deleteQuotation, bulkDeleteQuotations, getQuotations, duplicateQuotation, updateQuotationStatus, bulkUpdateQuotationStatus } from "@/app/actions/quotation"
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
import { Search, Pencil, Trash2, Eye, FileText, Clock, CheckCircle, XCircle, ArrowRightLeft, Send, User, ChevronUp, ChevronDown, Loader2, Copy, Calendar, Filter, ShoppingCart } from "lucide-react"
import { ScoreCard } from "@/components/score-card"
import { BulkActions } from "@/components/bulk-actions"
import { usePermissions } from "@/hooks/use-permissions"
import { toast } from "sonner"
import Link from "next/link"
import type { Customer, Product } from "@/lib/types"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { useQuery } from "@tanstack/react-query"
import { useSession } from "@/lib/auth-client"
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
import { QuotationPdfPreview } from "./quotation-pdf-preview"

interface QuotationWithRelations {
    id: number
    quotationNumber: string | null
    customerId: number
    quotationDate: Date
    closingStatus: string | null
    subject: string | null
    status: string
    discount: string
    tax: string
    shipping: string
    salesOrderId: number | null
    createdBy: string
    createdAt: Date
    customer: Customer
    tags: string | null
    currency: string
    referenceNumber: string | null
    adminNote: string | null
    clientNote: string | null
    paymentTerms: string | null
    termsConditions: string | null
    notes: string | null
    salesPersonId: string | null
    validUntil: Date | null
    attn: string | null
    address: string | null
    discountType: string
    salesPerson: { id: string; name: string; email: string } | null
    createdByUser: { id: string; name: string; email: string } | null
    items: {
        id: number
        productId: number | null
        description: string | null
        longDescription: string | null
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
    const { data: session } = useSession()
    const currentUserId = session?.user?.id

    const { data: quotations = initialData, isLoading, refetch } = useQuery({
        queryKey: ["quotations"],
        queryFn: async () => {
            const result = await getQuotations()
            return result as QuotationWithRelations[]
        },
        initialData,
        staleTime: 60 * 1000,
    })

    const { hasResourcePermission } = usePermissions()
    const canEdit = hasResourcePermission('quotations', 'edit')
    const canDelete = hasResourcePermission('quotations', 'delete')
    const canView = hasResourcePermission('quotations', 'view')

    const [sorting, setSorting] = useState<SortingState>([{ id: "quotationDate", desc: true }])
    const [globalFilter, setGlobalFilter] = useState("")
    const [statusFilter, setStatusFilter] = useState("all")
    const [userFilter, setUserFilter] = useState("all")

    // Set default user filter to current user once session is loaded
    useEffect(() => {
        if (currentUserId) {
            setUserFilter(currentUserId)
        }
    }, [currentUserId])

    const [monthFilter, setMonthFilter] = useState("all")
    const [yearFilter, setYearFilter] = useState("all")
    const [rowSelection, setRowSelection] = useState({})
    const [previewQuotation, setPreviewQuotation] = useState<QuotationWithRelations | null>(null)
    const [isPreviewOpen, setIsPreviewOpen] = useState(false)
    const [isDuplicating, setIsDuplicating] = useState<number | null>(null)

    // Extract unique users for filter
    const uniqueUsers = useMemo(() => {
        const users = new Map<string, string>()
        quotations.forEach(q => {
            if (q.createdByUser) {
                users.set(q.createdByUser.id, q.createdByUser.name)
            }
        })
        return Array.from(users.entries()).map(([id, name]) => ({ id, name }))
    }, [quotations])

    // Generate years for filter
    const availableYears = useMemo(() => {
        const years = new Set<string>()
        quotations.forEach(q => {
            years.add(new Date(q.quotationDate).getFullYear().toString())
        })
        return Array.from(years).sort((a, b) => b.localeCompare(a))
    }, [quotations])

    const months = [
        { value: "0", label: "January" },
        { value: "1", label: "February" },
        { value: "2", label: "March" },
        { value: "3", label: "April" },
        { value: "4", label: "May" },
        { value: "5", label: "June" },
        { value: "6", label: "July" },
        { value: "7", label: "August" },
        { value: "8", label: "September" },
        { value: "9", label: "October" },
        { value: "10", label: "November" },
        { value: "11", label: "December" },
    ]

    // Scorecard data
    const stats = useMemo(() => {
        const total = quotations.length
        const totalValue = quotations.reduce((sum, q) => sum + calculateGrandTotal(q), 0)
        const approved = quotations.filter(q => q.status === "approved").length
        const approvedValue = quotations.filter(q => q.status === "approved").reduce((sum, q) => sum + calculateGrandTotal(q), 0)
        const sent = quotations.filter(q => q.status === "sent").length
        const converted = quotations.filter(q => q.status === "converted").length

        return {
            total,
            totalValue,
            approved,
            approvedValue,
            sent,
            converted
        }
    }, [quotations])

    // Filtered data for charts
    const filteredForCharts = useMemo(() => {
        return quotations.filter(q => {
            const date = new Date(q.quotationDate)
            const matchesStatus = statusFilter === "all" || q.status === statusFilter
            const matchesUser = userFilter === "all" || q.createdBy === userFilter
            const matchesMonth = monthFilter === "all" || date.getMonth().toString() === monthFilter
            const matchesYear = yearFilter === "all" || date.getFullYear().toString() === yearFilter
            return matchesStatus && matchesUser && matchesMonth && matchesYear
        })
    }, [quotations, statusFilter, userFilter, monthFilter, yearFilter])

    // Chart data: status breakdown
    const chartData = useMemo(() => {
        const statusCounts: Record<string, number> = {}
        filteredForCharts.forEach(q => {
            statusCounts[q.status] = (statusCounts[q.status] || 0) + 1
        })
        return Object.entries(statusCounts).map(([status, count]) => ({
            status: status.charAt(0).toUpperCase() + status.slice(1),
            count,
            fill: STATUS_COLORS[status] || "hsl(var(--primary))",
        }))
    }, [filteredForCharts])

    // Chart data: Monthly trend
    const monthlyTrendData = useMemo(() => {
        const monthlyData: Record<string, { month: string; value: number }> = {}
        const last6Months = Array.from({ length: 6 }).map((_, i) => {
            const d = new Date()
            d.setMonth(d.getMonth() - i)
            return {
                key: `${d.getFullYear()}-${d.getMonth()}`,
                label: d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" })
            }
        }).reverse()

        last6Months.forEach(m => {
            monthlyData[m.key] = { month: m.label, value: 0 }
        })

        quotations.forEach(q => {
            const date = new Date(q.quotationDate)
            const key = `${date.getFullYear()}-${date.getMonth()}`
            if (monthlyData[key]) {
                monthlyData[key].value += calculateGrandTotal(q)
            }
        })

        return Object.values(monthlyData)
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
                <button
                    onClick={() => {
                        setPreviewQuotation(row.original)
                        setIsPreviewOpen(true)
                    }}
                    className="font-mono text-sm font-medium text-primary hover:underline bg-transparent border-none p-0 cursor-pointer text-left"
                >
                    {row.original.quotationNumber}
                </button>
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
                const id = row.original.id
                return canEdit ? (
                    <Select
                        defaultValue={status}
                        onValueChange={async (value) => {
                            const result = await updateQuotationStatus(id, value)
                            if (result.success) {
                                toast.success("Status updated")
                                refetch()
                            } else {
                                toast.error(result.error || "Failed to update status")
                            }
                        }}
                    >
                        <SelectTrigger className={`h-8 w-[120px] text-xs font-medium border-none shadow-none focus:ring-0 ${statusVariants[status] === 'default' ? 'bg-primary text-primary-foreground' :
                            statusVariants[status] === 'secondary' ? 'bg-secondary text-secondary-foreground' :
                                statusVariants[status] === 'destructive' ? 'bg-destructive text-destructive-foreground' : 'bg-outline'
                            }`}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="sent">Sent</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                            <SelectItem value="expired">Expired</SelectItem>
                            <SelectItem value="converted">Converted</SelectItem>
                        </SelectContent>
                    </Select>
                ) : (
                    <Badge variant={statusVariants[status] || "secondary"} className="gap-1">
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
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-blue-500 hover:text-blue-600"
                        disabled={isDuplicating === row.original.id}
                        onClick={async () => {
                            setIsDuplicating(row.original.id)
                            try {
                                const result = await duplicateQuotation(row.original.id)
                                if (result.success) {
                                    toast.success("Quotation duplicated")
                                    refetch()
                                } else {
                                    toast.error(result.error || "Failed to duplicate")
                                }
                            } catch {
                                toast.error("An error occurred while duplicating")
                            } finally {
                                setIsDuplicating(null)
                            }
                        }}
                    >
                        {isDuplicating === row.original.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Copy className="h-3.5 w-3.5" />
                        )}
                    </Button>
                    {canDelete && row.original.createdBy === currentUserId && (
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
                    )}
                </div >
            ),
        },
    ], [refetch, isDuplicating])

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

            const date = new Date(q.quotationDate)
            const matchesStatus = statusFilter === "all" || q.status === statusFilter
            const matchesUser = userFilter === "all" || q.createdBy === userFilter
            const matchesMonth = monthFilter === "all" || date.getMonth().toString() === monthFilter
            const matchesYear = yearFilter === "all" || date.getFullYear().toString() === yearFilter

            return matchesSearch && matchesStatus && matchesUser && matchesMonth && matchesYear
        },
    })

    const selectedIds = useMemo(() =>
        Object.keys(rowSelection).map(id => parseInt(id)),
        [rowSelection]
    )

    const handleBulkStatusUpdate = async () => {
        const status = prompt("Enter new status (draft/sent/approved/rejected/expired/converted):")
        if (status) {
            const result = await bulkUpdateQuotationStatus(selectedIds, status)
            if (result.success) {
                toast.success("Statuses updated")
                setRowSelection({})
                refetch()
            } else {
                toast.error(result.error || "Failed to update statuses")
            }
        }
    }

    const handleBulkDelete = async () => {
        // Only allow deleting quotations owned by the current user
        const ownedIds = quotations
            .filter(q => selectedIds.includes(q.id) && q.createdBy === currentUserId)
            .map(q => q.id)

        if (ownedIds.length === 0) {
            toast.error("You can only delete quotations you created")
            return
        }

        if (ownedIds.length < selectedIds.length) {
            if (!confirm(`You only have permission to delete ${ownedIds.length} of the ${selectedIds.length} selected quotations. Proceed?`)) {
                return
            }
        }

        try {
            const result = await bulkDeleteQuotations(ownedIds)
            if (result.success) {
                toast.success(`${ownedIds.length} quotations deleted`)
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

    // Use effect to handle filter changes correctly with TanStack table
    useEffect(() => {
        table.setGlobalFilter(globalFilter)
    }, [statusFilter, userFilter, monthFilter, yearFilter, globalFilter, table])

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
            {/* Scorecards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <ScoreCard
                    title="Total Quotations"
                    value={stats.total}
                    icon={FileText}
                    description="Total created quotations"
                    gradient="from-blue-500/10 via-blue-400/5 to-indigo-500/10 border-blue-200/50"
                />
                <ScoreCard
                    title="Total Value"
                    value={formatCurrency(stats.totalValue)}
                    icon={ShoppingCart}
                    description="Total potential value"
                    gradient="from-amber-500/10 via-amber-400/5 to-orange-500/10 border-amber-200/50"
                />
                <ScoreCard
                    title="Approved"
                    value={stats.approved}
                    icon={CheckCircle}
                    description={`Value: ${formatCurrency(stats.approvedValue)}`}
                    gradient="from-emerald-500/10 via-emerald-400/5 to-teal-500/10 border-emerald-200/50"
                />
                <ScoreCard
                    title="Conversion Rate"
                    value={`${stats.total > 0 ? Math.round((stats.converted / stats.total) * 100) : 0}%`}
                    icon={ArrowRightLeft}
                    description={`${stats.converted} converted to SO`}
                    gradient="from-purple-500/10 via-purple-400/5 to-pink-500/10 border-purple-200/50"
                />
            </div>

            {/* Charts */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Filter className="h-4 w-4" />
                            Status Distribution
                        </CardTitle>
                        <CardDescription>Breakdown by current status</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                                <XAxis type="number" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                                <YAxis dataKey="status" type="category" width={80} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "hsl(var(--card))",
                                        border: "1px solid hsl(var(--border))",
                                        borderRadius: "8px",
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

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Monthly Value Trend
                        </CardTitle>
                        <CardDescription>Total value over last 6 months</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={monthlyTrendData}>
                                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                                <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(val) => `Rp${val / 1000000}M`} />
                                <Tooltip
                                    formatter={(value: number) => formatCurrency(value)}
                                    contentStyle={{
                                        backgroundColor: "hsl(var(--card))",
                                        border: "1px solid hsl(var(--border))",
                                        borderRadius: "8px",
                                    }}
                                />
                                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 p-4 bg-muted/30 rounded-lg border">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search QT number, customer, subject..."
                        value={globalFilter ?? ""}
                        onChange={(e) => setGlobalFilter(e.target.value)}
                        className="pl-9 h-9"
                    />
                </div>

                <div className="flex flex-wrap gap-2">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[130px] h-9">
                            <div className="flex items-center gap-2">
                                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                                <SelectValue placeholder="Status" />
                            </div>
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

                    <Select value={userFilter} onValueChange={setUserFilter}>
                        <SelectTrigger className="w-fit min-w-[150px] h-9 gap-3">
                            <div className="flex items-center gap-2">
                                <User className="h-3.5 w-3.5 text-muted-foreground" />
                                <SelectValue placeholder="Created By" />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Users</SelectItem>
                            {uniqueUsers.map(u => (
                                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={monthFilter} onValueChange={setMonthFilter}>
                        <SelectTrigger className="w-[130px] h-9">
                            <div className="flex items-center gap-2">
                                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                <SelectValue placeholder="Month" />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Months</SelectItem>
                            {months.map(m => (
                                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={yearFilter} onValueChange={setYearFilter}>
                        <SelectTrigger className="w-[110px] h-9">
                            <div className="flex items-center gap-2">
                                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                <SelectValue placeholder="Year" />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Years</SelectItem>
                            {availableYears.map(y => (
                                <SelectItem key={y} value={y}>{y}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {(statusFilter !== "all" || userFilter !== "all" || monthFilter !== "all" || yearFilter !== "all" || globalFilter !== "") && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setStatusFilter("all")
                                setUserFilter("all")
                                setMonthFilter("all")
                                setYearFilter("all")
                                setGlobalFilter("")
                            }}
                            className="h-9 text-xs"
                        >
                            Reset
                        </Button>
                    )}
                </div>
            </div>

            {/* Bulk Actions */}
            {selectedIds.length > 0 && (
                <BulkActions
                    selectedCount={selectedIds.length}
                    onDelete={handleBulkDelete}
                    onEdit={handleBulkStatusUpdate}
                    entityName="quotation"
                />
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

            {previewQuotation && (
                <QuotationPdfPreview
                    quotation={previewQuotation as any}
                    open={isPreviewOpen}
                    onClose={() => setIsPreviewOpen(false)}
                />
            )}
        </div>
    )
}
