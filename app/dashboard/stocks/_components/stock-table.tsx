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
import { deleteStock } from "@/app/actions/stock"
import { StockDialog } from "./stock-dialog"
import { StockCSVUpload } from "./stock-csv-upload"
import { Search, Pencil, Trash2, Box } from "lucide-react"
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
import { Badge } from "@/components/ui/badge"

interface StockTableProps {
    data: any[]
}

export function StockTable({ data }: StockTableProps) {
    const [searchTerm, setSearchTerm] = useState("")

    const filteredData = data.filter(item =>
        item.item.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.materialDescription && item.materialDescription.toLowerCase().includes(searchTerm.toLowerCase())) ||
        item.storeLoc.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const handleDelete = async (id: number) => {
        try {
            const result = await deleteStock(id)
            if (result.success) {
                toast.success("Stock entry deleted")
            } else {
                toast.error(result.error)
            }
        } catch (error) {
            toast.error("Failed to delete")
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search stock..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <StockCSVUpload />
                    <StockDialog />
                </div>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Item</TableHead>
                            <TableHead>Material Description</TableHead>
                            <TableHead>Old Material No.</TableHead>
                            <TableHead className="text-right">Valuation Value</TableHead>
                            <TableHead>Store Loc</TableHead>
                            <TableHead>SLoc</TableHead>
                            <TableHead className="text-right">Min Stock</TableHead>
                            <TableHead className="text-right">Total Stock</TableHead>
                            <TableHead className="w-[80px] text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="h-24 text-center">
                                    No stock levels found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredData.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium text-blue-600 font-mono text-xs">
                                        {item.item}
                                    </TableCell>
                                    <TableCell className="max-w-[200px] truncate text-xs">
                                        {item.materialDescription}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-xs">
                                        {item.oldMaterialNo || "-"}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-xs">
                                        {parseFloat(item.valuationValue).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="font-mono">
                                            {item.storeLoc}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs italic text-muted-foreground">
                                        {item.slocDescription}
                                    </TableCell>
                                    <TableCell className="text-right font-medium text-muted-foreground">
                                        {item.minStock}
                                    </TableCell>
                                    <TableCell className="text-right font-bold">
                                        {item.totalStock}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <StockDialog
                                                stock={item}
                                                trigger={
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </Button>
                                                }
                                            />

                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Delete Stock Entry</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Are you sure you want to remove {item.item} from {item.storeLoc}? This will only delete the stock link, not the product itself.
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
                                        </div>
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
