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
    DialogFooter
} from "@/components/ui/dialog"
import { Upload, FileUp, X, Check, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import Papa from "papaparse"
import { importWarehouses, checkWarehouseImport } from "@/app/actions/warehouse"
import { NewWarehouse } from "@/lib/types"

type RawWarehouseData = Record<string, string>
type WarehouseData = NewWarehouse

export function WarehouseCSVUpload({ onSuccess }: { onSuccess?: () => void }) {
    const [file, setFile] = useState<File | null>(null)
    const [isUploading, setIsUploading] = useState(false)
    const [preview, setPreview] = useState<WarehouseData[]>([])
    const [isOpen, setIsOpen] = useState(false)

    // Import analysis state
    const [isAnalyzing, setIsAnalyzing] = useState(false)
    const [analysis, setAnalysis] = useState<{
        existingCount: number,
        newCount: number,
        existingSlocs: string[],
        newSlocs: string[]
    } | null>(null)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (selectedFile) {
            setFile(selectedFile)
            setAnalysis(null)
            parseFile(selectedFile)
        }
    }

    const parseFile = (file: File) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const data = results.data as RawWarehouseData[]

                const normalized = data.map(item => {
                    const keys = Object.keys(item)

                    const slocKey = keys.find(k => k.toLowerCase().replace(/[^a-z]/g, "") === "sloc" || k.toLowerCase().replace(/[^a-z]/g, "") === "warehouseid")
                    const descKey = keys.find(k => k.toLowerCase().replace(/[^a-z]/g, "") === "description" || k.toLowerCase().replace(/[^a-z]/g, "") === "slocdesc")

                    return {
                        sloc: slocKey ? item[slocKey].toString().trim() : "",
                        description: descKey ? item[descKey].toString() : null,
                    }
                }).filter(item => item.sloc) as WarehouseData[]

                setPreview(normalized)
                analyzeImport(normalized)
            },
            error: (error) => {
                toast.error("Failed to parse CSV: " + error.message)
            }
        })
    }

    const analyzeImport = async (data: WarehouseData[]) => {
        setIsAnalyzing(true)
        try {
            const slocs = data.map(d => d.sloc)
            const result = await checkWarehouseImport(slocs)

            if (result.success && result.existingSlocs && result.newSlocs) {
                setAnalysis({
                    existingCount: result.existingCount || 0,
                    newCount: result.newCount || 0,
                    existingSlocs: result.existingSlocs,
                    newSlocs: result.newSlocs
                })
            }
        } catch (error) {
            console.error("Analysis failed", error)
        } finally {
            setIsAnalyzing(false)
        }
    }

    const handleUpload = async (mode: 'update' | 'skip') => {
        if (preview.length === 0) return

        setIsUploading(true)
        try {
            const result = await importWarehouses(preview, mode)
            if (result.success) {
                toast.success(`Successfully processed ${result.count} warehouses`)
                setIsOpen(false)
                setFile(null)
                setPreview([])
                setAnalysis(null)
                onSuccess?.()
            } else {
                toast.error(result.error)
            }
        } catch (_error) {
            toast.error("Failed to import warehouses")
        } finally {
            setIsUploading(false)
        }
    }

    const reset = () => {
        setFile(null)
        setPreview([])
        setAnalysis(null)
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            setIsOpen(open)
            if (!open) reset()
        }}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <Upload className="mr-2 h-4 w-4" />
                    Import CSV
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Import Warehouses</DialogTitle>
                    <DialogDescription>
                        Upload a CSV file with SLOC and Description.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {!file ? (
                        <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-12 text-center">
                            <input
                                type="file"
                                accept=".csv"
                                id="warehouse-csv-upload"
                                className="hidden"
                                onChange={handleFileChange}
                            />
                            <label
                                htmlFor="warehouse-csv-upload"
                                className="flex flex-col items-center cursor-pointer"
                            >
                                <FileUp className="h-12 w-12 text-muted-foreground mb-4" />
                                <span className="text-sm font-medium">Click to upload CSV</span>
                                <span className="text-xs text-muted-foreground mt-1">
                                    Must include SLOC column
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
                                    onClick={reset}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>

                            {isAnalyzing ? (
                                <div className="py-4 text-center text-sm text-muted-foreground">
                                    Analyzing import data...
                                </div>
                            ) : analysis ? (
                                <div className="rounded-md border p-4 bg-muted/50">
                                    <h4 className="font-medium mb-2">Import Summary</h4>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="text-muted-foreground">New Records:</span>
                                            <span className="ml-2 font-mono font-bold text-green-600">{analysis.newCount}</span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Existing Records:</span>
                                            <span className="ml-2 font-mono font-bold text-amber-600">{analysis.existingCount}</span>
                                        </div>
                                    </div>

                                    {analysis.existingCount > 0 && (
                                        <div className="mt-3 flex items-start gap-2 text-amber-600 bg-amber-50 p-2 rounded text-xs">
                                            <AlertTriangle className="h-4 w-4 shrink-0" />
                                            <p>
                                                {analysis.existingCount} records already exist in the database.
                                                You can choose to update them with new data or skip them.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ) : null}

                            <DialogFooter className="gap-2 sm:gap-0">
                                <Button
                                    variant="outline"
                                    onClick={reset}
                                >
                                    Cancel
                                </Button>

                                {analysis && analysis.existingCount > 0 ? (
                                    <>
                                        <Button
                                            variant="secondary"
                                            onClick={() => handleUpload('skip')}
                                            disabled={isUploading}
                                        >
                                            {isUploading ? "Importing..." : "Skip Existing"}
                                        </Button>
                                        <Button
                                            onClick={() => handleUpload('update')}
                                            disabled={isUploading}
                                        >
                                            {isUploading ? "Importing..." : "Update & Add"}
                                        </Button>
                                    </>
                                ) : (
                                    <Button
                                        onClick={() => handleUpload('update')}
                                        disabled={isUploading || isAnalyzing || preview.length === 0}
                                    >
                                        {isUploading ? "Importing..." : "Import All"}
                                    </Button>
                                )}
                            </DialogFooter>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
