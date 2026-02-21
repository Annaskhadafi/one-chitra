"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { EditDoDialog } from "./edit-do-dialog"
import { deleteDelivery, updateDoMonitoringFields, getDeliveries } from "@/app/actions/delivery"
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { Search, MoreHorizontal, FileEdit, Trash2, Eye, Download, ChevronUp, ChevronDown } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { usePermissions } from "@/hooks/use-permissions"
import { useQuery, useQueryClient } from "@tanstack/react-query"
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

export function DoMonitoringTable({ data: initialData }: { data: any[] }) {
    const queryClient = useQueryClient()
    const { data = initialData } = useQuery({
        queryKey: ["deliveries"],
        queryFn: getDeliveries,
        initialData,
        staleTime: 60 * 1000,
    })

    const { hasResourcePermission } = usePermissions()
    const canEdit = hasResourcePermission('deliveries', 'edit')
    const canDelete = hasResourcePermission('deliveries', 'delete')

    const [globalFilter, setGlobalFilter] = useState("")
    const [statusFilter, setStatusFilter] = useState("all")
    const [sorting, setSorting] = useState<SortingState>([{ id: "deliveryDate", desc: true }])

    const [editDelivery, setEditDelivery] = useState<any | null>(null)
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [deleting, setDeleting] = useState<number | null>(null)

    const columns = useMemo<ColumnDef<any>[]>(() => [
        {
            accessorKey: "deliveryNumber",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="-ml-4 h-8"
                >
                    Delivery/DO No
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
            cell: ({ row }) => (
                <div className="font-mono text-sm">
                    <div className="font-medium text-blue-600 dark:text-blue-400">
                        {row.original.deliveryNumber || "-"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                        SO: {row.original.salesOrder?.invoiceNumber || "-"}
                    </div>
                </div>
            ),
        },
        {
            id: "customerPo",
            accessorFn: (row) => row.salesOrder?.customerPo,
            header: "No. PO",
            cell: ({ row }) => <span className="font-mono text-sm">{row.original.salesOrder?.customerPo || "-"}</span>,
        },
        {
            accessorKey: "deliveryDate",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="-ml-4 h-8"
                >
                    Tgl Pengiriman
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
            cell: ({ row }) => row.original.deliveryDate ? new Date(row.original.deliveryDate).toLocaleDateString("id-ID") : "-",
        },
        {
            accessorKey: "returnDoDate",
            header: "Return Date",
            cell: ({ row }) => row.original.returnDoDate ? new Date(row.original.returnDoDate).toLocaleDateString("id-ID") : "-",
        },
        {
            accessorKey: "doStatus",
            header: "DO Status",
            cell: ({ row }) => {
                const delivery = row.original
                return canEdit ? (
                    <Select
                        defaultValue={delivery.doStatus || "Pending"}
                        onValueChange={(value) => handleUpdateStatus(delivery.id, value)}
                    >
                        <SelectTrigger className={`h-8 w-[110px] text-xs font-medium border-none shadow-none focus:ring-0 ${delivery.doStatus === "Returned" ? 'bg-primary text-primary-foreground' :
                            delivery.doStatus === "Lost" ? 'bg-destructive text-destructive-foreground' : 'bg-secondary text-secondary-foreground'
                            }`}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Pending">Pending</SelectItem>
                            <SelectItem value="Returned">Returned</SelectItem>
                            <SelectItem value="Lost">Lost</SelectItem>
                        </SelectContent>
                    </Select>
                ) : (
                    <Badge variant={
                        delivery.doStatus === "Returned" ? "default" :
                            delivery.doStatus === "Lost" ? "destructive" : "secondary"
                    }>
                        {delivery.doStatus || "Pending"}
                    </Badge>
                )
            },
        },
        {
            accessorKey: "invoiceNumber",
            header: "Invoice No",
            cell: ({ row }) => <span className="font-mono text-sm">{row.original.invoiceNumber || "-"}</span>,
        },
        {
            accessorKey: "invoiceDate",
            header: "Invoice Date",
            cell: ({ row }) => row.original.invoiceDate ? new Date(row.original.invoiceDate).toLocaleDateString("id-ID") : "-",
        },
        {
            id: "customerName",
            accessorFn: (row) => row.salesOrder?.customer?.name,
            header: "Customer",
            cell: ({ row }) => row.original.salesOrder?.customer?.name || "-",
        },
        {
            accessorKey: "remark",
            header: "Remark",
            cell: ({ row }) => (
                <div className="max-w-[200px] truncate" title={row.original.remark || ""}>
                    {row.original.remark || "-"}
                </div>
            ),
        },
        {
            id: "actions",
            header: () => <div className="text-right">Actions</div>,
            cell: ({ row }) => {
                const delivery = row.original
                return (
                    <div className="flex justify-end gap-1">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                    <span className="sr-only">Open menu</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>

                                {canEdit && (
                                    <Link href={`/dashboard/deliveries/${delivery.id}`}>
                                        <DropdownMenuItem>
                                            <Eye className="mr-2 h-4 w-4" />
                                            Detail Delivery
                                        </DropdownMenuItem>
                                    </Link>
                                )}

                                {canEdit && (
                                    <DropdownMenuItem
                                        onClick={() => {
                                            setEditDelivery(delivery)
                                            setIsEditOpen(true)
                                        }}
                                    >
                                        <FileEdit className="mr-2 h-4 w-4" />
                                        Edit DO Info
                                    </DropdownMenuItem>
                                )}

                                {canDelete && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600">
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Delete Delivery
                                                </DropdownMenuItem>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Delete Delivery?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This will permanently delete delivery{" "}
                                                        <strong>{delivery.deliveryNumber}</strong>. This action cannot be undone.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction
                                                        onClick={() => handleDelete(delivery.id)}
                                                        disabled={deleting === delivery.id}
                                                        className="bg-red-600 hover:bg-red-700"
                                                    >
                                                        {deleting === delivery.id ? "Deleting..." : "Delete"}
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                )
            },
        },
    ], [canEdit, canDelete, deleting])

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
            const d = row.original
            const matchesSearch =
                d.deliveryNumber?.toLowerCase().includes(term) ||
                d.salesOrder?.invoiceNumber?.toLowerCase().includes(term) ||
                d.salesOrder?.customer?.name?.toLowerCase().includes(term) ||
                d.invoiceNumber?.toLowerCase().includes(term)

            const matchesStatus = statusFilter === "all" || (d.doStatus || "Pending") === statusFilter
            return matchesSearch && matchesStatus
        },
    })

    // Virtualization
    const parentRef = useRef<HTMLDivElement>(null)
    const { rows } = table.getRowModel()

    const rowVirtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 53,
        overscan: 20,
    })

    const [before, after] = rowVirtualizer.getVirtualItems().length > 0
        ? [
            rowVirtualizer.getVirtualItems()[0].start,
            rowVirtualizer.getTotalSize() - rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1].end,
        ]
        : [0, 0]

    const handleExport = () => {
        const headers = ["Delivery No", "SO No", "Customer PO", "Tgl Pengiriman", "Return Date", "DO Status", "Invoice No", "Invoice Date", "Customer", "Remark"]
        const csvData = table.getFilteredRowModel().rows.map(row => {
            const d = row.original
            return [
                d.deliveryNumber || "",
                d.salesOrder?.invoiceNumber || "",
                d.salesOrder?.customerPo || "",
                d.deliveryDate ? new Date(d.deliveryDate).toLocaleDateString("id-ID") : "",
                d.returnDoDate ? new Date(d.returnDoDate).toLocaleDateString("id-ID") : "",
                d.doStatus || "Pending",
                d.invoiceNumber || "",
                d.invoiceDate ? new Date(d.invoiceDate).toLocaleDateString("id-ID") : "",
                d.salesOrder?.customer?.name || "",
                d.remark || ""
            ]
        })

        const csvContent = [
            headers.join(","),
            ...csvData.map(row => row.join(","))
        ].join("\n")

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
        const link = document.createElement("a")
        const url = URL.createObjectURL(blob)
        link.setAttribute("href", url)
        link.setAttribute("download", `do-monitoring-${new Date().toISOString().slice(0, 10)}.csv`)
        link.style.visibility = "hidden"
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const handleUpdateStatus = async (id: number, status: string) => {
        const res = await updateDoMonitoringFields(id, { doStatus: status })
        if (res.success) {
            toast.success("DO Status updated")
            queryClient.invalidateQueries({ queryKey: ["deliveries"] })
        } else {
            toast.error((res as { error?: string }).error || "Failed to update DO Status")
        }
    }

    async function handleDelete(id: number) {
        setDeleting(id)
        const res = await deleteDelivery(id)
        if (res.success) {
            toast.success("Delivery deleted successfully")
            queryClient.invalidateQueries({ queryKey: ["deliveries"] })
        } else {
            toast.error((res as { error?: string }).error || "Failed to delete delivery")
        }
        setDeleting(null)
    }

    // Effect to trigger search when status filter changes
    useEffect(() => {
        table.setGlobalFilter(globalFilter)
    }, [statusFilter, globalFilter, table])

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search DO, SO, Customer, Invoice..."
                        value={globalFilter ?? ""}
                        onChange={e => setGlobalFilter(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={handleExport}>
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV
                    </Button>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[160px]">
                            <SelectValue placeholder="DO Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="Pending">Pending</SelectItem>
                            <SelectItem value="Returned">Returned</SelectItem>
                            <SelectItem value="Lost">Lost</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="rounded-md border overflow-hidden">
                <div
                    ref={parentRef}
                    className="overflow-auto h-[600px] relative scrollbar-thin scrollbar-thumb-accent"
                >
                    <Table>
                        <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => (
                                        <TableHead key={header.id}>
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
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
                                            <TableRow
                                                key={row.id}
                                                data-state={row.getIsSelected() && "selected"}
                                            >
                                                {row.getVisibleCells().map((cell) => (
                                                    <TableCell key={cell.id}>
                                                        {flexRender(
                                                            cell.column.columnDef.cell,
                                                            cell.getContext()
                                                        )}
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
                                    <TableCell colSpan={columns.length} className="h-24 text-center">
                                        No records found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <EditDoDialog
                delivery={editDelivery}
                open={isEditOpen}
                onOpenChange={setIsEditOpen}
            />
        </div>
    )
}
