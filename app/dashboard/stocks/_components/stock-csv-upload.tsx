"use client"

import * as React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Upload, FileUp, X, Check } from "lucide-react"
import { toast } from "sonner"
import Papa from "papaparse"
import { importStocks } from "@/app/actions/stock"
import { getProducts } from "@/app/actions/product"
import { getWarehouses } from "@/app/actions/warehouse"
import { NewStock } from "@/lib/types"

type RawStockData = Record<string, string>
type StockData = NewStock

export function StockCSVUpload({ onSuccess }: { onSuccess?: () => void }) {
    const [file, setFile] = useState<File | null>(null)
    const [isUploading, setIsUploading] = useState(false)
    const [preview, setPreview] = useState<StockData[]>([])
    const [isOpen, setIsOpen] = useState(false)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (selectedFile) {
            setFile(selectedFile)
            parseFile(selectedFile)
        }
    }

    const parseFile = async (file: File) => {
        const [products, warehouses] = await Promise.all([
            getProducts(),
            getWarehouses()
        ])

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const data = results.data as RawStockData[]

                const normalized = (data.map(item => {
                    const keys = Object.keys(item)

                    const matKey = keys.find(k => k.toLowerCase().replace(/[^a-z]/g, "") === "materialnumber" || k.toLowerCase().replace(/[^a-z]/g, "") === "idinv")
                    const slocKey = keys.find(k => k.toLowerCase().replace(/[^a-z]/g, "") === "sloc" || k.toLowerCase().replace(/[^a-z]/g, "") === "storagelocation")
                    const qtyKey = keys.find(k => k.toLowerCase().replace(/[^a-z]/g, "") === "totalstock" || k.toLowerCase().replace(/[^a-z]/g, "") === "qtystock" || k.toLowerCase() === "quantity")
                    const valKey = keys.find(k => k.toLowerCase().replace(/[^a-z]/g, "") === "valuationvalue" || k.toLowerCase().replace(/[^a-z]/g, "") === "valuestock")
                    const minKey = keys.find(k => k.toLowerCase().replace(/[^a-z]/g, "") === "minstock")

                    const materialNumber = matKey ? item[matKey]?.toString().trim() : ""
                    const sloc = slocKey ? item[slocKey]?.toString().trim() : ""

                    const product = products.find(p => p.materialNumber === materialNumber)
                    const warehouse = warehouses.find(w => w.sloc === sloc)

                    if (!product || !warehouse) return null

                    return {
                        productId: product.id,
                        warehouseId: warehouse.id,
                        totalStock: qtyKey ? Number(item[qtyKey]) || 0 : 0,
                        valuationValue: valKey ? item[valKey]?.toString() || "0" : "0",
                        minStock: minKey ? Number(item[minKey]) || 0 : 0,
                    }
                }).filter(Boolean)) as StockData[]

                setPreview(normalized)
            },
            error: (error) => {
                toast.error("Failed to parse CSV: " + error.message)
            }
        })
    }

    const handleUpload = async () => {
        if (preview.length === 0) return

        setIsUploading(true)
        try {
            const result = await importStocks(preview)
            if (result.success) {
                toast.success(`Successfully imported stock data`)
                setIsOpen(false)
                setFile(null)
                setPreview([])
                onSuccess?.()
            } else {
                toast.error(result.error)
            }
        } catch (_error) {
            toast.error("Failed to import stock data")
        } finally {
            setIsUploading(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <Upload className="mr-2 h-4 w-4" />
                    Import CSV
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Import Stock Levels</DialogTitle>
                    <DialogDescription>
                        Upload a CSV file containing IDINV (Material #) and SLOC (Warehouse).
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {!file ? (
                        <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-12 text-center">
                            <input
                                type="file"
                                accept=".csv"
                                id="stock-csv-upload-input"
                                className="hidden"
                                onChange={handleFileChange}
                            />
                            <label
                                htmlFor="stock-csv-upload-input"
                                className="flex flex-col items-center cursor-pointer"
                            >
                                <FileUp className="h-12 w-12 text-muted-foreground mb-4" />
                                <span className="text-sm font-medium">Click to upload CSV</span>
                                <span className="text-xs text-muted-foreground mt-1">
                                    Must include IDINV and SLOC columns
                                </span>
                            </label>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between bg-muted p-2 rounded-lg">
                                <div className="flex items-center">
                                    <Check className="h-4 w-4 text-green-500 mr-2" />
                                    <span className="text-sm font-medium">{file.name}</span>
                                    <span className="text-xs text-muted-foreground ml-2">
                                        ({preview.length} valid mappings found)
                                    </span>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setFile(null)
                                        setPreview([])
                                    }}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>

                            <div className="flex justify-end gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setFile(null)
                                        setPreview([])
                                    }}
                                >
                                    Reset
                                </Button>
                                <Button onClick={handleUpload} disabled={isUploading || preview.length === 0}>
                                    {isUploading ? "Importing..." : "Start Import"}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
