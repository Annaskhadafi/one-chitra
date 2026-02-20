"use client"

import * as React from "react"
import {
    ColumnFiltersState,
    SortingState,
    VisibilityState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table"
import { ChevronDown, Download } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { getColumns } from "./billing-columns"
import { BillingImportDialog } from "./billing-import-dialog"
import { BillingSheet } from "./billing-sheet"
import { deleteBillingRecord } from "@/app/actions/billing"
import { toast } from "sonner"
import { usePermissions } from "@/hooks/use-permissions"
// import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog" 

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function BillingTable({ data }: { data: any[] }) {
    const [sorting, setSorting] = React.useState<SortingState>([])
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
    const [rowSelection, setRowSelection] = React.useState({})

    // Sheet State
    const [sheetOpen, setSheetOpen] = React.useState(false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [selectedRecord, setSelectedRecord] = React.useState<any>(null)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleEdit = (record: any) => {
        setSelectedRecord(record)
        setSheetOpen(true)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleView = (record: any) => {
        setSelectedRecord(record)
        setSheetOpen(true)
    }

    const handleDelete = async (id: number) => {
        if (confirm("Are you sure you want to delete the billing data for this delivery item? This will reset it to default.")) {
            try {
                await deleteBillingRecord(id)
                toast.success("Billing data deleted")
            } catch (_error) {
                toast.error("Failed to delete billing data")
            }
        }
    }

    const handleExport = () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const headers = ["Customer", "PO No", "PO Date", "Delivery No", "Material No", "Description", "Qty", "Price", "Amount"]
        const csvData = table.getFilteredRowModel().rows.map(row => {
            const d = row.original
            return [
                d.customer || "",
                d.poNo || "",
                d.poDate ? new Date(d.poDate).toLocaleDateString("id-ID") : "",
                d.deliveryNo || "",
                d.materialNo || "",
                d.description || "",
                d.qty || 0,
                d.price || 0,
                d.amount || 0
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
        link.setAttribute("download", `billing-${new Date().toISOString().slice(0, 10)}.csv`)
        link.style.visibility = "hidden"
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const { hasResourcePermission } = usePermissions()
    const canCreate = hasResourcePermission('billing', 'create')
    const canEdit = hasResourcePermission('billing', 'edit')
    const canDelete = hasResourcePermission('billing', 'delete')

    const columns = React.useMemo(() => getColumns(
        canEdit ? handleEdit : () => toast.error("No permission"),
        canDelete ? handleDelete : () => toast.error("No permission"),
        handleView
    ), [canEdit, canDelete])

    const table = useReactTable({
        data,
        columns,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: setRowSelection,
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            rowSelection,
        },
    })

    return (
        <div className="w-full space-y-4">
            <BillingSheet open={sheetOpen} onOpenChange={setSheetOpen} record={selectedRecord} />

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Input
                        placeholder="Filter Customer..."
                        value={(table.getColumn("customer")?.getFilterValue() as string) ?? ""}
                        onChange={(event) =>
                            table.getColumn("customer")?.setFilterValue(event.target.value)
                        }
                        className="max-w-sm"
                    />
                    <Input
                        placeholder="Filter PO No..."
                        value={(table.getColumn("poNo")?.getFilterValue() as string) ?? ""}
                        onChange={(event) =>
                            table.getColumn("poNo")?.setFilterValue(event.target.value)
                        }
                        className="max-w-sm"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={handleExport}>
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV
                    </Button>
                    {canCreate && <BillingImportDialog />}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="ml-auto">
                                Columns <ChevronDown className="ml-2 h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {table
                                .getAllColumns()
                                .filter((column) => column.getCanHide())
                                .map((column) => {
                                    return (
                                        <DropdownMenuCheckboxItem
                                            key={column.id}
                                            className="capitalize"
                                            checked={column.getIsVisible()}
                                            onCheckedChange={(value) =>
                                                column.toggleVisibility(!!value)
                                            }
                                        >
                                            {column.id}
                                        </DropdownMenuCheckboxItem>
                                    )
                                })}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead key={header.id}>
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                        </TableHead>
                                    )
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
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
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-24 text-center"
                                >
                                    No results.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <div className="flex items-center justify-end space-x-2 py-4">
                <div className="flex-1 text-sm text-muted-foreground">
                    {table.getFilteredSelectedRowModel().rows.length} of{" "}
                    {table.getFilteredRowModel().rows.length} row(s) selected.
                </div>
                <div className="space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        Previous
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
