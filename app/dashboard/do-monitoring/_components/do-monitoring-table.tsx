"use client"

import { useState } from "react"
import { EditDoDialog } from "./edit-do-dialog"
import { deleteDelivery } from "@/app/actions/delivery"
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
import { Search, MoreHorizontal, FileEdit, Trash2, Eye } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

export function DoMonitoringTable({ data }: { data: any[] }) {
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState("all")
    const [editDelivery, setEditDelivery] = useState<any | null>(null)
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [deleting, setDeleting] = useState<number | null>(null)

    const filtered = data.filter(d => {
        const s = search.toLowerCase()
        const matchesSearch = !search ||
            d.deliveryNumber?.toLowerCase().includes(s) ||
            d.salesOrder?.invoiceNumber?.toLowerCase().includes(s) ||
            d.salesOrder?.customer?.name?.toLowerCase().includes(s) ||
            d.invoiceNumber?.toLowerCase().includes(s)

        const matchesStatus = statusFilter === "all" || (d.doStatus || "Pending") === statusFilter
        return matchesSearch && matchesStatus
    })

    async function handleDelete(id: number) {
        setDeleting(id)
        const res = await deleteDelivery(id)
        if (res.success) {
            toast.success("Delivery deleted successfully")
        } else {
            toast.error(res.error || "Failed to delete delivery")
        }
        setDeleting(null)
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search DO, SO, Customer, Invoice..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-10"
                    />
                </div>
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

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Delivery/DO No</TableHead>
                            <TableHead>Return Date</TableHead>
                            <TableHead>DO Status</TableHead>
                            <TableHead>Invoice No</TableHead>
                            <TableHead>Invoice Date</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filtered.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                    No records found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filtered.map(delivery => (
                                <TableRow key={delivery.id}>
                                    <TableCell className="font-mono text-sm">
                                        <div className="font-medium text-blue-600 dark:text-blue-400">
                                            {delivery.deliveryNumber || "-"}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            SO: {delivery.salesOrder?.invoiceNumber || "-"}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {delivery.returnDoDate ? new Date(delivery.returnDoDate).toLocaleDateString("id-ID") : "-"}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={
                                            delivery.doStatus === "Returned" ? "default" :
                                                delivery.doStatus === "Lost" ? "destructive" : "secondary"
                                        }>
                                            {delivery.doStatus || "Pending"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="font-mono text-sm">
                                        {delivery.invoiceNumber || "-"}
                                    </TableCell>
                                    <TableCell>
                                        {delivery.invoiceDate ? new Date(delivery.invoiceDate).toLocaleDateString("id-ID") : "-"}
                                    </TableCell>
                                    <TableCell>
                                        {delivery.salesOrder?.customer?.name || "-"}
                                    </TableCell>
                                    <TableCell className="text-right">
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

                                                    <Link href={`/dashboard/deliveries/${delivery.id}`}>
                                                        <DropdownMenuItem>
                                                            <Eye className="mr-2 h-4 w-4" />
                                                            Detail Delivery
                                                        </DropdownMenuItem>
                                                    </Link>

                                                    <DropdownMenuItem
                                                        onClick={() => {
                                                            setEditDelivery(delivery)
                                                            setIsEditOpen(true)
                                                        }}
                                                    >
                                                        <FileEdit className="mr-2 h-4 w-4" />
                                                        Edit DO Info
                                                    </DropdownMenuItem>

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
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <EditDoDialog
                delivery={editDelivery}
                open={isEditOpen}
                onOpenChange={setIsEditOpen}
            />
        </div>
    )
}
