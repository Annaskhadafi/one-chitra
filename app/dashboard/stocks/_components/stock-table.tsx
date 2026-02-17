"use client"

import { useState, useMemo } from "react"
import { deleteStock } from "@/app/actions/stock"
import { StockDialog } from "./stock-dialog"
import { StockCSVUpload } from "./stock-csv-upload"
import { Search, MoreHorizontal, Trash2, Pencil, Box } from "lucide-react"
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

    const filteredData = useMemo(() => {
        return data.filter(item =>
            item.product?.materialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.product?.materialDescription?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.warehouse?.sloc.toLowerCase().includes(searchTerm.toLowerCase())
        )
    }, [data, searchTerm])

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
        <div className="space-y-4">
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
                                <TableCell colSpan={7} className="h-24 text-center">
                                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                                        <Box className="h-8 w-8 mb-2 opacity-20" />
                                        <p>No stock levels found</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredData.map((item) => (
                                <TableRow key={item.id}>
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
                                        IDR {item.valuationValue.toLocaleString()}
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
        </div>
    )
}
