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
import { importProducts } from "@/app/actions/product"
import { toast } from "sonner"
import { Upload, FileSpreadsheet } from "lucide-react"
import Papa from "papaparse"

export function ProductCSVUpload() {
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

    const parseFile = (file: File) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const data = results.data as any[]
                // Normalize keys (case insensitive)
                const normalized = data.map(item => {
                    const keys = Object.keys(item)
                    const categoryKey = keys.find(k => k.toLowerCase() === "category" || k.toLowerCase() === "categori")
                    const matNumKey = keys.find(k => k.toLowerCase().replace(/[^a-z]/g, "") === "materialnumber")
                    const oldMatKey = keys.find(k => k.toLowerCase().replace(/[^a-z]/g, "") === "oldmaterialno")
                    const descKey = keys.find(k => k.toLowerCase().replace(/[^a-z]/g, "") === "materialdescription")

                    return {
                        category: categoryKey ? item[categoryKey] : "TYRE",
                        materialNumber: matNumKey ? item[matNumKey] : "",
                        oldMaterialNo: oldMatKey ? item[oldMatKey] : "",
                        materialDescription: descKey ? item[descKey] : "",
                    }
                }).filter(item => item.materialNumber) // Filter invalid rows

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
                toast.success(`Successfully imported ${result.count} products`)
                setIsOpen(false)
                setFile(null)
                setPreview([])
            } else {
                toast.error(result.error)
            }
        } catch (error) {
            toast.error("Upload failed")
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
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Import Products</DialogTitle>
                    <DialogDescription>
                        Upload a CSV file with columns: <strong>Category</strong>, <strong>Material Number</strong>, <strong>Old material no.</strong>, <strong>Material Description</strong>.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <Input
                        type="file"
                        accept=".csv"
                        onChange={handleFileChange}
                    />

                    {preview.length > 0 && (
                        <div className="rounded-md bg-muted p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <FileSpreadsheet className="h-4 w-4" />
                                <span className="text-sm font-medium">{preview.length} valid rows found</span>
                            </div>
                            <div className="text-xs text-muted-foreground max-h-[100px] overflow-y-auto">
                                {preview.slice(0, 5).map((row, i) => (
                                    <div key={i} className="truncate">
                                        [{row.category}] {row.materialNumber}
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
                            "Import"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
