"use client"

import { useState, useMemo } from "react"
import { deleteStock, bulkDeleteStocks, bulkUpdateStockMinStock } from "@/app/actions/stock"
import { StockDialog } from "./stock-dialog"
import { StockCSVUpload } from "./stock-csv-upload"
import { Search, MoreHorizontal, Trash2, Pencil, Box, AlertTriangle, TrendingUp } from "lucide-react"
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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface StockTableProps {
    data: {
        id: number
        product: { materialNumber: string; materialDescription: string | null } | null
        warehouse: { sloc: string; description: string | null } | null
        totalStock: number
        minStock: number
        valuationValue: string // Changed to string as DB returns decimal/numeric as string often, or update based on schema
        productId: number
        warehouseId: number
    }[]
    products: { id: number; materialNumber: string; materialDescription: string | null }[]
    warehouses: { id: number; sloc: string; description: string | null }[]
}

export function StockTable({ data, products, warehouses }: StockTableProps) {
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedIds, setSelectedIds] = useState<number[]>([])

    // Stats calculation
    const totalStockItems = data.length
    const lowStockItems = data.filter(item => item.totalStock <= item.minStock).length
    const totalValuation = data.reduce((sum, item) => {
        const val = parseFloat(item.valuationValue)
        return sum + (isNaN(val) ? 0 : val)
    }, 0)

    const filteredData = useMemo(() => {
        return data.filter(item =>
            item.product?.materialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.product?.materialDescription?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.warehouse?.sloc.toLowerCase().includes(searchTerm.toLowerCase())
        )
    }, [data, searchTerm])

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
        if (confirm("Are you sure you want to delete selected stock entries?")) {
            const result = await bulkDeleteStocks(selectedIds)
            if (result.success) {
                toast.success("Stock entries deleted successfully")
                setSelectedIds([])
            } else {
                toast.error(result.error)
            }
        }
    }

    const handleBulkUpdateMinStock = async () => {
        const minStockStr = prompt("Enter new minimum stock level for selected items:")
        if (minStockStr) {
            const minStock = parseInt(minStockStr)
            if (isNaN(minStock)) {
                toast.error("Invalid number")
                return
            }
            const result = await bulkUpdateStockMinStock(selectedIds, minStock)
            if (result.success) {
                toast.success("Minimum stock levels updated successfully")
                setSelectedIds([])
            } else {
                toast.error(result.error)
            }
        }
    }

    const handleDelete = async (id: number) => {
        try {
            const result = await deleteStock(id)
            if (result.success) {
                toast.success("Stock entry deleted")
            } else {
                toast.error(result.error)
            }
        } catch (_error) {
            toast.error("Failed to delete stock")
        }
    }

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
                <ScoreCard
                    title="Total Stock Items"
                    value={totalStockItems}
                    icon={Box}
                    description="Unique stock keeping units"
                />
                <ScoreCard
                    title="Low Stock Items"
                    value={lowStockItems}
                    icon={AlertTriangle}
                    description="Items below minimum level"
                />
                <ScoreCard
                    title="Total Valuation"
                    value={`IDR ${totalValuation.toLocaleString()}`}
                    icon={TrendingUp}
                    description="Total inventory value"
                />
            </div>

            <div className="flex justify-between items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by material or sloc..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <StockCSVUpload />
                    <StockDialog products={products} warehouses={warehouses} />
                </div>
            </div>

            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50px]">
                                <Checkbox
                                    checked={selectedIds.length === filteredData.length && filteredData.length > 0}
                                    onCheckedChange={handleSelectAll}
                                />
                            </TableHead>
                            <TableHead>Material #</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Sloc</TableHead>
                            <TableHead className="text-right">Total Stock</TableHead>
                            <TableHead className="text-right">Min Stock</TableHead>
                            <TableHead className="text-right">Valuation</TableHead>
                            <TableHead className="w-[70px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="h-24 text-center">
                                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                                        <Box className="h-8 w-8 mb-2 opacity-20" />
                                        <p>No stock levels found</p>
                                    </div>
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
                                    <TableCell className="font-medium text-blue-600">
                                        {item.product?.materialNumber}
                                    </TableCell>
                                    <TableCell className="max-w-[200px] truncate">
                                        {item.product?.materialDescription}
                                    </TableCell>
                                    <TableCell>{item.warehouse?.sloc}</TableCell>
                                    <TableCell className="text-right font-mono">
                                        {item.totalStock.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-orange-600">
                                        {item.minStock?.toLocaleString() || 0}
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                        IDR {parseFloat(item.valuationValue).toLocaleString()}
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <StockDialog
                                                    stock={item}
                                                    products={products}
                                                    warehouses={warehouses}
                                                    trigger={
                                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                                            <Pencil className="mr-2 h-4 w-4" />
                                                            Edit
                                                        </DropdownMenuItem>
                                                    }
                                                />
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <DropdownMenuItem
                                                            onSelect={(e) => e.preventDefault()}
                                                            className="text-destructive focus:text-destructive"
                                                        >
                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                            Delete
                                                        </DropdownMenuItem>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                This will remove the stock record for this sloc. This action cannot be undone.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction
                                                                onClick={() => handleDelete(item.id)}
                                                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                            >
                                                                Delete
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
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
                onEdit={handleBulkUpdateMinStock}
                entityName="stock item"
            />
        </div>
    )
}
