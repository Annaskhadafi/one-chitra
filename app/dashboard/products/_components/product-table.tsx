
"use client"

import { useState, useEffect, useCallback } from "react"
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
import { getSetting, updateSetting, getRealtimeExchangeRate } from "@/app/actions/settings"
import { type Product } from "@/lib/types"
import { ProductDialog } from "./product-dialog"
import { ProductDetail } from "./product-detail"
import { ProductCSVUpload } from "./product-table-csv"
import { Search, Trash2, Pencil, Package, Layers, Tag, Eye } from "lucide-react"
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
import {
    Dialog,
    DialogContent,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { ScoreCard } from "@/components/score-card"
import { BulkActions } from "@/components/bulk-actions"

interface ProductTableProps {
    data: Product[]
}

function ImagePreview({ imageUrl, alt }: { imageUrl: string; alt: string }) {
    const [imageError, setImageError] = useState(false)
    const [isOpen, setIsOpen] = useState(false)

    const handleError = useCallback(() => {
        setImageError(true)
    }, [])

    // Reset error state when imageUrl changes
    useEffect(() => {
        setImageError(false)
    }, [imageUrl])

    // If image failed to load, show fallback
    if (imageError) {
        return (
            <div className="w-10 h-10 rounded bg-muted flex items-center justify-center text-muted-foreground">
                <Package className="h-5 w-5" />
            </div>
        )
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <div className="w-10 h-10 rounded overflow-hidden border cursor-pointer hover:opacity-80 transition-opacity flex items-center justify-center bg-muted/30">
                    <img
                        src={imageUrl}
                        alt={alt}
                        className="w-full h-full object-cover"
                        onError={handleError}
                    />
                </div>
            </DialogTrigger>
            <DialogContent className="max-w-3xl justify-center flex bg-transparent border-none shadow-none p-0">
                <img src={imageUrl} alt={alt} className="max-w-full max-h-[80vh] rounded-lg shadow-2xl" />
            </DialogContent>
        </Dialog>
    )
}

export function ProductTable({ data }: ProductTableProps) {
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedCategory, setSelectedCategory] = useState<string>("all")
    const [selectedIds, setSelectedIds] = useState<number[]>([])
    const [manualRate, setManualRate] = useState<number>(0)
    const [realtimeRate, setRealtimeRate] = useState<number>(0)

    useEffect(() => {
        const fetchRates = async () => {
            const mRate = await getSetting("manual_usd_rate")
            if (mRate) setManualRate(Number(mRate))

            const rRate = await getRealtimeExchangeRate()
            if (rRate.success && rRate.rate) setRealtimeRate(rRate.rate)
        }
        fetchRates()
    }, [])

    const handleRateChange = async () => {
        const newRate = prompt("Enter new Manual USD Rate (IDR):", manualRate.toString())
        if (newRate && !isNaN(Number(newRate))) {
            const res = await updateSetting("manual_usd_rate", newRate)
            if (res.success) {
                setManualRate(Number(newRate))
                toast.success("Manual rate updated")
            } else {
                toast.error("Failed to update rate")
            }
        }
    }

    // Stats calculation
    const totalProducts = data.length
    const categories = new Set(data.map(p => p.category)).size
    const uniqueMaterials = new Set(data.map(p => p.materialNumber)).size

    const CATEGORIES = ["ACC", "FLAP", "IMT PART", "Material Consumable", "SPM", "TUBE", "TYRE", "WHEEL & RIM"]

    const filteredData = data.filter(item => {
        const matchesSearch = item.materialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.materialDescription && item.materialDescription.toLowerCase().includes(searchTerm.toLowerCase())) ||
            item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.oldMaterialNo && item.oldMaterialNo.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (item.plant && item.plant.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (item.sloc && item.sloc.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (item.slocDescription && item.slocDescription.toLowerCase().includes(searchTerm.toLowerCase()))

        const matchesCategory = selectedCategory === "all" || item.category === selectedCategory

        return matchesSearch && matchesCategory
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

    const formatCurrency = (amount: number | string | null | undefined, currency: string = 'USD') => {
        if (!amount) return "-"
        const value = Number(amount)
        if (isNaN(value)) return "-"
        return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value)
    }

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
                <ScoreCard
                    title="Total Products"
                    value={totalProducts}
                    icon={Package}
                    description="Total items in catalog"
                    gradient="from-blue-500/10 via-blue-400/5 to-indigo-500/10 border-blue-200/50 dark:from-blue-500/20 dark:via-blue-400/10 dark:to-indigo-500/20 dark:border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/20"
                    iconColor="text-blue-600 dark:text-blue-400"
                    textColor="text-blue-900 dark:text-blue-100"
                />
                <div className="rounded-xl border bg-gradient-to-br from-violet-500/10 via-violet-400/5 to-fuchsia-500/10 border-violet-200/50 dark:from-violet-500/20 dark:via-violet-400/10 dark:to-fuchsia-500/20 dark:border-violet-500/30 hover:shadow-lg hover:shadow-violet-500/20 transition-all duration-300 text-card-foreground shadow p-6">
                    <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <h3 className="tracking-tight text-sm font-medium text-violet-900 dark:text-violet-100">Exchange Rates</h3>
                        <div className="rounded-lg p-2 bg-violet-600/10">
                            <Tag className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                        </div>
                    </div>
                    <div className="text-2xl font-bold text-violet-900 dark:text-violet-100">
                        <div className="text-xs text-violet-900/70 dark:text-violet-100/70 font-normal mb-1">Realtime: {formatCurrency(realtimeRate, 'IDR')}</div>
                        <div className="flex items-center gap-2">
                            <span>Manual: {formatCurrency(manualRate, 'IDR')}</span>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleRateChange}>
                                <Pencil className="h-3 w-3" />
                            </Button>
                        </div>
                    </div>
                </div>
                <ScoreCard
                    title="Categories"
                    value={categories}
                    icon={Layers}
                    description="Unique product categories"
                    gradient="from-emerald-500/10 via-emerald-400/5 to-teal-500/10 border-emerald-200/50 dark:from-emerald-500/20 dark:via-emerald-400/10 dark:to-teal-500/20 dark:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/20"
                    iconColor="text-emerald-600 dark:text-emerald-400"
                    textColor="text-emerald-900 dark:text-emerald-100"
                />
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                <div className="flex flex-col sm:flex-row gap-4 flex-1">
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search materials..."
                            className="pl-8"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                        <SelectTrigger className="w-full sm:w-[200px]">
                            <SelectValue placeholder="All Categories" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Categories</SelectItem>
                            {CATEGORIES.map(cat => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
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
                            <TableHead>Plant</TableHead>
                            <TableHead className="w-[60px]">Image</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Material Number</TableHead>
                            <TableHead>Old Material No.</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Sloc</TableHead>
                            <TableHead>Sloc Description</TableHead>
                            <TableHead>Cost SAP (USD)</TableHead>
                            <TableHead>Cost IDR</TableHead>
                            <TableHead className="w-[100px] text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={12} className="h-24 text-center">
                                    No products found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredData.map((item) => {
                                const costSap = Number(item.costSap || 0)
                                const costIdr = costSap * manualRate

                                return (
                                    <TableRow key={item.id}>
                                        <TableCell>
                                            <Checkbox
                                                checked={selectedIds.includes(item.id)}
                                                onCheckedChange={(checked) => handleSelectOne(!!checked, item.id)}
                                            />
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">{item.plant || "-"}</TableCell>
                                        <TableCell>
                                            {item.imageUrl ? (
                                                <ImagePreview imageUrl={item.imageUrl} alt={item.materialNumber} />
                                            ) : (
                                                <div className="w-10 h-10 rounded bg-muted flex items-center justify-center text-muted-foreground">
                                                    <Package className="h-5 w-5" />
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className="font-semibold">
                                                {item.category}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-medium text-blue-600">{item.materialNumber}</TableCell>
                                        <TableCell className="text-muted-foreground">{item.oldMaterialNo || "-"}</TableCell>
                                        <TableCell className="max-w-xs truncate">{item.materialDescription}</TableCell>
                                        <TableCell className="text-xs font-mono">{item.sloc || "-"}</TableCell>
                                        <TableCell className="max-w-[150px] truncate text-xs">{item.slocDescription || "-"}</TableCell>
                                        <TableCell>{formatCurrency(costSap)}</TableCell>
                                        <TableCell>{formatCurrency(costIdr, 'IDR')}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <ProductDetail product={item} manualRate={manualRate} />
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
                                )
                            })
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

