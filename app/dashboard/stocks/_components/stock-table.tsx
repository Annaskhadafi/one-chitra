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
        product: {
            materialNumber: string;
            materialDescription: string | null;
            plant: string | null;
            category: string;
            oldMaterialNo: string | null;
            costSap: string | null;
        } | null
        warehouse: { sloc: string; description: string | null; type: string | null } | null
        totalStock: number
        minStock: number
        valuationValue: string // Changed to string as DB returns decimal/numeric as string often, or update based on schema
        productId: number
        warehouseId: number
    }[]
    products: {
        id: number;
        materialNumber: string;
        materialDescription: string | null;
        plant: string | null;
        category: string;
        oldMaterialNo: string | null;
        costSap: string | null;
    }[]
    warehouses: { id: number; sloc: string; description: string | null; type: string | null }[]
}

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// ... imports remain same ...

export function StockTable({ data, products, warehouses }: StockTableProps) {
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedIds, setSelectedIds] = useState<number[]>([])
    const [activeTab, setActiveTab] = useState("all")

    // Extract unique warehouse types
    const warehouseTypes = useMemo(() => {
        const types = new Set(warehouses.map(w => w.type).filter(Boolean))
        return ["all", ...Array.from(types).sort()]
    }, [warehouses])

    // Filter data based on active tab and search term
    const filteredData = useMemo(() => {
        return data.filter(item => {
            // Tab filter
            const matchesTab = activeTab === "all" || item.warehouse?.type === activeTab

            // Search filter
            const matchesSearch =
                item.product?.materialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.product?.materialDescription?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.product?.oldMaterialNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.warehouse?.sloc.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.warehouse?.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.warehouse?.type?.toLowerCase().includes(searchTerm.toLowerCase())

            return matchesTab && matchesSearch
        })
    }, [data, searchTerm, activeTab])

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value)
    }

    const calculateValuation = (stock: number, costSap: string | null) => {
        if (!costSap) return 0
        // Remove any commas if present and parse
        const cost = parseFloat(costSap.toString().replace(/,/g, "")) || 0
        return stock * cost
    }

    // Stats calculation based on filtered data (current tab)
    const stats = useMemo(() => {
        return {
            totalItems: filteredData.length,
            lowStock: filteredData.filter(item => item.totalStock <= item.minStock).length,
            totalValuation: filteredData.reduce((sum, item) => {
                const val = parseFloat(item.valuationValue)
                return sum + (isNaN(val) ? 0 : val)
            }, 0)
        }
    }, [filteredData])

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
            <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <div className="flex items-center justify-between">
                    <TabsList>
                        <TabsTrigger value="all">All Stocks</TabsTrigger>
                        {warehouseTypes.filter(t => t !== "all").map(type => (
                            <TabsTrigger key={type} value={type as string}>
                                {type}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    <ScoreCard
                        title="Total Stock Items"
                        value={stats.totalItems}
                        icon={Box}
                        description={activeTab === 'all' ? "All unique stock units" : `Stock units in ${activeTab}`}
                    />
                    <ScoreCard
                        title="Low Stock Items"
                        value={stats.lowStock}
                        icon={AlertTriangle}
                        description="Items below minimum level"
                    />
                    <ScoreCard
                        title="Total Valuation"
                        value={`IDR ${stats.totalValuation.toLocaleString()}`}
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

                <TabsContent value={activeTab} className="m-0">
                    {/* Desktop View: Table */}
                    <div className="hidden md:block rounded-md border bg-card">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px]">
                                        <Checkbox
                                            checked={selectedIds.length === filteredData.length && filteredData.length > 0}
                                            onCheckedChange={handleSelectAll}
                                        />
                                    </TableHead>
                                    <TableHead>Plnt</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Material #</TableHead>
                                    <TableHead>Old Mat. No</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>SLoc</TableHead>
                                    <TableHead>Sloc Desc</TableHead>
                                    <TableHead className="text-right">Act Stock</TableHead>
                                    <TableHead className="text-right">Min Stock</TableHead>
                                    <TableHead className="text-right">Valuation</TableHead>
                                    <TableHead>Type Warehouse</TableHead>
                                    <TableHead className="w-[70px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={13} className="h-24 text-center">
                                            <div className="flex flex-col items-center justify-center text-muted-foreground">
                                                <Box className="h-8 w-8 mb-2 opacity-20" />
                                                <p>No stock levels found for {activeTab === 'all' ? 'any type' : activeTab}</p>
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
                                            <TableCell>{item.product?.plant || "-"}</TableCell>
                                            <TableCell>{item.product?.category || "-"}</TableCell>
                                            <TableCell className="font-medium text-blue-600">
                                                {item.product?.materialNumber}
                                            </TableCell>
                                            <TableCell>{item.product?.oldMaterialNo || "-"}</TableCell>
                                            <TableCell className="max-w-[200px] truncate" title={item.product?.materialDescription || ""}>
                                                {item.product?.materialDescription}
                                            </TableCell>
                                            <TableCell>{item.warehouse?.sloc}</TableCell>
                                            <TableCell className="max-w-[150px] truncate" title={item.warehouse?.description || ""}>
                                                {item.warehouse?.description}
                                            </TableCell>
                                            <TableCell className="text-right font-mono font-bold">
                                                {item.totalStock.toLocaleString()}
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-orange-600">
                                                {item.minStock?.toLocaleString() || 0}
                                            </TableCell>
                                            <TableCell className="text-right font-mono">
                                                {formatCurrency(calculateValuation(item.totalStock, item.product?.costSap ?? null))}
                                            </TableCell>
                                            <TableCell>
                                                <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
                                                    {item.warehouse?.type || "N/A"}
                                                </span>
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

                    {/* Mobile View: Cards */}
                    <div className="md:hidden grid grid-cols-1 gap-4">
                        {filteredData.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-8 text-center border rounded-lg bg-muted/20">
                                <Box className="h-10 w-10 text-muted-foreground/50 mb-3" />
                                <p className="text-muted-foreground font-medium">No stock items found.</p>
                                <p className="text-xs text-muted-foreground mt-1">Try adjusting your search or filters.</p>
                            </div>
                        ) : (
                            filteredData.map((item) => (
                                <div key={item.id} className="bg-card rounded-lg border shadow-sm overflow-hidden animate-in fade-in transition-all hover:shadow-md">
                                    <div className="p-4 space-y-3">
                                        <div className="flex justify-between items-start">
                                            <div className="space-y-1 flex-1 mr-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                                        {item.product?.materialNumber}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground border px-1.5 py-0.5 rounded">
                                                        {item.product?.category}
                                                    </span>
                                                </div>
                                                <h3 className="font-semibold text-sm leading-tight text-foreground">
                                                    {item.product?.materialDescription || "No Description"}
                                                </h3>
                                            </div>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2">
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
                                                                <AlertDialogTitle>Delete Stock Item?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    Are you sure you want to remove this stock record? This cannot be undone.
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
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 text-xs">
                                            <div className="space-y-1">
                                                <p className="text-muted-foreground">Warehouse</p>
                                                <div className="font-medium flex items-center gap-1.5">
                                                    <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                                                    {item.warehouse?.sloc}
                                                </div>
                                                <p className="text-muted-foreground/80 truncate">{item.warehouse?.description}</p>
                                                <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 bg-secondary rounded-sm">
                                                    {item.warehouse?.type || "Unknown Type"}
                                                </span>
                                            </div>
                                            <div className="space-y-1 text-right">
                                                <p className="text-muted-foreground">Current Stock</p>
                                                <div className="text-xl font-bold tracking-tight text-foreground">
                                                    {item.totalStock.toLocaleString()}
                                                </div>
                                                <p className="text-[10px] text-muted-foreground">
                                                    Min: <span className="text-orange-600 font-medium">{item.minStock?.toLocaleString() || 0}</span>
                                                </p>
                                                <p className="text-[10px] text-muted-foreground mt-1">
                                                    Val: <span className="font-medium text-foreground">{formatCurrency(calculateValuation(item.totalStock, item.product?.costSap ?? null))}</span>
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-muted/30 px-4 py-2 border-t flex justify-between items-center text-xs">
                                        <div className="flex items-center gap-2">
                                            <Checkbox
                                                id={`mobile-check-${item.id}`}
                                                checked={selectedIds.includes(item.id)}
                                                onCheckedChange={(checked) => handleSelectOne(!!checked, item.id)}
                                                className="h-3.5 w-3.5"
                                            />
                                            <label htmlFor={`mobile-check-${item.id}`} className="text-muted-foreground select-none">Select</label>
                                        </div>
                                        <div className="text-muted-foreground font-mono">
                                            {item.product?.plant || "N/A"}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </TabsContent>

                <BulkActions
                    selectedCount={selectedIds.length}
                    onDelete={handleBulkDelete}
                    onEdit={handleBulkUpdateMinStock}
                    entityName="stock item"
                />
            </Tabs>
        </div>
    )
}
