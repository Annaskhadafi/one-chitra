"use client"

import { useState, useMemo } from "react"
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Search, Plus } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { getStocks } from "@/app/actions/stock"
import { EvhsStockUsageDialog } from "./evhs-stock-usage-dialog"

type WarehouseOption = {
    id: number
    sloc: string
    description?: string | null
    type?: string | null
}

type StockRow = {
    id: number | string
    warehouseId: number
    totalStock: number
    productId: number
    product: {
        materialNumber: string
        materialDescription?: string | null
        materialNumberCk?: string | null
        category?: string | null
    }
}

type StockUsageDialogItem = {
    warehouseId: number
    productId: number
    materialNumberCp: string
    materialNumberCk?: string | null
    sn: string
    qty?: number
    availableQty?: number
    cpDo?: string | null
    sourceType?: "receipt" | "legacy-stock"
    product: {
        materialDescription?: string | null
        materialNumberCk?: string | null
        category?: string | null
    }
}

const toStockUsageDialogItem = (stock: StockRow): StockUsageDialogItem => ({
    warehouseId: stock.warehouseId,
    productId: stock.productId,
    materialNumberCp: stock.product.materialNumber,
    materialNumberCk: stock.product.materialNumberCk ?? null,
    sn: "-",
    qty: stock.totalStock,
    availableQty: stock.totalStock,
    cpDo: null,
    sourceType: "legacy-stock",
    product: {
        materialDescription: stock.product.materialDescription ?? null,
        materialNumberCk: stock.product.materialNumberCk ?? null,
        category: stock.product.category ?? null,
    },
})

export function EvhsStockTable({ warehouses }: { warehouses: WarehouseOption[] }) {
    const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(
        warehouses.find(w => w.type === "VHS")?.id.toString() || ""
    )
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedStock, setSelectedStock] = useState<StockUsageDialogItem | null>(null)
    const [usageDialogOpen, setUsageDialogOpen] = useState(false)

    // Filter VHS warehouses
    const vhsWarehouses = useMemo(() =>
        warehouses.filter(w => w.type === "VHS"),
    [warehouses])

    // Fetch stocks using React Query for better UX
    const { data: stocks = [], isLoading } = useQuery({
        queryKey: ["stocks", selectedWarehouseId],
        queryFn: async () => {
            const allStocks = await getStocks()
            return allStocks.filter((s: StockRow) => s.warehouseId === parseInt(selectedWarehouseId))
        },
        enabled: !!selectedWarehouseId
    })

    const filteredStocks = useMemo(() => {
        return stocks.filter((s: StockRow) =>
            s.product?.materialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.product?.materialDescription?.toLowerCase().includes(searchTerm.toLowerCase())
        )
    }, [stocks, searchTerm])

    return (
        <div className="space-y-4">
            <EvhsStockUsageDialog
                open={usageDialogOpen}
                onOpenChange={setUsageDialogOpen}
                trackingItem={selectedStock}
            />

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                    <div className="w-full sm:w-[250px]">
                        <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Pilih Site VHS" />
                            </SelectTrigger>
                            <SelectContent>
                                {vhsWarehouses.map((w) => (
                                    <SelectItem key={w.id} value={w.id.toString()}>
                                        {w.sloc} - {w.description}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Cari material..."
                            className="pl-8"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="rounded-md border bg-card overflow-x-auto">
                <Table className="min-w-[760px]">
                    <TableHeader>
                        <TableRow>
                            <TableHead>Material Number</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Stock At Site</TableHead>
                            <TableHead className="text-center">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">Loading stock...</TableCell>
                            </TableRow>
                        ) : filteredStocks.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                    Tidak ada stok ditemukan di site ini.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredStocks.map((stock) => (
                                <TableRow key={stock.id}>
                                    <TableCell className="font-medium text-blue-600">
                                        {stock.product.materialNumber}
                                    </TableCell>
                                    <TableCell className="max-w-[300px] truncate">
                                        {stock.product.materialDescription}
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-bold">
                                        {stock.totalStock}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="gap-2 h-8"
                                            onClick={() => {
                                                setSelectedStock(toStockUsageDialogItem(stock))
                                                setUsageDialogOpen(true)
                                            }}
                                        >
                                            <Plus className="h-4 w-4" />
                                            Input WO / Usage
                                        </Button>
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
