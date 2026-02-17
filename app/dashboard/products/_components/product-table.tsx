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
import { deleteProduct } from "@/app/actions/product"
import { type Product } from "@/lib/types"
import { ProductDialog } from "./product-dialog"
import { ProductCSVUpload } from "./product-table-csv"
import { Search, Trash2, Pencil } from "lucide-react"
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

interface ProductTableProps {
    data: Product[]
}

export function ProductTable({ data }: ProductTableProps) {
    const [searchTerm, setSearchTerm] = useState("")

    const filteredData = data.filter(item =>
        item.materialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.materialDescription && item.materialDescription.toLowerCase().includes(searchTerm.toLowerCase())) ||
        item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.oldMaterialNo && item.oldMaterialNo.toLowerCase().includes(searchTerm.toLowerCase()))
    )

    const handleDelete = async (id: number) => {
        try {
            const result = await deleteProduct(id)
            if (result.success) {
                toast.success("Product deleted")
            } else {
                toast.error(result.error)
            }
        } catch (_error) {
            toast.error("Failed to delete product")
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search materials..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <ProductCSVUpload />
                    <ProductDialog />
                </div>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Category</TableHead>
                            <TableHead>Material Number</TableHead>
                            <TableHead>Old Material No.</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="w-[100px] text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    No products found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredData.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell>
                                        <Badge variant="secondary" className="font-semibold">
                                            {item.category}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="font-medium text-blue-600">{item.materialNumber}</TableCell>
                                    <TableCell className="text-muted-foreground">{item.oldMaterialNo || "-"}</TableCell>
                                    <TableCell className="max-w-xs">{item.materialDescription}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <ProductDialog
                                                product={item}
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
                                                        <AlertDialogTitle>Delete Product</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Are you sure you want to delete {item.materialNumber}? This action cannot be undone.
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
