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
import { Upload, FileUp, X, Check, AlertTriangle, ArrowRight, Download, FileSpreadsheet } from "lucide-react"
import { toast } from "sonner"
import Papa from "papaparse"
import { importWarehouses, checkWarehouseImport } from "@/app/actions/warehouse"
import { NewWarehouse } from "@/lib/types"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type RawWarehouseData = Record<string, string>
type WarehouseData = NewWarehouse

type Mapping = {
    sloc: string
    description: string
    type: string
}

type Step = 'upload' | 'mapping' | 'confirm'

export function WarehouseCSVUpload({ onSuccess }: { onSuccess?: () => void }) {
    const [file, setFile] = useState<File | null>(null)
    const [isUploading, setIsUploading] = useState(false)
    const [preview, setPreview] = useState<WarehouseData[]>([])
    const [isOpen, setIsOpen] = useState(false)

    // Multi-step state
    const [step, setStep] = useState<Step>('upload')
    const [csvHeaders, setCsvHeaders] = useState<string[]>([])
    const [mapping, setMapping] = useState<Mapping>({ sloc: '', description: '', type: '' })
    const [rawData, setRawData] = useState<RawWarehouseData[]>([])

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
            setStep('upload') // Reset step
            parseHeaders(selectedFile)
        }
    }

    const parseHeaders = (file: File) => {
        Papa.parse(file, {
            header: true,
            preview: 1, // Read only first row to get headers
            skipEmptyLines: true,
            complete: (results) => {
                if (results.meta.fields) {
                    setCsvHeaders(results.meta.fields)
                    // Auto-detect mapping
                    const sloc = results.meta.fields.find(f => /sloc|code|id/i.test(f)) || ''
                    const desc = results.meta.fields.find(f => /desc|name|keterangan/i.test(f)) || ''
                    const type = results.meta.fields.find(f => /type|tipe|jenis/i.test(f)) || ''
                    setMapping({ sloc, description: desc, type })
                    setStep('mapping') // Move to mapping step immediately
                }
            },
            error: (error) => {
                toast.error("Failed to parse CSV headers: " + error.message)
            }
        })
    }

    const parseFullFile = () => {
        if (!file) return

        setIsAnalyzing(true)
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const data = results.data as RawWarehouseData[]
                setRawData(data)

                // Normalize using mapping
                const normalized = data.map(item => ({
                    sloc: item[mapping.sloc]?.toString().trim() || "",
                    description: mapping.description && mapping.description !== '__none__' ? item[mapping.description]?.toString() : null,
                    type: mapping.type && mapping.type !== '__none__' ? item[mapping.type]?.toString() : null,
                })).filter(item => item.sloc) as WarehouseData[]

                setPreview(normalized)
                analyzeImport(normalized)
            },
            error: (error) => {
                setIsAnalyzing(false)
                toast.error("Failed to parse CSV: " + error.message)
            }
        })
    }

    const analyzeImport = async (data: WarehouseData[]) => {
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
                setStep('confirm')
            }
        } catch (error) {
            console.error("Analysis failed", error)
            toast.error("Failed to analyze import data")
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
                reset()
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
        setStep('upload')
        setCsvHeaders([])
        setMapping({ sloc: '', description: '', type: '' })
        setRawData([])
    }

    const downloadTemplate = () => {
        const csvContent = "data:text/csv;charset=utf-8,Sloc,Description,Type\nEXAMPLE01,Contoh Gudang 1,MAIN\nEXAMPLE02,Contoh Gudang 2,BRANCH"
        const encodedUri = encodeURI(csvContent)
        const link = document.createElement("a")
        link.setAttribute("href", encodedUri)
        link.setAttribute("download", "warehouse_template.csv")
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            setIsOpen(open)
            if (!open) reset()
        }}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <Upload className="mr-2 h-4 w-4" />
                    Import / Export
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>
                        {step === 'upload' ? 'Import / Export Warehouses' :
                            step === 'mapping' ? 'Map CSV Columns' :
                                'Confirm Import'}
                    </DialogTitle>
                    <DialogDescription>
                        {step === 'upload' ? 'Upload a CSV file or download current data.' :
                            step === 'mapping' ? 'Match your CSV columns to the database fields.' :
                                'Review the import summary before proceeding.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {step === 'upload' && (
                        <div className="space-y-4">
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
                                            Supported: .csv
                                        </span>
                                    </label>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between bg-muted p-2 rounded-lg">
                                    <div className="flex items-center">
                                        <FileSpreadsheet className="h-4 w-4 text-green-600 mr-2" />
                                        <span className="text-sm font-medium">{file.name}</span>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={reset}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}

                            <div className="flex justify-between items-center pt-4 border-t">
                                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                                    <Download className="mr-2 h-3 w-3" />
                                    Download Template
                                </Button>
                                <div className="text-xs text-muted-foreground">
                                    For &quot;Export All&quot;, use the table action.
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'mapping' && (
                        <div className="space-y-4">
                            <div className="grid gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="mapping-sloc">Sloc (Required) <span className="text-red-500">*</span></Label>
                                    <Select
                                        value={mapping.sloc}
                                        onValueChange={(val) => setMapping(prev => ({ ...prev, sloc: val }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select CSV Column" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {csvHeaders.map(header => (
                                                <SelectItem key={header} value={header}>{header}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[0.8rem] text-muted-foreground">
                                        Maps to the warehouse identity code (Storage Location).
                                    </p>
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="mapping-desc">Description</Label>
                                    <Select
                                        value={mapping.description}
                                        onValueChange={(val) => setMapping(prev => ({ ...prev, description: val }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select CSV Column (Optional)" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__none__">-- Skip --</SelectItem>
                                            {csvHeaders.map(header => (
                                                <SelectItem key={header} value={header}>{header}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <DialogFooter>
                                <Button variant="outline" onClick={() => setStep('upload')}>Back</Button>
                                <Button
                                    onClick={parseFullFile}
                                    disabled={!mapping.sloc || isAnalyzing}
                                >
                                    {isAnalyzing ? "Analyzing..." : "Next: Verify"}
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </DialogFooter>
                        </div>
                    )}

                    {step === 'confirm' && isAnalyzing ? (
                        <div className="py-8 text-center text-sm text-muted-foreground">
                            Analyzing import data...
                        </div>
                    ) : (step === 'confirm' && analysis) ? (
                        <div className="space-y-4">
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

                            <DialogFooter className="gap-2 sm:gap-0">
                                <Button
                                    variant="outline"
                                    onClick={() => setStep('mapping')}
                                >
                                    Back
                                </Button>

                                {analysis.existingCount > 0 ? (
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
                                        disabled={isUploading || preview.length === 0}
                                    >
                                        {isUploading ? "Importing..." : "Import All"}
                                    </Button>
                                )}
                            </DialogFooter>
                        </div>
                    ) : null}
                </div>
            </DialogContent>
        </Dialog>
    )
}
