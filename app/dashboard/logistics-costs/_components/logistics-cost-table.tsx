"use client"

import { useMemo, useState } from "react"
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    flexRender,
    type ColumnDef,
    type SortingState,
} from "@tanstack/react-table"
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Download, Search, Trash2 } from "lucide-react"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/utils"
import { usePermissions } from "@/hooks/use-permissions"
import { clearLogisticsCosts } from "@/app/actions/delivery"
import { toast } from "sonner"
import Link from "next/link"

interface LogisticsCostDetailItem {
    deliveryId: number
    deliveryNumber: string | null
    invoiceNumber: string | null
    destination: string
    qty: number
}

interface LogisticsCost {
    id: number
    entryType: "trip" | "delivery"
    referenceNumber: string | null
    tripNumber: string | null
    deliveryNumber: string | null
    deliveryIds: number[]
    deliveryDate: Date | null
    scheduledDate: Date | null
    driverName: string | null
    vehicleNumber: string | null
    vendorName: string | null
    isExternal: boolean | null
    shippingCost: string | null
    costGasolineDexlite: string | null
    costGasolineBio: string | null
    costToll: string | null
    costParking: string | null
    costMeals: string | null
    costMaintenance: string | null
    costOthers: string | null
    costRapidTest?: string | null
    costFerry?: string | null
    costPortal?: string | null
    costWashing?: string | null
    costEscort?: string | null
    invoiceNumber: string | null
    detailItems: LogisticsCostDetailItem[]
    totalQty: number
    settlementId?: number | null
    settlementNumber?: string | null
    settlementStatus?: "draft" | "submitted" | "approved" | "rejected" | "posted" | null
}

interface LogisticsCostTableProps {
    data: LogisticsCost[]
}

const getInternalTotal = (row: LogisticsCost) =>
    Number(row.costGasolineDexlite || 0) +
    Number(row.costGasolineBio || 0) +
    Number(row.costToll || 0) +
    Number(row.costParking || 0) +
    Number(row.costMeals || 0) +
    Number(row.costMaintenance || 0) +
    Number(row.costOthers || 0) +
    Number(row.costRapidTest || 0) +
    Number(row.costFerry || 0) +
    Number(row.costPortal || 0) +
    Number(row.costWashing || 0) +
    Number(row.costEscort || 0)

export function LogisticsCostTable({ data }: LogisticsCostTableProps) {
    const [sorting, setSorting] = useState<SortingState>([])
    const [globalFilter, setGlobalFilter] = useState("")
    const { permissions } = usePermissions()
    const isAdmin = permissions.includes("admin") || permissions.includes("superuser") || permissions.includes("admin:view")

    const handleClearCosts = async () => {
        if (!confirm("Apakah Anda yakin ingin menghapus/me-nolkan SEMUA log biaya logistik? Aksi ini tidak dapat dibatalkan.")) {
            return
        }

        const result = await clearLogisticsCosts()
        if (result.success) {
            toast.success("Log biaya logistik berhasil dibersihkan")
        } else {
            toast.error(result.error || "Gagal membersihkan log")
        }
    }

    const columns = useMemo<ColumnDef<LogisticsCost>[]>(() => [
        {
            accessorKey: "referenceNumber",
            header: "Reference",
            cell: ({ row }) => (
                <div className="space-y-1">
                    <div className="font-medium text-primary">{row.original.referenceNumber || "-"}</div>
                    <div className="flex items-center gap-2">
                        <Badge variant={row.original.entryType === "trip" ? "default" : "secondary"}>
                            {row.original.entryType === "trip" ? "Grouped Trip" : row.original.isExternal ? "External" : "Delivery"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                            {row.original.detailItems.length} delivery
                        </span>
                    </div>
                </div>
            ),
        },
        {
            accessorKey: "invoiceNumber",
            header: "Invoice #",
            cell: ({ row }) => (
                <div className="max-w-[220px] whitespace-normal text-sm">
                    {row.original.invoiceNumber || "-"}
                </div>
            ),
        },
        {
            id: "details",
            header: "Detail Delivery",
            cell: ({ row }) => (
                <div className="min-w-[340px]">
                    <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value={`details-${row.original.entryType}-${row.original.id}`} className="border rounded-md px-3">
                            <AccordionTrigger className="py-2 text-sm">
                                <div className="flex flex-wrap items-center gap-3 text-left">
                                    <span className="font-medium">{row.original.detailItems.length} delivery</span>
                                    <span className="text-muted-foreground">Qty total: {row.original.totalQty}</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="pt-1">
                                <div className="space-y-2">
                                    {row.original.detailItems.map((item) => (
                                        <div key={item.deliveryId} className="rounded-md border bg-muted/20 p-3 text-sm">
                                            <div className="font-medium">{item.deliveryNumber || `Delivery #${item.deliveryId}`}</div>
                                            <div className="text-muted-foreground">Tujuan: {item.destination || "-"}</div>
                                            <div className="text-muted-foreground">Qty: {item.qty}</div>
                                            {item.invoiceNumber ? (
                                                <div className="text-muted-foreground">Invoice: {item.invoiceNumber}</div>
                                            ) : null}
                                        </div>
                                    ))}
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </div>
            ),
        },
        {
            id: "settlement",
            header: "Settlement",
            cell: ({ row }) => {
                if (!row.original.settlementId) {
                    return <span className="text-muted-foreground">-</span>
                }

                return (
                    <div className="flex items-center gap-2">
                        <Link
                            href={`/dashboard/cost-settlements/${row.original.settlementId}`}
                            className="font-medium text-primary hover:underline"
                        >
                            {row.original.settlementNumber || `STL-${row.original.settlementId}`}
                        </Link>
                        {row.original.settlementStatus ? (
                            <Badge variant="outline" className="capitalize">
                                {row.original.settlementStatus}
                            </Badge>
                        ) : null}
                    </div>
                )
            },
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
            id: "pic",
            header: "Driver / Vendor",
            cell: ({ row }) => row.original.isExternal ? row.original.vendorName || "-" : row.original.driverName || "-",
        },
        {
            accessorKey: "shippingCost",
            header: "Ext. Cost",
            cell: ({ row }) => formatCurrency(Number(row.original.shippingCost || 0)),
        },
        {
            accessorKey: "costGasolineDexlite",
            header: "BBM Dexlite",
            cell: ({ row }) => formatCurrency(Number(row.original.costGasolineDexlite || 0)),
        },
        {
            accessorKey: "costGasolineBio",
            header: "BBM Bio",
            cell: ({ row }) => formatCurrency(Number(row.original.costGasolineBio || 0)),
        },
        {
            accessorKey: "costToll",
            header: "Toll",
            cell: ({ row }) => formatCurrency(Number(row.original.costToll || 0)),
        },
        {
            accessorKey: "costParking",
            header: "Parking",
            cell: ({ row }) => formatCurrency(Number(row.original.costParking || 0)),
        },
        {
            accessorKey: "costMeals",
            header: "Meals",
            cell: ({ row }) => formatCurrency(Number(row.original.costMeals || 0)),
        },
        {
            accessorKey: "costMaintenance",
            header: "Maint.",
            cell: ({ row }) => formatCurrency(Number(row.original.costMaintenance || 0)),
        },
        {
            accessorKey: "costOthers",
            header: "Others",
            cell: ({ row }) => formatCurrency(Number(row.original.costOthers || 0)),
        },
        {
            id: "total_internal",
            header: "Summary Cost",
            cell: ({ row }) => <span className="font-bold">{formatCurrency(getInternalTotal(row.original))}</span>,
        },
    ], [])

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
        globalFilterFn: (row, _columnId, filterValue) => {
            const term = String(filterValue || "").toLowerCase()
            const current = row.original

            return [
                current.referenceNumber,
                current.tripNumber,
                current.deliveryNumber,
                current.invoiceNumber,
                current.driverName,
                current.vendorName,
                current.vehicleNumber,
                ...current.detailItems.flatMap((item) => [item.deliveryNumber, item.invoiceNumber, item.destination, String(item.qty)]),
            ]
                .filter((value): value is string => Boolean(value))
                .some((value) => value.toLowerCase().includes(term))
        },
    })

    const filteredRows = table.getFilteredRowModel().rows

    const totalShipping = useMemo(() => data.reduce((acc, curr) => acc + Number(curr.shippingCost || 0), 0), [data])
    const totalInternal = useMemo(() => data.reduce((acc, curr) => acc + getInternalTotal(curr), 0), [data])

    const exportToCSV = () => {
        const headers = ["Reference", "Type", "Invoice #", "Date", "Driver/Vendor", "Delivery Detail", "Ext Cost", "BBM Dexlite", "BBM Bio", "Toll", "Parking", "Meals", "Maint", "Others", "Summary Cost"]
        const csvRows = filteredRows.map(({ original: row }) => {
            const date = row.deliveryDate || row.scheduledDate
            const details = row.detailItems
                .map((item) => `${item.deliveryNumber || item.deliveryId} / ${item.destination} / Qty ${item.qty}`)
                .join(" | ")

            return [
                row.referenceNumber || "",
                row.entryType,
                row.invoiceNumber || "",
                date ? format(new Date(date), "yyyy-MM-dd") : "",
                row.isExternal ? row.vendorName || "" : row.driverName || "",
                details,
                row.shippingCost || 0,
                row.costGasolineDexlite || 0,
                row.costGasolineBio || 0,
                row.costToll || 0,
                row.costParking || 0,
                row.costMeals || 0,
                row.costMaintenance || 0,
                row.costOthers || 0,
                getInternalTotal(row),
            ].map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")
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
                        placeholder="Search reference, delivery, tujuan..."
                        value={globalFilter}
                        onChange={(e) => setGlobalFilter(e.target.value)}
                        className="pl-8"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={exportToCSV} variant="outline" className="flex items-center gap-2">
                        <Download className="h-4 w-4" />
                        Export CSV
                    </Button>

                    {isAdmin && (
                        <Button
                            variant="destructive"
                            onClick={handleClearCosts}
                            className="flex items-center gap-2"
                        >
                            <Trash2 className="h-4 w-4" />
                            Clear Costs Log
                        </Button>
                    )}
                </div>
            </div>

            <div className="rounded-md border bg-card overflow-hidden">
                <div className="max-h-[700px] overflow-auto">
                    <Table>
                        <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id} className="hover:bg-transparent">
                                    {headerGroup.headers.map((header) => (
                                        <TableHead key={header.id} className="whitespace-nowrap py-3 px-4 first:pl-6 last:pr-6"
                                            sortable={header.column.getCanSort()}
                                            sorted={header.column.getIsSorted()}
                                            onSort={header.column.getToggleSortingHandler()}
                                            showSortIndicator={typeof header.column.columnDef.header === "string"}
                                        >
                                            {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            {filteredRows.length > 0 ? (
                                filteredRows.map((row) => (
                                    <TableRow key={row.id} className="align-top">
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell key={cell.id} className="py-3 px-4 first:pl-6 last:pr-6">
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
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

