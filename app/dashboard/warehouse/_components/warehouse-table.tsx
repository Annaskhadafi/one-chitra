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
import { Warehouse } from "@/lib/types"
import { WarehouseDialog } from "./warehouse-dialog"
import { WarehouseCSVUpload } from "./csv-upload"
import { Search, Pencil, Trash2, Warehouse as WarehouseIcon, Download, ChevronUp, ChevronDown } from "lucide-react"
import { deleteWarehouse, bulkDeleteWarehouses, getWarehouses } from "@/app/actions/warehouse"
import { Checkbox } from "@/components/ui/checkbox"
import { ScoreCard } from "@/components/score-card"
import { BulkActions } from "@/components/bulk-actions"
import { toast } from "sonner"
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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
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
import { cn } from "@/lib/utils"

interface WarehouseEnhanced extends Warehouse {
    totalStock: number
    totalValuation: number
}

interface WarehouseTableProps {
    data: WarehouseEnhanced[]
}

export function WarehouseTable({ data: initialData }: WarehouseTableProps) {
    const queryClient = useQueryClient()
    const { data = initialData, isLoading, refetch } = useQuery({
        queryKey: ["warehouses"],
        queryFn: getWarehouses,
        initialData,
        staleTime: 60 * 1000,
    })

    // Mutations
    const deleteMutation = useMutation({
        mutationFn: (ids: number[]) => ids.length === 1 ? deleteWarehouse(ids[0]) : bulkDeleteWarehouses(ids),
        onMutate: async (ids) => {
            await queryClient.cancelQueries({ queryKey: ["warehouses"] })
            const previousWarehouses = queryClient.getQueryData<WarehouseEnhanced[]>(["warehouses"])

            if (previousWarehouses) {
                queryClient.setQueryData<WarehouseEnhanced[]>(["warehouses"], (old) =>
                    old?.filter(warehouse => !ids.includes(warehouse.id))
                )
            }

            return { previousWarehouses }
        },
        onError: (err, variables, context) => {
            if (context?.previousWarehouses) {
                queryClient.setQueryData(["warehouses"], context.previousWarehouses)
            }
            toast.error("Failed to delete warehouse(s)")
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["warehouses"] })
        },
    })

    const [sorting, setSorting] = useState<SortingState>([])
    const [globalFilter, setGlobalFilter] = useState("")
    const [rowSelection, setRowSelection] = useState({})

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value)
    }

    const columns = useMemo<ColumnDef<WarehouseEnhanced>[]>(() => [
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
            accessorKey: "sloc",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4 h-8">
                    Sloc
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
            cell: ({ row }) => <div className="font-medium">{row.original.sloc}</div>,
        },
        {
            accessorKey: "type",
            header: "Type",
        },
        {
            accessorKey: "description",
            header: "Description",
        },
        {
            accessorKey: "totalStock",
            header: () => <div className="text-right">Total Stock</div>,
            cell: ({ row }) => <div className="text-right font-mono">{row.original.totalStock.toLocaleString()}</div>,
        },
        {
            accessorKey: "totalValuation",
            header: () => <div className="text-right">Valuation</div>,
            cell: ({ row }) => <div className="text-right font-mono">{formatCurrency(row.original.totalValuation)}</div>,
        },
        {
            id: "actions",
            header: () => <div className="text-right">Actions</div>,
            cell: ({ row }) => (
                <div className="flex justify-end gap-2">
                    <WarehouseDialog
                        warehouse={row.original}
                        onSuccess={() => refetch()}
                        trigger={
                            <Button variant="ghost" size="icon">
                                <Pencil className="h-4 w-4" />
                            </Button>
                        }
                    />

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Delete Warehouse</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Are you sure you want to delete {row.original.sloc}? This action cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={async () => {
                                        deleteMutation.mutate([row.original.id], {
                                            onSuccess: () => toast.success("Warehouse deleted")
                                        })
                                    }}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
        getRowId: (row) => row.id.toString(),
    })

    const handleBulkDelete = async () => {
        const selectedIds = table.getSelectedRowModel().flatRows.map(r => r.original.id)
        if (confirm("Are you sure you want to delete selected warehouses?")) {
            deleteMutation.mutate(selectedIds, {
                onSuccess: (result) => {
                    if (result.success) {
                        toast.success("Warehouses deleted successfully")
                        setRowSelection({})
                    } else {
                        toast.error(result.error)
                    }
                }
            })
        }
    }

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

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
                <ScoreCard
                    title="Total Warehouses"
                    value={data.length}
                    icon={WarehouseIcon}
                    description="Active storage locations"
                    gradient="from-purple-500/10 via-purple-400/5 to-pink-500/10 border-purple-200/50 dark:from-purple-500/20 dark:via-purple-400/10 dark:to-pink-500/20 dark:border-purple-500/30 hover:shadow-lg hover:shadow-purple-500/20"
                    iconColor="text-purple-600 dark:text-purple-400"
                    textColor="text-purple-900 dark:text-purple-100"
                />
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search Sloc or Description..."
                        className="pl-8"
                        value={globalFilter ?? ""}
                        onChange={(e) => setGlobalFilter(e.target.value)}
                    />
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <Button variant="outline" onClick={() => {
                        const filteredData = table.getFilteredRowModel().rows.map(r => r.original)
                        const csvContent = "data:text/csv;charset=utf-8,"
                            + "Sloc,Type,Description,Total Stock,Valuation,Created At\n"
                            + filteredData.map(row => `"${row.sloc}","${row.type || ''}","${row.description || ''}","${row.totalStock}","${row.totalValuation}","${row.createdAt}"`).join("\n");
                        const encodedUri = encodeURI(csvContent);
                        const link = document.createElement("a");
                        link.setAttribute("href", encodedUri);
                        link.setAttribute("download", `warehouses_export_${new Date().toISOString().split('T')[0]}.csv`);
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    }}>
                        <Download className="mr-2 h-4 w-4" />
                        Export
                    </Button>
                    <WarehouseCSVUpload onSuccess={() => refetch()} />
                    <WarehouseDialog onSuccess={() => refetch()} />
                </div>
            </div>

            <div className="rounded-md border bg-card overflow-hidden">
                <div
                    ref={parentRef}
                    className="h-[500px] overflow-auto relative scrollbar-thin scrollbar-thumb-accent"
                >
                    <Table>
                        <TableHeader>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
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
                                            <TableRow key={row.id}>
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
                                    <TableCell colSpan={columns.length} className="h-24 text-center">
                                        No warehouses found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <BulkActions
                selectedCount={table.getSelectedRowModel().flatRows.length}
                onDelete={handleBulkDelete}
                entityName="warehouse"
                showEdit={false}
            />
        </div>
    )
}
