"use client"

import { useState, useMemo, useRef } from "react"
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    flexRender,
    type ColumnDef,
    type SortingState,
} from "@tanstack/react-table"
import { useVirtualizer } from "@tanstack/react-virtual"
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
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Download, Search } from "lucide-react"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/utils"

interface LogisticsCostTableProps {
    data: any[]
}

export function LogisticsCostTable({ data }: LogisticsCostTableProps) {
    const [sorting, setSorting] = useState<SortingState>([])
    const [globalFilter, setGlobalFilter] = useState("")

    const columns = useMemo<ColumnDef<any>[]>(
        () => [
            {
                accessorKey: "deliveryNumber",
                header: "Delivery #",
                cell: ({ row }) => <span className="font-medium text-primary">{row.original.deliveryNumber}</span>,
            },
            {
                accessorKey: "invoiceNumber",
                header: "Invoice #",
                cell: ({ row }) => row.original.invoiceNumber || "-",
            },
            {
                accessorKey: "deliveryDate",
                header: "Date",
                cell: ({ row }) => {
                    const date = row.original.deliveryDate || row.original.scheduledDate
                    return date ? format(new Date(date), "dd MMM yyyy") : "-"
                },
            },
            {
                accessorKey: "driverName",
                header: "Driver / Vendor",
                cell: ({ row }) => row.original.isExternal ? row.original.vendorName : row.original.driverName || "-",
            },
            {
                accessorKey: "shippingCost",
                header: "Ext. Cost",
                cell: ({ row }) => formatCurrency(row.original.shippingCost || 0),
            },
            {
                accessorKey: "costGasoline",
                header: "Gas",
                cell: ({ row }) => formatCurrency(row.original.costGasoline || 0),
            },
            {
                accessorKey: "costToll",
                header: "Toll",
                cell: ({ row }) => formatCurrency(row.original.costToll || 0),
            },
            {
                accessorKey: "costParking",
                header: "Parking",
                cell: ({ row }) => formatCurrency(row.original.costParking || 0),
            },
            {
                accessorKey: "costMeals",
                header: "Meals",
                cell: ({ row }) => formatCurrency(row.original.costMeals || 0),
            },
            {
                accessorKey: "costMaintenance",
                header: "Maint.",
                cell: ({ row }) => formatCurrency(row.original.costMaintenance || 0),
            },
            {
                accessorKey: "costOthers",
                header: "Others",
                cell: ({ row }) => formatCurrency(row.original.costOthers || 0),
            },
            {
                id: "total_internal",
                header: "Total Internal",
                cell: ({ row }) => {
                    const total =
                        Number(row.original.costGasoline || 0) +
                        Number(row.original.costToll || 0) +
                        Number(row.original.costParking || 0) +
                        Number(row.original.costMeals || 0) +
                        Number(row.original.costMaintenance || 0) +
                        Number(row.original.costOthers || 0)
                    return <span className="font-bold">{formatCurrency(total)}</span>
                },
            },
        ],
        []
    )

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
    })

    const { rows } = table.getRowModel()
    const parentRef = useRef<HTMLDivElement>(null)

    const virtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 45,
        overscan: 10,
    })

    const totalShipping = useMemo(() => data.reduce((acc, curr) => acc + Number(curr.shippingCost || 0), 0), [data])
    const totalInternal = useMemo(() => data.reduce((acc, curr) => {
        return acc +
            Number(curr.costGasoline || 0) +
            Number(curr.costToll || 0) +
            Number(curr.costParking || 0) +
            Number(curr.costMeals || 0) +
            Number(curr.costMaintenance || 0) +
            Number(curr.costOthers || 0)
    }, 0), [data])

    const exportToCSV = () => {
        const headers = ["Delivery #", "Invoice #", "Date", "Driver/Vendor", "Ext Cost", "Gas", "Toll", "Parking", "Meals", "Maint", "Others", "Total Internal"]
        const csvRows = data.map(row => {
            const date = row.deliveryDate || row.scheduledDate
            const total =
                Number(row.costGasoline || 0) +
                Number(row.costToll || 0) +
                Number(row.costParking || 0) +
                Number(row.costMeals || 0) +
                Number(row.costMaintenance || 0) +
                Number(row.costOthers || 0)

            return [
                row.deliveryNumber,
                row.invoiceNumber || "",
                date ? format(new Date(date), "yyyy-MM-dd") : "",
                row.isExternal ? row.vendorName : row.driverName || "",
                row.shippingCost || 0,
                row.costGasoline || 0,
                row.costToll || 0,
                row.costParking || 0,
                row.costMeals || 0,
                row.costMaintenance || 0,
                row.costOthers || 0,
                total
            ].join(",")
        })

        const csvContent = [headers.join(","), ...csvRows].join("\n")
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.setAttribute("href", url)
        link.setAttribute("download", `logistics-costs-${format(new Date(), "yyyy-MM-dd")}.csv`)
        link.style.visibility = "hidden"
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground italic">Total External Shipping</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">{formatCurrency(totalShipping)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground italic">Total Internal Logistics</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{formatCurrency(totalInternal)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground italic">Grand Total Logistics</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-primary">{formatCurrency(totalShipping + totalInternal)}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search costs..."
                        value={globalFilter}
                        onChange={(e) => setGlobalFilter(e.target.value)}
                        className="pl-8"
                    />
                </div>
                <Button onClick={exportToCSV} variant="outline" className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Export CSV
                </Button>
            </div>

            <div className="rounded-md border bg-card overflow-hidden">
                <div
                    ref={parentRef}
                    className="h-[600px] overflow-auto relative scrollbar-thin scrollbar-thumb-accent"
                >
                    <Table>
                        <TableHeader className="sticky top-0 z-10 bg-secondary/80 backdrop-blur-sm">
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id} className="hover:bg-transparent">
                                    {headerGroup.headers.map((header) => (
                                        <TableHead key={header.id} className="py-3 px-4 first:pl-6 last:pr-6 whitespace-nowrap">
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
                            {virtualizer.getVirtualItems().length > 0 ? (
                                <>
                                    {virtualizer.getVirtualItems()[0].start > 0 && (
                                        <TableRow style={{ height: `${virtualizer.getVirtualItems()[0].start}px` }} className="border-none">
                                            <TableCell className="p-0" />
                                        </TableRow>
                                    )}
                                    {virtualizer.getVirtualItems().map((virtualRow) => {
                                        const row = rows[virtualRow.index]
                                        return (
                                            <TableRow
                                                key={row.id}
                                                data-index={virtualRow.index}
                                                className="group hover:bg-muted/50 transition-colors border-b last:border-0"
                                            >
                                                {row.getVisibleCells().map((cell) => (
                                                    <TableCell key={cell.id} className="py-2.5 px-4 first:pl-6 last:pr-6">
                                                        {flexRender(
                                                            cell.column.columnDef.cell,
                                                            cell.getContext()
                                                        )}
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        )
                                    })}
                                    {virtualizer.getTotalSize() - (virtualizer.getVirtualItems()[virtualizer.getVirtualItems().length - 1].end) > 0 && (
                                        <TableRow
                                            style={{ height: `${virtualizer.getTotalSize() - (virtualizer.getVirtualItems()[virtualizer.getVirtualItems().length - 1].end)}px` }}
                                            className="border-none"
                                        >
                                            <TableCell className="p-0" />
                                        </TableRow>
                                    )}
                                </>
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={columns.length} className="h-24 text-center">
                                        No results.
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
