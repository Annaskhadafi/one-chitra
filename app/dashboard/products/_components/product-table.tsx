"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
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
import { deleteProduct, bulkDeleteProducts, bulkUpdateProductCategory, getProducts } from "@/app/actions/product"
import { getSetting, updateSetting, getRealtimeExchangeRate } from "@/app/actions/settings"
import { type Product } from "@/lib/types"
import { ProductDialog } from "./product-dialog"
import { ProductDetail } from "./product-detail"
import { ProductCSVUpload } from "./product-table-csv"
import { Search, Trash2, Pencil, Package, Layers, Tag, ChevronUp, ChevronDown } from "lucide-react"
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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    ColumnDef,
    flexRender,
    SortingState,
} from "@tanstack/react-table"
import { useVirtualizer } from "@tanstack/react-virtual"

interface ProductTableProps {
    data: Product[]
}

function ImagePreview({ imageUrl, alt }: { imageUrl: string; alt: string }) {
    const [imageError, setImageError] = useState(false)
    const [isOpen, setIsOpen] = useState(false)

    const handleError = useCallback(() => {
        setImageError(true)
    }, [])

    useEffect(() => {
        setImageError(false)
    }, [imageUrl])

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

export function ProductTable({ data: initialData }: ProductTableProps) {
    const queryClient = useQueryClient()
    const { data = initialData } = useQuery({
        queryKey: ["products"],
        queryFn: getProducts,
        initialData,
    })

    // Mutations
    const updateCategoryMutation = useMutation({
        mutationFn: ({ ids, category }: { ids: number[], category: string }) => bulkUpdateProductCategory(ids, category),
        onMutate: async ({ ids, category }) => {
            await queryClient.cancelQueries({ queryKey: ["products"] })
            const previousProducts = queryClient.getQueryData<Product[]>(["products"])

            if (previousProducts) {
                queryClient.setQueryData<Product[]>(["products"], (old) =>
                    old?.map(product => ids.includes(product.id) ? { ...product, category } : product)
                )
            }

            return { previousProducts }
        },
        onError: (err, variables, context) => {
            if (context?.previousProducts) {
                queryClient.setQueryData(["products"], context.previousProducts)
            }
            toast.error("Failed to update categories")
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["products"] })
        },
    })

    const deleteMutation = useMutation({
        mutationFn: (ids: number[]) => ids.length === 1 ? deleteProduct(ids[0]) : bulkDeleteProducts(ids),
        onMutate: async (ids) => {
            await queryClient.cancelQueries({ queryKey: ["products"] })
            const previousProducts = queryClient.getQueryData<Product[]>(["products"])

            if (previousProducts) {
                queryClient.setQueryData<Product[]>(["products"], (old) =>
                    old?.filter(product => !ids.includes(product.id))
                )
            }

            return { previousProducts }
        },
        onError: (err, variables, context) => {
            if (context?.previousProducts) {
                queryClient.setQueryData(["products"], context.previousProducts)
            }
            toast.error("Failed to delete product(s)")
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["products"] })
        },
    })

    const { hasResourcePermission } = usePermissions()
    const canCreate = hasResourcePermission('products', 'create')
    const canEdit = hasResourcePermission('products', 'edit')
    const canDelete = hasResourcePermission('products', 'delete')

    const [globalFilter, setGlobalFilter] = useState("")
    const [selectedCategory, setSelectedCategory] = useState<string>("all")
    const [sorting, setSorting] = useState<SortingState>([{ id: "materialNumber", desc: false }])
    const [rowSelection, setRowSelection] = useState({})

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

    const totalProducts = data.length
    const categoriesCount = new Set(data.map(p => p.category)).size
    const CATEGORIES = ["ACC", "FLAP", "IMT PART", "Material Consumable", "SPM", "TUBE", "TYRE", "WHEEL & RIM"]

    const formatCurrency = (amount: number | string | null | undefined, currency: string = 'USD') => {
        if (!amount) return "-"
        const value = Number(amount)
        if (isNaN(value)) return "-"
        return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value)
    }

    const columns = useMemo<ColumnDef<Product>[]>(() => [
        {
            id: "select",
            header: ({ table }) => (
                <Checkbox
                    checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="Select all"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label="Select row"
                />
            ),
            enableSorting: false,
            enableHiding: false,
        },
        {
            id: "stock",
            header: "Stock",
            cell: ({ row }) => <span className="font-mono text-xs">{row.original.totalStock ?? 0}</span>,
        },
        {
            id: "image",
            header: "Image",
            cell: ({ row }) => {
                const item = row.original
                return item.imageUrl ? (
                    <ImagePreview imageUrl={item.imageUrl} alt={item.materialNumber} />
                ) : (
                    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center text-muted-foreground">
                        <Package className="h-5 w-5" />
                    </div>
                )
            },
        },
        {
            accessorKey: "category",
            header: "Category",
            cell: ({ row }) => (
                <Badge variant="secondary" className="font-semibold">
                    {row.original.category}
                </Badge>
            ),
        },
        {
            accessorKey: "brand",
            header: "Brand",
            cell: ({ row }) => row.original.brand || "-",
        },
        {
            accessorKey: "materialNumber",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="-ml-4 h-8"
                >
                    Material Number
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
            cell: ({ row }) => <span className="font-medium text-blue-600">{row.original.materialNumber}</span>,
        },
        {
            accessorKey: "oldMaterialNo",
            header: "Old Material No.",
            cell: ({ row }) => <span className="text-muted-foreground">{row.original.oldMaterialNo || "-"}</span>,
        },
        {
            accessorKey: "materialDescription",
            header: "Description",
            cell: ({ row }) => <div className="max-w-xs truncate">{row.original.materialDescription}</div>,
        },
        {
            accessorKey: "sloc",
            header: "WH",
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="text-xs font-bold text-blue-700">{row.original.slocDescription || "-"}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">{row.original.sloc || "-"}</span>
                </div>
            ),
        },
        {
            accessorKey: "costSap",
            header: "Cost SAP (USD)",
            cell: ({ row }) => formatCurrency(row.original.costSap),
        },
        {
            id: "costIdr",
            header: "Cost IDR",
            cell: ({ row }) => {
                const costSap = Number(row.original.costSap || 0)
                const costIdr = costSap * manualRate
                return formatCurrency(costIdr, 'IDR')
            },
        },
        {
            id: "actions",
            header: () => <div className="text-right">Actions</div>,
            cell: ({ row }) => {
                const item = row.original
                return (
                    <div className="flex justify-end gap-2">
                        <ProductDetail product={item} manualRate={manualRate} />
                        {canEdit && (
                            <ProductDialog
                                product={item}
                                onSuccess={() => queryClient.invalidateQueries({ queryKey: ["products"] })}
                                trigger={
                                    <Button variant="ghost" size="icon">
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                }
                            />
                        )}

                        {canDelete && (
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
                        )}
                    </div>
                )
            },
        },
    ], [canEdit, canDelete, manualRate])

    const table = useReactTable({
        data,
        columns,
        state: {
            sorting,
            globalFilter,
            rowSelection,
        },
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        onRowSelectionChange: setRowSelection,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        globalFilterFn: (row, columnId, filterValue) => {
            const term = filterValue.toLowerCase()
            const item = row.original
            const matchesSearch = !!(
                item.materialNumber.toLowerCase().includes(term) ||
                (item.materialDescription && item.materialDescription.toLowerCase().includes(term)) ||
                item.category.toLowerCase().includes(term) ||
                (item.oldMaterialNo && item.oldMaterialNo.toLowerCase().includes(term)) ||
                (item.plant && item.plant.toLowerCase().includes(term)) ||
                (item.sloc && item.sloc.toLowerCase().includes(term)) ||
                (item.slocDescription && item.slocDescription.toLowerCase().includes(term))
            )

            const matchesCategory = selectedCategory === "all" || item.category === selectedCategory
            return matchesSearch && matchesCategory
        },
    })

    // Effect to trigger table filter when category changes
    useEffect(() => {
        table.setGlobalFilter(globalFilter)
    }, [selectedCategory, globalFilter, table])

    // Virtualization
    const parentRef = useRef<HTMLDivElement>(null)
    const { rows } = table.getRowModel()

    const rowVirtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 53,
        overscan: 20,
    })

    const [before, after] = rowVirtualizer.getVirtualItems().length > 0
        ? [
            rowVirtualizer.getVirtualItems()[0].start,
            rowVirtualizer.getTotalSize() - rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1].end,
        ]
        : [0, 0]

    const handleBulkDelete = async () => {
        const selectedIds = table.getSelectedRowModel().flatRows.map(r => r.original.id)
        if (confirm("Are you sure you want to delete selected products?")) {
            deleteMutation.mutate(selectedIds, {
                onSuccess: (result) => {
                    if (result.success) {
                        toast.success("Products deleted successfully")
                        setRowSelection({})
                    } else {
                        toast.error(result.error)
                    }
                }
            })
        }
    }

    const handleBulkEditCategory = async () => {
        const selectedIds = table.getSelectedRowModel().flatRows.map(r => r.original.id)
        const category = prompt("Enter new category for selected products:")
        if (category) {
            updateCategoryMutation.mutate({ ids: selectedIds, category }, {
                onSuccess: (result) => {
                    if (result.success) {
                        toast.success("Product categories updated successfully")
                        setRowSelection({})
                    } else {
                        toast.error(result.error)
                    }
                }
            })
        }
    }

    const handleDelete = async (id: number) => {
        deleteMutation.mutate([id], {
            onSuccess: () => toast.success("Product deleted")
        })
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
                    value={categoriesCount}
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
                            value={globalFilter ?? ""}
                            onChange={(e) => setGlobalFilter(e.target.value)}
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
                    {canCreate && (
                        <>
                            <ProductCSVUpload />
                            <ProductDialog onSuccess={() => queryClient.invalidateQueries({ queryKey: ["products"] })} />
                        </>
                    )}
                </div>
            </div>

            <div className="rounded-md border overflow-hidden">
                <div
                    ref={parentRef}
                    className="overflow-auto h-[600px] relative scrollbar-thin scrollbar-thumb-accent"
                >
                    <Table>
                        <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => (
                                        <TableHead key={header.id}>
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            {rowVirtualizer.getVirtualItems().length > 0 ? (
                                <>
                                    <TableRow style={{ height: `${before}px` }} className="border-none">
                                        <TableCell colSpan={columns.length} className="p-0" />
                                    </TableRow>
                                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                        const row = rows[virtualRow.index]
                                        return (
                                            <TableRow
                                                key={row.id}
                                                data-state={row.getIsSelected() && "selected"}
                                            >
                                                {row.getVisibleCells().map((cell) => (
                                                    <TableCell key={cell.id}>
                                                        {flexRender(
                                                            cell.column.columnDef.cell,
                                                            cell.getContext()
                                                        )}
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        )
                                    })}
                                    <TableRow
                                        style={{ height: `${after}px` }}
                                        className="border-none"
                                    >
                                        <TableCell colSpan={columns.length} className="p-0" />
                                    </TableRow>
                                </>
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={columns.length} className="h-24 text-center">
                                        No entries found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {table.getSelectedRowModel().flatRows.length > 0 && (canEdit || canDelete) && (
                <BulkActions
                    selectedCount={table.getSelectedRowModel().flatRows.length}
                    onDelete={canDelete ? handleBulkDelete : () => { }}
                    onEdit={canEdit ? handleBulkEditCategory : () => { }}
                    entityName="product"
                />
            )}
        </div>
    )
}

