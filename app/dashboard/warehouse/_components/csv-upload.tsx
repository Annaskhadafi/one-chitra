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
import { importWarehouses } from "@/app/actions/warehouse"
import { toast } from "sonner"
import { Upload, FileSpreadsheet } from "lucide-react"
import Papa from "papaparse"

export function CSVUpload() {
    const [isOpen, setIsOpen] = useState(false)
    const [file, setFile] = useState<File | null>(null)
    const [preview, setPreview] = useState<{ sloc: string; description: string }[]>([])
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
                    const slocKey = keys.find(k => k.toLowerCase() === "sloc")
                    const descKey = keys.find(k => k.toLowerCase() === "description")
                    return {
                        sloc: slocKey ? item[slocKey] : "",
                        description: descKey ? item[descKey] : "",
                    }
                }).filter(item => item.sloc) // Filter invalid rows

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
            const result = await importWarehouses(preview)
            if (result.success) {
                toast.success(`Successfully imported ${result.count} warehouses`)
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
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Import Warehouses</DialogTitle>
                    <DialogDescription>
                        Upload a CSV file with columns: <strong>Sloc</strong>, <strong>Description</strong>.
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
                                        {row.sloc} - {row.description}
                                    </div>
                                ))}
                                {preview.length > 5 && <div>...and {preview.length - 5} more</div>}
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button onClick={handleUpload} disabled={!file || preview.length === 0 || isUploading}>
                        {isUploading ? "Importing..." : "Import"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
