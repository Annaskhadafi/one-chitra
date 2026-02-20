"use client"

import { useState } from "react"
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
import { deleteCustomer, bulkDeleteCustomers } from "@/app/actions/customer"
import { CustomerDialog } from "./customer-dialog"
import { CustomerCSVUpload } from "./customer-table-csv"
import { Search, Pencil, Trash2, Users, UserPlus } from "lucide-react"
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

export function CustomerTable({ customers: initialCustomers }: { customers: Customer[] }) {
    const { hasResourcePermission } = usePermissions()
    const canCreate = hasResourcePermission('customers', 'create')
    const canEdit = hasResourcePermission('customers', 'edit')
    const canDelete = hasResourcePermission('customers', 'delete')

    const [searchTerm, setSearchTerm] = useState("")
    const [selectedIds, setSelectedIds] = useState<number[]>([])

    // Stats calculation
    const totalCustomers = initialCustomers.length
    const newCustomers = initialCustomers.filter(c => {
        const date = new Date(c.createdAt)
        const now = new Date()
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
    }).length

    const filteredData = initialCustomers.filter(item =>
        item.customerCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.email && item.email.toLowerCase().includes(searchTerm.toLowerCase()))
    )

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(filteredData.map(item => item.id))
        } else {
            setSelectedIds([])
        }
    }

    const handleSelectOne = (checked: boolean, id: number) => {
        if (checked) {
            setSelectedIds(prev => [...prev, id])
        } else {
            setSelectedIds(prev => prev.filter(i => i !== id))
        }
    }

    const handleBulkDelete = async () => {
        if (confirm("Are you sure you want to delete selected customers?")) {
            const result = await bulkDeleteCustomers(selectedIds)
            if (result.success) {
                toast.success("Customers deleted successfully")
                setSelectedIds([])
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
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
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
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px]">
                                    <Checkbox
                                        checked={selectedIds.length === filteredData.length && filteredData.length > 0}
                                        onCheckedChange={handleSelectAll}
                                    />
                                </TableHead>
                                <TableHead className="w-[120px]">ID (Code)</TableHead>
                                <TableHead>Customer Name</TableHead>
                                <TableHead>Contact</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Address (Primary)</TableHead>
                                <TableHead className="w-[100px] text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center">
                                        No customers found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredData.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell>
                                            <Checkbox
                                                checked={selectedIds.includes(item.id)}
                                                onCheckedChange={(checked) => handleSelectOne(!!checked, item.id)}
                                            />
                                        </TableCell>
                                        <TableCell className="font-medium text-blue-600 font-mono">
                                            {item.customerCode}
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            {item.name}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-sm">
                                            {item.contactName || "-"}
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            {item.email || "-"}
                                        </TableCell>
                                        <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                                            {item.address1 || "-"}
                                        </TableCell>
                                        <TableCell className="text-right">
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
                                                                <AlertDialogAction onClick={() => handleDelete(item.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                                                    Delete
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
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
