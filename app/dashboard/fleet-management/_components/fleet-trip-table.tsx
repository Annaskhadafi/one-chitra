"use client"

import * as React from "react"
import { useState, useMemo, useRef } from "react"
import { deleteFleetTrip, updateFleetTripStatus, getFleetTrips } from "@/app/actions/fleet-trips"
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
import { Search, MoreHorizontal, Trash2, Pencil, Calendar, Truck, User, Download, RefreshCcw, ChevronUp, ChevronDown, Loader2 } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { usePermissions } from "@/hooks/use-permissions"
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

interface FleetTripWithRelations {
    id: number
    tripNumber: string
    status: string
    date: Date
    driver: { name: string } | null
    vehicle: { policeNumber: string; type: string } | null
    deliveries: { id: number; deliveryNumber: string | null }[]
    costGasolineDexlite: string | null
    costGasolineBio: string | null
    costToll: string | null
    costParking: string | null
    costMeals: string | null
    costMaintenance: string | null
    costOthers: string | null
    costRapidTest: string | null
    costFerry: string | null
    costPortal: string | null
    costWashing: string | null
    costEscort: string | null
}

interface FleetTripTableProps {
    data: FleetTripWithRelations[]
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    scheduled: "secondary",
    in_transit: "default",
    completed: "outline",
    cancelled: "destructive",
}

export function FleetTripTable({ data: initialData }: FleetTripTableProps) {
    const { data: trips = initialData, isLoading, refetch } = useQuery({
        queryKey: ["fleet-trips"],
        queryFn: async () => {
            return await getFleetTrips()
        },
        staleTime: 60 * 1000,
    })

    const [globalFilter, setGlobalFilter] = useState("")
    const [sorting, setSorting] = useState<SortingState>([])
    const [deleting, setDeleting] = useState<number | null>(null)

    const { hasResourcePermission } = usePermissions()
    const canEdit = hasResourcePermission('fleet-management', 'edit')
    const canDelete = hasResourcePermission('fleet-management', 'delete')

    const calculateTotalCost = (trip: FleetTripWithRelations) => {
        return (Number(trip.costGasolineDexlite) || 0) +
            (Number(trip.costGasolineBio) || 0) +
            (Number(trip.costToll) || 0) +
            (Number(trip.costParking) || 0) +
            (Number(trip.costMeals) || 0) +
            (Number(trip.costMaintenance) || 0) +
            (Number(trip.costOthers) || 0) +
            (Number(trip.costRapidTest) || 0) +
            (Number(trip.costFerry) || 0) +
            (Number(trip.costPortal) || 0) +
            (Number(trip.costWashing) || 0) +
            (Number(trip.costEscort) || 0)
    }

    const columns = useMemo<ColumnDef<FleetTripWithRelations>[]>(() => [
        {
            accessorKey: "tripNumber",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4 h-8">
                    Trip Number
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
            cell: ({ row }) => <span className="font-mono font-medium">{row.original.tripNumber}</span>,
        },
        {
            accessorKey: "date",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4 h-8">
                    Date
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    {new Date(row.original.date).toLocaleDateString("id-ID")}
                </div>
            ),
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => {
                const trip = row.original
                return canEdit ? (
                    <Select
                        defaultValue={trip.status}
                        onValueChange={async (value) => {
                            const result = await updateFleetTripStatus(trip.id, value)
                            if (result.success) {
                                toast.success("Status updated")
                                refetch()
                            } else {
                                toast.error(result.error)
                            }
                        }}
                    >
                        <SelectTrigger className={`h-8 w-[120px] text-xs font-medium border-none shadow-none focus:ring-0 ${statusVariants[trip.status] === 'default' ? 'bg-primary text-primary-foreground' :
                            statusVariants[trip.status] === 'secondary' ? 'bg-secondary text-secondary-foreground' :
                                statusVariants[trip.status] === 'destructive' ? 'bg-destructive text-destructive-foreground' : 'bg-outline'
                            }`}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="scheduled">Scheduled</SelectItem>
                            <SelectItem value="in_transit">In Transit</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                    </Select>
                ) : (
                    <Badge variant={statusVariants[trip.status] || "secondary"} className="capitalize">
                        {trip.status.replace("_", " ")}
                    </Badge>
                )
            },
        },
        {
            accessorKey: "driver.name",
            header: "Driver",
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <User className="h-3 w-3 text-muted-foreground" />
                    {row.original.driver?.name || "-"}
                </div>
            ),
        },
        {
            accessorKey: "vehicle.policeNumber",
            header: "Vehicle",
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <Truck className="h-3 w-3 text-muted-foreground" />
                    {row.original.vehicle?.policeNumber || "-"}
                    <span className="text-xs text-muted-foreground">({row.original.vehicle?.type})</span>
                </div>
            ),
        },
        {
            id: "deliveries",
            header: () => <div className="text-right">Deliveries</div>,
            cell: ({ row }) => (
                <div className="text-right">
                    <Badge variant="secondary">{row.original.deliveries.length}</Badge>
                </div>
            ),
        },
        {
            id: "totalCost",
            header: () => <div className="text-right">Total Cost</div>,
            cell: ({ row }) => (
                <div className="text-right font-mono">
                    {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(calculateTotalCost(row.original))}
                </div>
            ),
        },
        {
            id: "actions",
            cell: ({ row }) => {
                const trip = row.original
                return (
                    <div className="text-right">
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
                                    <Link href={`/dashboard/fleet-management/${trip.id}`}>
                                        <DropdownMenuItem>
                                            <Pencil className="mr-2 h-4 w-4" />
                                            Edit / Details
                                        </DropdownMenuItem>
                                    </Link>
                                )}
                                {canDelete && (
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600">
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Delete
                                            </DropdownMenuItem>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Delete Trip?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    This will permanently delete this trip and unlink associated deliveries.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction
                                                    onClick={async () => {
                                                        setDeleting(trip.id)
                                                        const res = await deleteFleetTrip(trip.id)
                                                        if (res.success) {
                                                            toast.success("Trip deleted successfully")
                                                            refetch()
                                                        } else {
                                                            toast.error(res.error || "Failed to delete trip")
                                                        }
                                                        setDeleting(null)
                                                    }}
                                                    className="bg-red-600 hover:bg-red-700"
                                                >
                                                    {deleting === trip.id ? "Deleting..." : "Delete"}
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                )
            },
        },
    ], [canEdit, canDelete, deleting, refetch])

    const table = useReactTable({
        data: trips,
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
        globalFilterFn: (row, _columnId, filterValue): boolean => {
            const term = (filterValue as string).toLowerCase()
            const trip = row.original

            return !!(
                trip.tripNumber.toLowerCase().includes(term) ||
                trip.driver?.name?.toLowerCase().includes(term) ||
                trip.vehicle?.policeNumber?.toLowerCase().includes(term) ||
                trip.status?.toLowerCase().includes(term)
            )
        },
    })

    const { rows } = table.getRowModel()
    const parentRef = useRef<HTMLDivElement>(null)

    const rowVirtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 45,
        overscan: 10,
    })

    const [before, after] = rowVirtualizer.getVirtualItems().length > 0
        ? [
            rowVirtualizer.getVirtualItems()[0].start,
            rowVirtualizer.getTotalSize() - rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1].end,
        ]
        : [0, 0]

    const handleExport = () => {
        const headers = ["Trip Number", "Date", "Status", "Driver", "Vehicle", "Deliveries", "BBM (Dexlite)", "BBM (Bio Solar)", "Toll", "Parkir", "Meals", "Maintenance", "Rapid Test", "Ferry", "Portal", "Washing", "Escort", "Others", "Total Cost"]
        const csvData = table.getFilteredRowModel().rows.map(row => {
            const trip = row.original
            return [
                trip.tripNumber,
                new Date(trip.date).toLocaleDateString("id-ID"),
                trip.status,
                trip.driver?.name || "",
                trip.vehicle?.policeNumber || "",
                trip.deliveries.length,
                trip.costGasolineDexlite || 0,
                trip.costGasolineBio || 0,
                trip.costToll || 0,
                trip.costParking || 0,
                trip.costMeals || 0,
                trip.costMaintenance || 0,
                trip.costRapidTest || 0,
                trip.costFerry || 0,
                trip.costPortal || 0,
                trip.costWashing || 0,
                trip.costEscort || 0,
                trip.costOthers || 0,
                calculateTotalCost(trip)
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
        link.setAttribute("download", `fleet-trips-${new Date().toISOString().slice(0, 10)}.csv`)
        link.style.visibility = "hidden"
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    if (isLoading && !trips.length) {
        return (
            <div className="h-[400px] flex flex-col items-center justify-center gap-4 border rounded-lg bg-card/50">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Fetching Fleet Trips...</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search trip number, driver, vehicle..."
                        value={globalFilter}
                        onChange={(e) => setGlobalFilter(e.target.value)}
                        className="pl-8"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => refetch()}>
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        Refresh
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExport}>
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV
                    </Button>
                </div>
            </div>

            <div className="rounded-md border bg-card">
                <div
                    ref={parentRef}
                    className="h-[600px] overflow-auto relative scrollbar-thin scrollbar-thumb-accent"
                >
                    <Table>
                        <TableHeader>
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
                                        <TableCell colSpan={8} />
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
                                        <TableCell colSpan={8} />
                                    </TableRow>
                                </>
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                                        No trips found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
            <div className="text-sm text-muted-foreground">
                Showing {table.getFilteredRowModel().rows.length} of {trips.length} records
            </div>
        </div>
    )
}
