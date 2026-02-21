"use client"

import * as React from "react"
import {
    ColumnFiltersState,
    SortingState,
    VisibilityState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table"
import { ChevronDown, Download, Loader2 } from "lucide-react"

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
import { deleteBillingRecord, getBillingRecords } from "@/app/actions/billing"
import { toast } from "sonner"
import { usePermissions } from "@/hooks/use-permissions"
import { useQuery } from "@tanstack/react-query"
import { useVirtualizer } from "@tanstack/react-virtual"

interface BillingRecordDisplay {
    deliveryItemId: number
    billingRecordId: number | null
    no: string | null
    year: number | null
    month: string | null
    plant: string
    customer: string
    poNo: string
    datePo: Date
    materialNumber: string
    materialDescription: string
    qty: string
    curr: string
    pricePerPcsIdr: string | null
    totalPriceIdr: string | null
    ppn: string | null
    price: string | null
    includePpn: string | null
    noInvSap: string | null
    dateInvoice: Date | null
    custId: string | null
    salesName: string | null
    ddpAddress: string | null
    paymentType: string | null
    nomorDoSap: string | null
    actualNoDo: string | null
    tglDoFaktur: Date | null
    remaks: string | null
    dateSendInvoice: Date | null
    receiverDate: Date | null
    recvDateApproved: Date | null
    eFaktur: string | null
    status: string
    deliveryNumber: string | null
    originalPrice: string
}

export function BillingTable({ data: initialData }: { data: BillingRecordDisplay[] }) {
    const { data: records = initialData, isLoading, refetch } = useQuery({
        queryKey: ["billing-records"],
        queryFn: async () => {
            const result = await getBillingRecords()
            if (result.success) return result.data || []
            throw new Error(result.error || "Failed to fetch")
        },
        initialData,
        staleTime: 60 * 1000,
    })

    const [sorting, setSorting] = React.useState<SortingState>([])
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
    const [rowSelection, setRowSelection] = React.useState({})

    // Sheet State
    const [sheetOpen, setSheetOpen] = React.useState(false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [selectedRecord, setSelectedRecord] = React.useState<BillingRecordDisplay | null>(null)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleEdit = (record: BillingRecordDisplay) => {
        setSelectedRecord(record)
        setSheetOpen(true)
    }

    const handleView = (record: BillingRecordDisplay) => {
        setSelectedRecord(record)
        setSheetOpen(true)
    }

    const handleDelete = async (id: number) => {
        if (confirm("Are you sure you want to delete the billing data for this delivery item? This will reset it to default.")) {
            try {
                const result = await deleteBillingRecord(id)
                if (result.success) {
                    toast.success("Billing data deleted")
                    refetch()
                } else {
                    toast.error(result.error || "Failed to delete")
                }
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
                d.poDate ? new Date(d.datePo).toLocaleDateString("id-ID") : "",
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
    ), [canEdit, canDelete, handleDelete])

    const table = useReactTable({
        data: records,
        columns,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        getCoreRowModel: getCoreRowModel(),
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

    // Virtualization
    const parentRef = React.useRef<HTMLDivElement>(null)
    const { rows } = table.getRowModel()

    const rowVirtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 50,
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
            <div className="flex h-48 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

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

            <div className="rounded-md border bg-card overflow-hidden">
                <div
                    ref={parentRef}
                    className="h-[600px] overflow-auto relative scrollbar-thin scrollbar-thumb-accent"
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
                                        <TableCell colSpan={columns.length} className="p-0" />
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
                                        <TableCell colSpan={columns.length} className="p-0" />
                                    </TableRow>
                                </>
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
            </div>

            <div className="flex items-center justify-end space-x-2 py-4">
                <div className="flex-1 text-sm text-muted-foreground">
                    {table.getFilteredSelectedRowModel().rows.length} of{" "}
                    {table.getFilteredRowModel().rows.length} row(s) selected.
                </div>
            </div>
        </div>
    )
}
