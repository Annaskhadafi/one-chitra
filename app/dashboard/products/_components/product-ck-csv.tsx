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
    DialogFooter,
} from "@/components/ui/dialog"
import { Upload, FileUp, X, ArrowRight, Download, FileSpreadsheet, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import Papa from "papaparse"
import { importMaterialCk } from "@/app/actions/product"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type Mapping = {
    materialNumber: string
    materialNumberCk: string
}

type Step = 'upload' | 'mapping' | 'preview'

export function ProductCkCSVUpload({ onSuccess }: { onSuccess?: () => void }) {
    const [file, setFile] = useState<File | null>(null)
    const [isUploading, setIsUploading] = useState(false)
    const [preview, setPreview] = useState<{ materialNumber: string, materialNumberCk: string }[]>([])
    const [isOpen, setIsOpen] = useState(false)

    // Multi-step state
    const [step, setStep] = useState<Step>('upload')
    const [csvHeaders, setCsvHeaders] = useState<string[]>([])
    const [mapping, setMapping] = useState<Mapping>({
        materialNumber: '',
        materialNumberCk: '',
    })

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (selectedFile) {
            setFile(selectedFile)
            setStep('upload')
            parseHeaders(selectedFile)
        }
    }

    const parseHeaders = (file: File) => {
        Papa.parse(file, {
            header: true,
            preview: 1,
            skipEmptyLines: true,
            complete: (results) => {
                if (results.meta.fields) {
                    const headers = results.meta.fields
                    setCsvHeaders(headers)

                    // Auto-detect mapping
                    const detectMapped = (regex: RegExp) => headers.find(h => regex.test(h.toLowerCase().replace(/[^a-z0-9]/g, ""))) || ''

                    setMapping({
                        materialNumber: detectMapped(/materialnumber|materialno|partnumber|partno/i),
                        materialNumberCk: detectMapped(/materialnumberck|ck|mmck/i),
                    })
                    setStep('mapping')
                }
            },
            error: (error) => {
                toast.error("Failed to parse CSV headers: " + error.message)
            }
        })
    }

    const parseFullFile = () => {
        if (!file) return

        setIsUploading(true)
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const data = results.data as Record<string, string>[]

                const normalized = data.map(item => {
                    return {
                        materialNumber: mapping.materialNumber ? item[mapping.materialNumber]?.toString().trim() : "",
                        materialNumberCk: mapping.materialNumberCk ? item[mapping.materialNumberCk]?.toString().trim() : "",
                    }
                }).filter(item => item.materialNumber && item.materialNumberCk)

                setPreview(normalized)
                setStep('preview')
                setIsUploading(false)
            },
            error: (error) => {
                setIsUploading(false)
                toast.error("Failed to parse CSV: " + error.message)
            }
        })
    }

    const handleUpload = async () => {
        if (preview.length === 0) return

        setIsUploading(true)
        try {
            console.log('[Import CK] Starting import of', preview.length, 'mappings')
            const result = await importMaterialCk(preview)
            if (result.success) {
                toast.success(`Successfully imported ${result.count} mappings`)
                setIsOpen(false)
                reset()
                onSuccess?.()
            } else {
                toast.error(result.error || 'Gagal mengimpor mapping CK')
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error'
            toast.error(`Gagal mengimpor: ${msg}`)
        } finally {
            setIsUploading(false)
        }
    }

    const reset = () => {
        setFile(null)
        setPreview([])
        setStep('upload')
        setCsvHeaders([])
        setMapping({
            materialNumber: '',
            materialNumberCk: '',
        })
    }

    const downloadTemplate = () => {
        const headers = "Material Number,Material Number CK\n"
        const example = "MAT001,CK_MAT001"
        const csvContent = "data:text/csv;charset=utf-8," + headers + example
        const encodedUri = encodeURI(csvContent)
        const link = document.createElement("a")
        link.setAttribute("href", encodedUri)
        link.setAttribute("download", "mapping_ck_template.csv")
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
                <Button variant="outline" className="text-orange-600 border-orange-200 bg-orange-50 hover:bg-orange-100 hover:text-orange-700">
                    <Upload className="mr-2 h-4 w-4" />
                    Import MM CK
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>
                        {step === 'upload' ? 'Import Material Number CK' :
                            step === 'mapping' ? 'Map CSV Columns' :
                                'Preview Import Data'}
                    </DialogTitle>
                    <DialogDescription>
                        {step === 'upload' ? 'Upload a CSV file or download a template to map Material Number with CK Number.' :
                            step === 'mapping' ? 'Match your CSV columns.' :
                                'Review the data.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-1 py-4">
                    {step === 'upload' && (
                        <div className="space-y-4">
                            {!file ? (
                                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-12 text-center">
                                    <input
                                        type="file"
                                        accept=".csv"
                                        id="ck-csv-upload"
                                        className="hidden"
                                        onChange={handleFileChange}
                                    />
                                    <label
                                        htmlFor="ck-csv-upload"
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
                            </div>
                        </div>
                    )}

                    {step === 'mapping' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[
                                { id: 'materialNumber', label: 'Material Number CF/CP', required: true },
                                { id: 'materialNumberCk', label: 'Material Number CK', required: true },
                            ].map((field) => (
                                <div key={field.id} className="space-y-2">
                                    <Label className="text-sm font-medium">
                                        {field.label} {field.required && <span className="text-red-500">*</span>}
                                    </Label>
                                    <Select
                                        value={mapping[field.id as keyof Mapping]}
                                        onValueChange={(val) => setMapping(prev => ({ ...prev, [field.id]: val }))}
                                    >
                                        <SelectTrigger className="h-9">
                                            <SelectValue placeholder="Select Column" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {csvHeaders.map(header => (
                                                <SelectItem key={header} value={header}>{header}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ))}
                        </div>
                    )}

                    {step === 'preview' && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                                <AlertTriangle className="h-4 w-4 text-amber-500" />
                                <span>Previewing first 10 of {preview.length} mappings.</span>
                            </div>
                            <div className="border rounded-md overflow-hidden">
                                <div className="overflow-x-auto">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-muted sticky top-0">
                                        <tr>
                                            <th className="p-2 border-b">Material #</th>
                                            <th className="p-2 border-b">Material # CK</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {preview.slice(0, 10).map((item, i) => (
                                            <tr key={i} className="hover:bg-muted/30">
                                                <td className="p-2 border-b font-medium">{item.materialNumber}</td>
                                                <td className="p-2 border-b text-orange-600 font-medium">{item.materialNumberCk}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="border-t pt-4">
                    {step === 'mapping' && (
                        <>
                            <Button variant="outline" onClick={() => setStep('upload')}>Back</Button>
                            <Button
                                onClick={parseFullFile}
                                disabled={!mapping.materialNumber || !mapping.materialNumberCk || isUploading}
                            >
                                {isUploading ? "Processing..." : "Next: Preview"}
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </>
                    )}
                    {step === 'preview' && (
                        <>
                            <Button variant="outline" onClick={() => setStep('mapping')}>Back</Button>
                            <Button onClick={handleUpload} disabled={isUploading || preview.length === 0}>
                                {isUploading ? "Importing..." : `Import ${preview.length} Mappings`}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
