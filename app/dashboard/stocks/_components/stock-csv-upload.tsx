"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { importStocks } from "@/app/actions/stock"
import { getProducts } from "@/app/actions/product"
import { getWarehouses } from "@/app/actions/warehouse"
import { toast } from "sonner"
import { Upload, FileSpreadsheet } from "lucide-react"
import Papa from "papaparse"

export function StockCSVUpload() {
    const [isOpen, setIsOpen] = useState(false)
    const [file, setFile] = useState<File | null>(null)
    const [preview, setPreview] = useState<any[]>([])
    const [isUploading, setIsUploading] = useState(false)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (selectedFile) {
            setFile(selectedFile)
            parseFile(selectedFile)
        }
    }

    const parseFile = async (file: File) => {
        // Fetch products and warehouses for mapping
        const [products, warehouses] = await Promise.all([getProducts(), getWarehouses()])

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const data = results.data as any[]
                const normalized = data.map(item => {
                    const keys = Object.keys(item)
                    const itemKey = keys.find(k => k.toLowerCase() === "item")
                    const valKey = keys.find(k => k.toLowerCase().replace(/[^a-z]/g, "") === "valuationvalue")
                    const storeLocKey = keys.find(k => k.toLowerCase().replace(/[^a-z]/g, "") === "storeloc")
                    const totalStockKey = keys.find(k => k.toLowerCase().replace(/[^a-z]/g, "") === "totalstock")
                    const minStockKey = keys.find(k => k.toLowerCase().replace(/[^a-z]/g, "") === "minstock")

                    const materialNumber = itemKey ? item[itemKey]?.toString().trim() : ""
                    const sloc = storeLocKey ? item[storeLocKey]?.toString().trim() : ""

                    const product = products.find(p => p.materialNumber === materialNumber)
                    const warehouse = warehouses.find(w => w.sloc === sloc)

                    return {
                        productId: product?.id,
                        warehouseId: warehouse?.id,
                        materialNumber,
                        sloc,
                        valuationValue: valKey ? item[valKey] : "0",
                        totalStock: totalStockKey ? item[totalStockKey] : "0",
                        minStock: minStockKey ? item[minStockKey] : "0",
                        isValid: !!product && !!warehouse
                    }
                }).filter(item => item.materialNumber)

                setPreview(normalized)
            },
            error: (error) => {
                toast.error("Failed to parse CSV: " + error.message)
            }
        })
    }

    const handleUpload = async () => {
        const validItems = preview.filter(p => p.isValid)
        if (validItems.length === 0) {
            toast.error("No valid products/warehouses found in CSV")
            return
        }

        setIsUploading(true)
        try {
            const result = await importStocks(validItems)
            if (result.success) {
                toast.success(`Successfully imported ${result.count} stock entries`)
                setIsOpen(false)
                setFile(null)
                setPreview([])
            } else {
                toast.error(result.error)
            }
        } catch (error) {
            toast.error("Upload failed")
        } finally {
            setIsUploading(true)
        }
    }

    const invalidCount = preview.filter(p => !p.isValid).length

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <Upload className="mr-2 h-4 w-4" />
                    Import CSV
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Import Stock Levels</DialogTitle>
                    <DialogDescription>
                        Upload a CSV with columns: <strong>Item</strong>, <strong>Store Loc</strong>, <strong>Valuation Value</strong>, <strong>Min Stock</strong>, <strong>Total Stock</strong>.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <Input
                        type="file"
                        accept=".csv"
                        onChange={handleFileChange}
                    />

                    {preview.length > 0 && (
                        <div className="rounded-md bg-muted p-4 space-y-2">
                            <div className="flex items-center gap-2">
                                <FileSpreadsheet className="h-4 w-4 text-primary" />
                                <span className="text-sm font-medium">{preview.filter(p => p.isValid).length} valid rows</span>
                            </div>
                            {invalidCount > 0 && (
                                <div className="text-xs text-destructive font-medium">
                                    ⚠️ {invalidCount} rows have unknown Items or Store Locs and will be skipped.
                                </div>
                            )}
                            <div className="text-xs text-muted-foreground max-h-[100px] overflow-y-auto border-t pt-2 mt-2">
                                {preview.slice(0, 5).map((row, i) => (
                                    <div key={i} className={`truncate ${!row.isValid ? "text-destructive line-through" : ""}`}>
                                        [{row.sloc || "?"}] {row.materialNumber || "?"} - Qty: {row.totalStock} (Min: {row.minStock})
                                    </div>
                                ))}
                                {preview.length > 5 && <div>...and {preview.length - 5} more</div>}
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button onClick={handleUpload} disabled={!file || preview.length === 0 || isUploading} className="w-full">
                        {isUploading ? (
                            <>
                                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                                Importing...
                            </>
                        ) : (
                            "Import Valid Rows"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
