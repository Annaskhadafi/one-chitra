"use client"

import * as React from "react"
import { Upload, FileUp, Loader2, Check, X } from "lucide-react"
import * as XLSX from "xlsx"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { getProducts } from "@/app/actions/product"
import { importStocks } from "@/app/actions/stock"
import { getWarehouses } from "@/app/actions/warehouse"

type ParsedRow = {
    productId: number
    warehouseId: number
    totalStock: number
    valuationValue: string
    minStock: number
}

type RawRow = Record<string, string | number | null | undefined>

function normalizeHeader(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]/g, "")
}

function normalizeSloc(value: string | number | null | undefined) {
    const raw = String(value ?? "").trim()
    if (!raw) return ""
    if (/^\d+$/.test(raw)) return String(parseInt(raw, 10))
    return raw.toUpperCase()
}

function normalizeMaterial(value: string | number | null | undefined) {
    return String(value ?? "").trim().toUpperCase()
}

function getCellValue(row: RawRow, aliases: string[]) {
    const entries = Object.entries(row)
    const matchedEntry = entries.find(([key]) => aliases.includes(normalizeHeader(key)))
    return matchedEntry?.[1]
}

export function InventoryImportDialog({ onSuccess }: { onSuccess?: () => void }) {
    const [isOpen, setIsOpen] = React.useState(false)
    const [file, setFile] = React.useState<File | null>(null)
    const [preview, setPreview] = React.useState<ParsedRow[]>([])
    const [isParsing, setIsParsing] = React.useState(false)
    const [isUploading, setIsUploading] = React.useState(false)
    const inputId = React.useId()

    const resetState = () => {
        setFile(null)
        setPreview([])
        setIsParsing(false)
        setIsUploading(false)
    }

    const parseFile = async (selectedFile: File) => {
        setIsParsing(true)
        try {
            const [products, warehouses] = await Promise.all([
                getProducts(),
                getWarehouses(),
            ])

            const warehouseBySloc = new Map(
                warehouses.map((warehouse) => [normalizeSloc(warehouse.sloc), warehouse])
            )
            const productByMaterial = new Map<string, (typeof products)[number]>()

            for (const product of products) {
                const candidates = [
                    product.materialNumber,
                    product.materialNumberCk,
                    product.oldMaterialNo,
                ]

                for (const candidate of candidates) {
                    const normalized = normalizeMaterial(candidate)
                    if (normalized && !productByMaterial.has(normalized)) {
                        productByMaterial.set(normalized, product)
                    }
                }
            }

            const buffer = await selectedFile.arrayBuffer()
            const workbook = XLSX.read(buffer, { type: "array" })
            const firstSheetName = workbook.SheetNames[0]

            if (!firstSheetName) {
                toast.error("File Excel tidak memiliki sheet")
                setPreview([])
                return
            }

            const worksheet = workbook.Sheets[firstSheetName]
            const rows = XLSX.utils.sheet_to_json<RawRow>(worksheet, {
                defval: "",
            })

            const normalizedRows = rows.map((row) => {
                const materialNumber = normalizeMaterial(getCellValue(row, ["materialnumber", "idinv", "material", "materialno"]))
                const sloc = normalizeSloc(getCellValue(row, ["sloc", "storagelocation", "storloc", "warehouse"]))
                const totalStockRaw = getCellValue(row, ["actstock", "totalstock", "qtystock", "stock", "qty"])
                const valuationValueRaw = getCellValue(row, ["valuationvalue", "valuestock", "valuation", "value"])
                const minStockRaw = getCellValue(row, ["minstock", "minimumstock"])

                const product = productByMaterial.get(materialNumber)
                const warehouse = warehouseBySloc.get(sloc)

                if (!product || !warehouse) {
                    return null
                }

                return {
                    productId: product.id,
                    warehouseId: warehouse.id,
                    totalStock: Number(totalStockRaw) || 0,
                    valuationValue: String(valuationValueRaw ?? "0"),
                    minStock: Number(minStockRaw) || 0,
                }
            }).filter(Boolean) as ParsedRow[]

            setPreview(normalizedRows)

            if (normalizedRows.length === 0) {
                toast.error("Tidak ada baris valid yang cocok dengan material dan SLOC")
            }
        } catch (error) {
            console.error("Inventory import parse error:", error)
            toast.error("Gagal membaca file Excel")
            setPreview([])
        } finally {
            setIsParsing(false)
        }
    }

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0]
        if (!selectedFile) return

        setFile(selectedFile)
        await parseFile(selectedFile)
    }

    const handleImport = async () => {
        if (preview.length === 0) return

        setIsUploading(true)
        try {
            const result = await importStocks(preview)
            if (result.success) {
                toast.success("Import inventory berhasil", {
                    description: `${preview.length} baris valid diproses`,
                })
                setIsOpen(false)
                resetState()
                onSuccess?.()
            } else {
                toast.error(result.error || "Import inventory gagal")
            }
        } catch (error) {
            console.error("Inventory import error:", error)
            toast.error("Import inventory gagal")
        } finally {
            setIsUploading(false)
        }
    }

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                setIsOpen(open)
                if (!open) resetState()
            }}
        >
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="shrink-0">
                    <Upload className="mr-2 h-4 w-4" />
                    Import Excel
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[620px]">
                <DialogHeader>
                    <DialogTitle>Import Inventory dari Excel</DialogTitle>
                    <DialogDescription>
                        Upload file `.xlsx`, `.xls`, atau `.csv` dengan kolom material number/IDINV, SLOC, stock, dan optional min stock.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {!file ? (
                        <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 p-12 text-center">
                            <input
                                id={inputId}
                                type="file"
                                accept=".xlsx,.xls,.csv"
                                className="hidden"
                                onChange={handleFileChange}
                            />
                            <label htmlFor={inputId} className="flex cursor-pointer flex-col items-center">
                                <FileUp className="mb-4 h-12 w-12 text-muted-foreground" />
                                <span className="text-sm font-medium">Klik untuk upload file Excel</span>
                                <span className="mt-1 text-xs text-muted-foreground">
                                    Kolom minimal: material number/IDINV, SLOC, dan stock
                                </span>
                            </label>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between rounded-lg bg-muted p-3">
                                <div className="flex items-center">
                                    {isParsing ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" />
                                    ) : (
                                        <Check className="mr-2 h-4 w-4 text-green-500" />
                                    )}
                                    <div>
                                        <div className="text-sm font-medium">{file.name}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {isParsing ? "Membaca file..." : `${preview.length} baris valid siap diimport`}
                                        </div>
                                    </div>
                                </div>
                                <Button variant="ghost" size="sm" onClick={resetState}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>

                            <div className="rounded-md border p-3 text-sm text-muted-foreground">
                                Baris yang material atau SLOC-nya tidak cocok dengan master data akan dilewati otomatis.
                            </div>

                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={resetState}>
                                    Reset
                                </Button>
                                <Button onClick={handleImport} disabled={isParsing || isUploading || preview.length === 0}>
                                    {isUploading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Importing...
                                        </>
                                    ) : (
                                        "Start Import"
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
