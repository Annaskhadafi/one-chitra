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
import { importProducts } from "@/app/actions/product"
import { NewProduct } from "@/lib/types"

type RawProductData = Record<string, string>
type ProductData = NewProduct

export function ProductCSVUpload({ onSuccess }: { onSuccess?: () => void }) {
    const [file, setFile] = useState<File | null>(null)
    const [isUploading, setIsUploading] = useState(false)
    const [preview, setPreview] = useState<ProductData[]>([])
    const [isOpen, setIsOpen] = useState(false)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (selectedFile) {
            setFile(selectedFile)
            parseFile(selectedFile)
        }
    }

    const parseFile = (file: File) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const data = results.data as RawProductData[]
                const categories = ["ACC", "FLAP", "IMT PART", "MATERIAL CONSUMABLE", "SPM", "TUBE", "TYRE", "WHEEL & RIM"]

                const normalized = data.map(item => {
                    const keys = Object.keys(item)

                    const matKey = keys.find(k => k.toLowerCase().replace(/[^a-z]/g, "") === "materialnumber" || k.toLowerCase().replace(/[^a-z]/g, "") === "materialno")
                    const oldMatKey = keys.find(k => k.toLowerCase().replace(/[^a-z]/g, "") === "oldmaterialno" || k.toLowerCase().replace(/[^a-z]/g, "") === "oldmaterial")
                    const descKey = keys.find(k => k.toLowerCase().replace(/[^a-z]/g, "") === "materialdescription" || k.toLowerCase() === "description")
                    const catKey = keys.find(k => k.toLowerCase() === "category")
                    const plantKey = keys.find(k => k.toLowerCase() === "plant")
                    const slocKey = keys.find(k => k.toLowerCase() === "sloc")
                    const slocDescKey = keys.find(k => k.toLowerCase().replace(/[^a-z]/g, "") === "slocdescription")
                    const costKey = keys.find(k => k.toLowerCase().includes("cost") && k.toLowerCase().includes("sap"))

                    let category = (catKey ? item[catKey] : "TYRE").toUpperCase()
                    if (!categories.includes(category)) category = "TYRE"

                    return {
                        materialNumber: matKey ? item[matKey].toString() : "",
                        oldMaterialNo: oldMatKey ? item[oldMatKey].toString() : null,
                        materialDescription: descKey ? item[descKey].toString() : null,
                        category: category,
                        plant: plantKey ? item[plantKey].toString() : null,
                        sloc: slocKey ? item[slocKey].toString() : "",
                        slocDescription: slocDescKey ? item[slocDescKey].toString() : null,
                        costSap: costKey ? item[costKey].toString() : null,
                    }
                }).filter(item => item.materialNumber) as ProductData[]

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
            const result = await importProducts(preview)
            if (result.success) {
                toast.success(`Successfully imported products`)
                setIsOpen(false)
                setFile(null)
                setPreview([])
                onSuccess?.()
            } else {
                toast.error(result.error)
            }
        } catch (_error) {
            toast.error("Failed to import products")
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
                    <DialogTitle>Import Products</DialogTitle>
                    <DialogDescription>
                        Upload a CSV file containing product data.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {!file ? (
                        <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-12 text-center">
                            <input
                                type="file"
                                accept=".csv"
                                id="product-csv-upload"
                                className="hidden"
                                onChange={handleFileChange}
                            />
                            <label
                                htmlFor="product-csv-upload"
                                className="flex flex-col items-center cursor-pointer"
                            >
                                <FileUp className="h-12 w-12 text-muted-foreground mb-4" />
                                <span className="text-sm font-medium">Click to upload CSV</span>
                                <span className="text-xs text-muted-foreground mt-1">
                                    Must include Material Number column
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
                                        ({preview.length} valid rows)
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

                            {preview.length > 0 && (
                                <div className="max-h-[300px] overflow-auto border rounded-lg">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-muted sticky top-0">
                                            <tr>
                                                <th className="p-2 border-b">Plant</th>
                                                <th className="p-2 border-b">Material #</th>
                                                <th className="p-2 border-b">Old Mat #</th>
                                                <th className="p-2 border-b">Category</th>
                                                <th className="p-2 border-b">Description</th>
                                                <th className="p-2 border-b">Sloc</th>
                                                <th className="p-2 border-b">Sloc Desc</th>
                                                <th className="p-2 border-b">Cost SAP</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {preview.slice(0, 10).map((item, i) => (
                                                <tr key={i}>
                                                    <td className="p-2 border-b">{item.plant || "-"}</td>
                                                    <td className="p-2 border-b">{item.materialNumber}</td>
                                                    <td className="p-2 border-b">{item.oldMaterialNo || "-"}</td>
                                                    <td className="p-2 border-b">{item.category}</td>
                                                    <td className="p-2 border-b truncate max-w-[150px]">{item.materialDescription || "-"}</td>
                                                    <td className="p-2 border-b">{item.sloc || "-"}</td>
                                                    <td className="p-2 border-b truncate max-w-[100px]">{item.slocDescription || "-"}</td>
                                                    <td className="p-2 border-b">{item.costSap || "-"}</td>
                                                </tr>
                                            ))}
                                            {preview.length > 10 && (
                                                <tr>
                                                    <td colSpan={8} className="p-2 text-center text-muted-foreground italic">
                                                        ... and {preview.length - 10} more rows
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}

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
