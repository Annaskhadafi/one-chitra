"use client"

import { useState } from "react"
import { deleteFleetTrip, updateFleetTripStatus } from "@/app/actions/fleet-trips"
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
import { Search, MoreHorizontal, Trash2, Pencil, Calendar, Truck, User, Download } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { usePermissions } from "@/hooks/use-permissions"

interface FleetTripWithRelations {
    id: number
    tripNumber: string
    status: string
    date: Date
    driver: { name: string } | null
    vehicle: { policeNumber: string; type: string } | null
    deliveries: { id: number; deliveryNumber: string | null }[]
    costGasoline: string | null
    costToll: string | null
    costParking: string | null
    costMeals: string | null
    costMaintenance: string | null
    costOthers: string | null
}

interface FleetTripTableProps {
    data: FleetTripWithRelations[]
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    scheduled: "secondary",
    in_transit: "default",
    completed: "outline", // using outline for completed to distinguish
    cancelled: "destructive",
}

export function FleetTripTable({ data }: FleetTripTableProps) {
    const [search, setSearch] = useState("")
    const [deleting, setDeleting] = useState<number | null>(null)

    const { hasResourcePermission } = usePermissions()
    const canEdit = hasResourcePermission('fleet-management', 'edit')
    const canDelete = hasResourcePermission('fleet-management', 'delete')

    const filtered = data.filter(trip => {
        const s = search.toLowerCase()
        return !search ||
            trip.tripNumber.toLowerCase().includes(s) ||
            trip.driver?.name.toLowerCase().includes(s) ||
            trip.vehicle?.policeNumber.toLowerCase().includes(s)
    })

    async function handleDelete(id: number) {
        setDeleting(id)
        const res = await deleteFleetTrip(id)
        if (res.success) {
            toast.success("Trip deleted successfully")
        } else {
            toast.error(res.error || "Failed to delete trip")
        }
        setDeleting(null)
    }

    const handleExport = () => {
        const headers = ["Trip Number", "Date", "Status", "Driver", "Vehicle", "Deliveries", "Total Cost"]
        const csvData = filtered.map(trip => [
            trip.tripNumber,
            new Date(trip.date).toLocaleDateString("id-ID"),
            trip.status,
            trip.driver?.name || "",
            trip.vehicle?.policeNumber || "",
            trip.deliveries.length,
            calculateTotalCost(trip)
        ])

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

    const handleUpdateStatus = async (id: number, status: string) => {
        const result = await updateFleetTripStatus(id, status)
        if (result.success) {
            toast.success("Status updated")
        } else {
            toast.error(result.error)
        }
    }

    const calculateTotalCost = (trip: FleetTripWithRelations) => {
        return (Number(trip.costGasoline) || 0) +
            (Number(trip.costToll) || 0) +
            (Number(trip.costParking) || 0) +
            (Number(trip.costMeals) || 0) +
            (Number(trip.costMaintenance) || 0) +
            (Number(trip.costOthers) || 0)
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search trip number, driver, vehicle..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-8"
                    />
                </div>
                <Button variant="outline" onClick={handleExport}>
                    <Download className="mr-2 h-4 w-4" />
                    Export CSV
                </Button>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Trip Number</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Driver</TableHead>
                            <TableHead>Vehicle</TableHead>
                            <TableHead className="text-right">Deliveries</TableHead>
                            <TableHead className="text-right">Total Cost</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filtered.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                    No trips found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filtered.map((trip) => (
                                <TableRow key={trip.id}>
                                    <TableCell className="font-mono font-medium">{trip.tripNumber}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Calendar className="h-3 w-3 text-muted-foreground" />
                                            {new Date(trip.date).toLocaleDateString("id-ID")}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {canEdit ? (
                                            <Select
                                                defaultValue={trip.status}
                                                onValueChange={(value) => handleUpdateStatus(trip.id, value)}
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
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <User className="h-3 w-3 text-muted-foreground" />
                                            {trip.driver?.name || "-"}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Truck className="h-3 w-3 text-muted-foreground" />
                                            {trip.vehicle?.policeNumber || "-"}
                                            <span className="text-xs text-muted-foreground">({trip.vehicle?.type})</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Badge variant="secondary">{trip.deliveries.length}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                        {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(calculateTotalCost(trip))}
                                    </TableCell>
                                    <TableCell className="text-right">
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
                                                                    onClick={() => handleDelete(trip.id)}
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
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
