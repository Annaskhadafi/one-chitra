
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
import { deleteProduct, bulkDeleteProducts, bulkUpdateProductCategory } from "@/app/actions/product"
import { type Product } from "@/lib/types"
import { ProductDialog } from "./product-dialog"
import { ProductCSVUpload } from "./product-table-csv"
import { Search, Trash2, Pencil, Package, Layers, Tag } from "lucide-react"
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
import { Checkbox } from "@/components/ui/checkbox"
import { ScoreCard } from "@/components/score-card"
import { BulkActions } from "@/components/bulk-actions"

interface ProductTableProps {
    data: Product[]
}

export function ProductTable({ data }: ProductTableProps) {
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedIds, setSelectedIds] = useState<number[]>([])

    // Stats calculation
    const totalProducts = data.length
    const categories = new Set(data.map(p => p.category)).size
    const uniqueMaterials = new Set(data.map(p => p.materialNumber)).size

    const filteredData = data.filter(item => {
        const matchesSearch = item.materialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.materialDescription && item.materialDescription.toLowerCase().includes(searchTerm.toLowerCase())) ||
            item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.oldMaterialNo && item.oldMaterialNo.toLowerCase().includes(searchTerm.toLowerCase()))
        return matchesSearch
    })

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(filteredData.map(p => p.id))
        } else {
            setSelectedIds([])
        }
    }

    const handleSelectOne = (checked: boolean, productId: number) => {
        if (checked) {
            setSelectedIds(prev => [...prev, productId])
        } else {
            setSelectedIds(prev => prev.filter(id => id !== productId))
        }
    }

    const handleBulkDelete = async () => {
        if (confirm("Are you sure you want to delete selected products?")) {
            const result = await bulkDeleteProducts(selectedIds)
            if (result.success) {
                toast.success("Products deleted successfully")
                setSelectedIds([])
            } else {
                toast.error(result.error)
            }
        }
    }

    const handleBulkEditCategory = async () => {
        const category = prompt("Enter new category for selected products:")
        if (category) {
            const result = await bulkUpdateProductCategory(selectedIds, category)
            if (result.success) {
                toast.success("Product categories updated successfully")
                setSelectedIds([])
            } else {
                toast.error(result.error)
            }
        }
    }

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
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
                <ScoreCard
                    title="Total Products"
                    value={totalProducts}
                    icon={Package}
                    description="Total items in catalog"
                />
                <ScoreCard
                    title="Categories"
                    value={categories}
                    icon={Layers}
                    description="Unique product categories"
                />
                <ScoreCard
                    title="Unique Materials"
                    value={uniqueMaterials}
                    icon={Tag}
                    description="Distinct material numbers"
                />
            </div>

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
                            <TableHead className="w-[50px]">
                                <Checkbox
                                    checked={selectedIds.length === filteredData.length && filteredData.length > 0}
                                    onCheckedChange={handleSelectAll}
                                />
                            </TableHead>
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
                                <TableCell colSpan={6} className="h-24 text-center">
                                    No products found.
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

            <BulkActions
                selectedCount={selectedIds.length}
                onDelete={handleBulkDelete}
                onEdit={handleBulkEditCategory}
                entityName="product"
            />
        </div>
    )
}
