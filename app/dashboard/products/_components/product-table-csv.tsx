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
import { importProducts } from "@/app/actions/product"
import { NewProduct } from "@/lib/types"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type RawProductData = Record<string, string>
type ProductData = NewProduct

type Mapping = {
    materialNumber: string
    sloc: string
    category: string
    materialDescription: string
    oldMaterialNo: string
    plant: string
    slocDescription: string
    costSap: string
}

type Step = 'upload' | 'mapping' | 'preview'

export function ProductCSVUpload({ onSuccess }: { onSuccess?: () => void }) {
    const [file, setFile] = useState<File | null>(null)
    const [isUploading, setIsUploading] = useState(false)
    const [preview, setPreview] = useState<ProductData[]>([])
    const [isOpen, setIsOpen] = useState(false)

    // Multi-step state
    const [step, setStep] = useState<Step>('upload')
    const [csvHeaders, setCsvHeaders] = useState<string[]>([])
    const [mapping, setMapping] = useState<Mapping>({
        materialNumber: '',
        sloc: '',
        category: '',
        materialDescription: '',
        oldMaterialNo: '',
        plant: '',
        slocDescription: '',
        costSap: '',
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
                        sloc: detectMapped(/sloc|location|storage/i),
                        category: detectMapped(/category|type|group/i),
                        materialDescription: detectMapped(/materialdescription|description|desc/i),
                        oldMaterialNo: detectMapped(/oldmaterialno|oldmaterial|prevmaterial/i),
                        plant: detectMapped(/plant|factory|warehouse/i),
                        slocDescription: detectMapped(/slocdescription|locationdescription|locdesc/i),
                        costSap: detectMapped(/costsap|cost|price/i),
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
                const data = results.data as RawProductData[]
                const categories = ["ACC", "FLAP", "IMT PART", "MATERIAL CONSUMABLE", "SPM", "TUBE", "TYRE", "WHEEL & RIM"]

                const normalized = data.map(item => {
                    let category = (mapping.category && item[mapping.category] ? item[mapping.category] : "TYRE").toUpperCase()
                    if (!categories.includes(category)) category = "TYRE"

                    return {
                        materialNumber: mapping.materialNumber ? item[mapping.materialNumber]?.toString().trim() : "",
                        sloc: mapping.sloc ? item[mapping.sloc]?.toString().trim() : "",
                        category: category,
                        materialDescription: mapping.materialDescription ? item[mapping.materialDescription]?.toString() : null,
                        oldMaterialNo: mapping.oldMaterialNo ? item[mapping.oldMaterialNo]?.toString() : null,
                        plant: mapping.plant ? item[mapping.plant]?.toString() : null,
                        slocDescription: mapping.slocDescription ? item[mapping.slocDescription]?.toString() : null,
                        costSap: mapping.costSap ? item[mapping.costSap]?.toString() : null,
                    }
                }).filter(item => item.materialNumber && item.sloc) as ProductData[]

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
            const result = await importProducts(preview)
            if (result.success) {
                toast.success(`Successfully imported ${preview.length} products`)
                setIsOpen(false)
                reset()
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

    const reset = () => {
        setFile(null)
        setPreview([])
        setStep('upload')
        setCsvHeaders([])
        setMapping({
            materialNumber: '',
            sloc: '',
            category: '',
            materialDescription: '',
            oldMaterialNo: '',
            plant: '',
            slocDescription: '',
            costSap: '',
        })
    }

    const downloadTemplate = () => {
        const headers = "Material Number,Sloc,Category,Material Description,Old Material No,Plant,Sloc Description,Cost SAP\n"
        const example = "MAT001,SL01,TYRE,Example Description,OLD001,PL01,Example Sloc Desc,100.50"
        const csvContent = "data:text/csv;charset=utf-8," + headers + example
        const encodedUri = encodeURI(csvContent)
        const link = document.createElement("a")
        link.setAttribute("href", encodedUri)
        link.setAttribute("download", "product_template.csv")
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
                    Import CSV
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>
                        {step === 'upload' ? 'Import Products CSV' :
                            step === 'mapping' ? 'Map CSV Columns' :
                                'Preview Import Data'}
                    </DialogTitle>
                    <DialogDescription>
                        {step === 'upload' ? 'Upload a CSV file or download a template.' :
                            step === 'mapping' ? 'Match your CSV columns to the database fields.' :
                                'Review the data before finalizing the import.'}
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
                                { id: 'materialNumber', label: 'Material Number', required: true },
                                { id: 'sloc', label: 'Sloc (Location Code Code)', required: true },
                                { id: 'category', label: 'Category', required: false },
                                { id: 'materialDescription', label: 'Material Description', required: false },
                                { id: 'oldMaterialNo', label: 'Old Material No', required: false },
                                { id: 'plant', label: 'Plant', required: false },
                                { id: 'slocDescription', label: 'Sloc Description', required: false },
                                { id: 'costSap', label: 'Cost SAP', required: false },
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
                                            <SelectValue placeholder={field.required ? "Select Column" : "Optional (Skip)"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {!field.required && <SelectItem value="__none__">-- Skip --</SelectItem>}
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
                                <span>Previewing first 10 of {preview.length} rows. Duplicate Material # + Sloc will be updated.</span>
                            </div>
                            <div className="border rounded-md overflow-hidden">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-muted sticky top-0">
                                        <tr>
                                            <th className="p-2 border-b">Plant</th>
                                            <th className="p-2 border-b">Material #</th>
                                            <th className="p-2 border-b">Category</th>
                                            <th className="p-2 border-b">Description</th>
                                            <th className="p-2 border-b">Sloc</th>
                                            <th className="p-2 border-b">Cost</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {preview.slice(0, 10).map((item, i) => (
                                            <tr key={i} className="hover:bg-muted/30">
                                                <td className="p-2 border-b">{item.plant || "-"}</td>
                                                <td className="p-2 border-b font-medium">{item.materialNumber}</td>
                                                <td className="p-2 border-b">{item.category}</td>
                                                <td className="p-2 border-b truncate max-w-[150px]">{item.materialDescription || "-"}</td>
                                                <td className="p-2 border-b">{item.sloc}</td>
                                                <td className="p-2 border-b">{item.costSap || "-"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
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
                                disabled={!mapping.materialNumber || !mapping.sloc || isUploading}
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
                                {isUploading ? "Importing..." : `Import ${preview.length} Products`}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
