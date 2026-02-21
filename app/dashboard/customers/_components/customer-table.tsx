"use client"

import { useState, useMemo, useRef, useEffect } from "react"
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
import { deleteCustomer, bulkDeleteCustomers, getCustomers } from "@/app/actions/customer"
import { CustomerDialog } from "./customer-dialog"
import { CustomerCSVUpload } from "./customer-table-csv"
import { Search, Pencil, Trash2, Users, UserPlus, ChevronUp, ChevronDown } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { ScoreCard } from "@/components/score-card"
import { BulkActions } from "@/components/bulk-actions"
import { toast } from "sonner"
import { usePermissions } from "@/hooks/use-permissions"
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
import { Customer } from "@/lib/types"
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

export function CustomerTable({ customers: initialCustomers }: { customers: Customer[] }) {
    const queryClient = useQueryClient()
    const { data = initialCustomers } = useQuery({
        queryKey: ["customers"],
        queryFn: getCustomers,
        initialData: initialCustomers,
        staleTime: 60 * 1000,
    })

    const { hasResourcePermission } = usePermissions()
    const canCreate = hasResourcePermission('customers', 'create')
    const canEdit = hasResourcePermission('customers', 'edit')
    const canDelete = hasResourcePermission('customers', 'delete')

    const [globalFilter, setGlobalFilter] = useState("")
    const [sorting, setSorting] = useState<SortingState>([{ id: "name", desc: false }])
    const [rowSelection, setRowSelection] = useState({})

    // Stats calculation based on fetched data
    const totalCustomers = data.length
    const newCustomers = data.filter(c => {
        const date = new Date(c.createdAt)
        const now = new Date()
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
    }).length

    const columns = useMemo<ColumnDef<Customer>[]>(() => [
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
            accessorKey: "customerCode",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="-ml-4 h-8"
                >
                    ID (Code)
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
            cell: ({ row }) => <span className="font-medium text-blue-600 font-mono">{row.original.customerCode}</span>,
        },
        {
            accessorKey: "name",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="-ml-4 h-8"
                >
                    Customer Name
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
            cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
        },
        {
            accessorKey: "contactName",
            header: "Contact",
            cell: ({ row }) => <span className="text-muted-foreground text-sm">{row.original.contactName || "-"}</span>,
        },
        {
            accessorKey: "email",
            header: "Email",
            cell: ({ row }) => <span className="text-sm">{row.original.email || "-"}</span>,
        },
        {
            accessorKey: "address1",
            header: "Address (Primary)",
            cell: ({ row }) => <span className="max-w-xs truncate text-xs text-muted-foreground">{row.original.address1 || "-"}</span>,
        },
        {
            id: "actions",
            header: () => <div className="text-right">Actions</div>,
            cell: ({ row }) => {
                const item = row.original
                return (
                    <div className="flex justify-end gap-1">
                        {canEdit && (
                            <CustomerDialog
                                customer={item}
                                trigger={
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                }
                            />
                        )}

                        {canDelete && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Customer</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Are you sure you want to delete {item.name}? This action cannot be undone.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={() => handleDelete(item.id)}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                            Delete
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                    </div>
                )
            },
        },
    ], [canEdit, canDelete])

    const table = useReactTable({
        data,
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
                item.customerCode.toLowerCase().includes(term) ||
                item.name.toLowerCase().includes(term) ||
                (item.email && item.email.toLowerCase().includes(term))
            )
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

    const selectedIds = Object.keys(rowSelection).map(
        (idx) => data[parseInt(idx)].id
    )

    const handleBulkDelete = async () => {
        if (confirm("Are you sure you want to delete selected customers?")) {
            const result = await bulkDeleteCustomers(selectedIds)
            if (result.success) {
                toast.success("Customers deleted successfully")
                setRowSelection({})
                queryClient.invalidateQueries({ queryKey: ["customers"] })
            } else {
                toast.error(result.error)
            }
        }
    }

    const handleDelete = async (id: number) => {
        try {
            const result = await deleteCustomer(id)
            if (result.success) {
                toast.success("Customer deleted")
                queryClient.invalidateQueries({ queryKey: ["customers"] })
            } else {
                toast.error(result.error)
            }
        } catch (_error) {
            toast.error("Failed to delete customer")
        }
    }

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
                <ScoreCard
                    title="Total Customers"
                    value={totalCustomers}
                    icon={Users}
                    description="All registered customers"
                    gradient="from-blue-500/10 via-blue-400/5 to-indigo-500/10 border-blue-200/50 dark:from-blue-500/20 dark:via-blue-400/10 dark:to-indigo-500/20 dark:border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/20"
                    iconColor="text-blue-600 dark:text-blue-400"
                    textColor="text-blue-900 dark:text-blue-100"
                />
                <ScoreCard
                    title="New This Month"
                    value={newCustomers}
                    icon={UserPlus}
                    description="Added in current month"
                    gradient="from-emerald-500/10 via-emerald-400/5 to-teal-500/10 border-emerald-200/50 dark:from-emerald-500/20 dark:via-emerald-400/10 dark:to-teal-500/20 dark:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/20"
                    iconColor="text-emerald-600 dark:text-emerald-400"
                    textColor="text-emerald-900 dark:text-emerald-100"
                />
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search customers..."
                        className="pl-8"
                        value={globalFilter ?? ""}
                        onChange={(e) => setGlobalFilter(e.target.value)}
                    />
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    {canCreate && (
                        <>
                            <CustomerCSVUpload />
                            <CustomerDialog />
                        </>
                    )}
                </div>
            </div>

            <div className="rounded-md border overflow-hidden">
                <div
                    ref={parentRef}
                    className="overflow-auto h-[600px] relative scrollbar-thin scrollbar-thumb-accent"
                >
                    <Table>
                        <TableHeader>
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
                                    <TableRow
                                        style={{ height: `${after}px` }}
                                        className="border-none"
                                    >
                                        <TableCell colSpan={columns.length} />
                                    </TableRow>
                                </>
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={columns.length} className="h-24 text-center">
                                        No entries found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {selectedIds.length > 0 && (canDelete) && (
                <BulkActions
                    selectedCount={selectedIds.length}
                    onDelete={handleBulkDelete}
                    entityName="customer"
                    showEdit={false}
                />
            )}
        </div>
    )
}
