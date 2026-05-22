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
import * as XLSX from "xlsx"
import { importMaterialCk } from "@/app/actions/product"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type Mapping = {
    materialNumber: string
    materialNumberCk: string
}

type Step = "upload" | "mapping" | "preview"

function parseExcel(file: File): Promise<Record<string, string>[]> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer)
                const workbook = XLSX.read(data, { type: "array" })
                const sheetName = workbook.SheetNames[0]
                const worksheet = workbook.Sheets[sheetName]
                const json = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet, { defval: "" })
                resolve(json)
            } catch (err) {
                reject(err)
            }
        }
        reader.onerror = () => reject(new Error("Failed to read file"))
        reader.readAsArrayBuffer(file)
    })
}

function getHeadersFromExcel(file: File): Promise<string[]> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer)
                const workbook = XLSX.read(data, { type: "array" })
                const sheetName = workbook.SheetNames[0]
                const worksheet = workbook.Sheets[sheetName]
                const json = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet, { header: 1 })
                const headers = (json[0] as string[]) || []
                resolve(headers.map(String))
            } catch (err) {
                reject(err)
            }
        }
        reader.onerror = () => reject(new Error("Failed to read file"))
        reader.readAsArrayBuffer(file)
    })
}

export function ProductCkCSVUpload({ onSuccess }: { onSuccess?: () => void }) {
    const [file, setFile] = useState<File | null>(null)
    const [isUploading, setIsUploading] = useState(false)
    const [preview, setPreview] = useState<{ materialNumber: string; materialNumberCk: string }[]>([])
    const [isOpen, setIsOpen] = useState(false)

    const [step, setStep] = useState<Step>("upload")
    const [csvHeaders, setCsvHeaders] = useState<string[]>([])
    const [mapping, setMapping] = useState<Mapping>({
        materialNumber: "",
        materialNumberCk: "",
    })

    const isExcel = (f: File) =>
        f.name.endsWith(".xlsx") || f.name.endsWith(".xls") ||
        f.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        f.type === "application/vnd.ms-excel"

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (selectedFile) {
            setFile(selectedFile)
            setStep("upload")
            parseHeaders(selectedFile)
        }
    }

    const parseHeaders = async (f: File) => {
        try {
            let headers: string[] = []
            if (isExcel(f)) {
                headers = await getHeadersFromExcel(f)
            } else {
                await new Promise<void>((resolve) => {
                    Papa.parse(f, {
                        header: true,
                        preview: 1,
                        skipEmptyLines: true,
                        complete: (results) => {
                            headers = results.meta.fields || []
                            resolve()
                        },
                        error: () => resolve(),
                    })
                })
            }
            setCsvHeaders(headers)
            const detectMapped = (regex: RegExp) =>
                headers.find((h) => regex.test(h.toLowerCase().replace(/[^a-z0-9]/g, ""))) || ""
            setMapping({
                materialNumber: detectMapped(/materialnumber|materialno|partnumber|partno/i),
                materialNumberCk: detectMapped(/materialnumberck|ck|mmck/i),
            })
            setStep("mapping")
        } catch {
            toast.error("Failed to parse file headers")
        }
    }

    const parseFullFile = async () => {
        if (!file) return
        setIsUploading(true)
        try {
            let rows: Record<string, string>[] = []
            if (isExcel(file)) {
                rows = await parseExcel(file)
            } else {
                await new Promise<void>((resolve) => {
                    Papa.parse(file, {
                        header: true,
                        skipEmptyLines: true,
                        complete: (results) => {
                            rows = results.data as Record<string, string>[]
                            resolve()
                        },
                        error: () => resolve(),
                    })
                })
            }
            const normalized = rows
                .map((item) => ({
                    materialNumber: mapping.materialNumber ? item[mapping.materialNumber]?.toString().trim() : "",
                    materialNumberCk: mapping.materialNumberCk ? item[mapping.materialNumberCk]?.toString().trim() : "",
                }))
                .filter((item) => item.materialNumber && item.materialNumberCk)
            setPreview(normalized)
            setStep("preview")
        } catch {
            toast.error("Failed to parse file")
        } finally {
            setIsUploading(false)
        }
    }

    const handleUpload = async () => {
        if (preview.length === 0) return
        setIsUploading(true)
        try {
            const result = await importMaterialCk(preview)
            if (result.success) {
                toast.success(`Successfully imported ${result.count} CK mappings`)
                setIsOpen(false)
                reset()
                onSuccess?.()
            } else {
                toast.error(result.error || "Gagal mengimpor mapping CK")
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Unknown error"
            toast.error(`Gagal mengimpor: ${msg}`)
        } finally {
            setIsUploading(false)
        }
    }

    const reset = () => {
        setFile(null)
        setPreview([])
        setStep("upload")
        setCsvHeaders([])
        setMapping({ materialNumber: "", materialNumberCk: "" })
    }

    const downloadTemplate = () => {
        const ws = XLSX.utils.aoa_to_sheet([
            ["Material Number", "Material Number CK"],
            ["MAT001", "CK_MAT001"],
        ])
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Template")
        XLSX.writeFile(wb, "template_material_ck.xlsx")
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) reset() }}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 text-orange-600 border-orange-300 hover:bg-orange-50">
                    <Upload className="h-4 w-4" />
                    Import MM CK
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5 text-orange-500" />
                        Import Material CK
                    </DialogTitle>
                    <DialogDescription>
                        Upload CSV atau Excel (.xlsx) untuk mapping Material Number dengan Material Number CK (PT. Cipta Kridatama)
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm">
                        {(["upload", "mapping", "preview"] as Step[]).map((s, i) => (
                            <React.Fragment key={s}>
                                <div className={`flex items-center gap-1 font-medium ${step === s ? "text-primary" : "text-muted-foreground"}`}>
                                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${step === s ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                                        {i + 1}
                                    </span>
                                    <span className="capitalize">{s}</span>
                                </div>
                                {i < 2 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                            </React.Fragment>
                        ))}
                    </div>

                    {step === "upload" && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-muted-foreground">
                                    Upload file CSV atau Excel (.xlsx/.xls)
                                </p>
                                <Button variant="ghost" size="sm" onClick={downloadTemplate} className="gap-2 text-xs">
                                    <Download className="h-3 w-3" />
                                    Download Template
                                </Button>
                            </div>
                            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <FileUp className="h-8 w-8 text-muted-foreground mb-2" />
                                    <p className="text-sm text-muted-foreground">
                                        {file ? file.name : "Click to upload CSV atau Excel (.xlsx/.xls)"}
                                    </p>
                                </div>
                                <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileChange} />
                            </label>
                            {file && (
                                <div className="flex items-center gap-2 text-sm bg-muted/50 p-2 rounded">
                                    <FileSpreadsheet className="h-4 w-4 text-green-500" />
                                    <span>{file.name}</span>
                                    <Button variant="ghost" size="icon" className="h-5 w-5 ml-auto" onClick={() => { setFile(null); setStep("upload") }}>
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}

                    {step === "mapping" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[
                                { id: "materialNumber", label: "Material Number CF/CP", required: true },
                                { id: "materialNumberCk", label: "Material Number CK", required: true },
                            ].map((field) => (
                                <div key={field.id} className="space-y-2">
                                    <Label className="text-sm font-medium">
                                        {field.label} {field.required && <span className="text-red-500">*</span>}
                                    </Label>
                                    <Select
                                        value={mapping[field.id as keyof Mapping]}
                                        onValueChange={(val) => setMapping((prev) => ({ ...prev, [field.id]: val }))}
                                    >
                                        <SelectTrigger className="h-9">
                                            <SelectValue placeholder="Select Column" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {csvHeaders.map((header) => (
                                                <SelectItem key={header} value={header}>{header}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ))}
                        </div>
                    )}

                    {step === "preview" && (
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
                    {step === "mapping" && (
                        <>
                            <Button variant="outline" onClick={() => setStep("upload")}>Back</Button>
                            <Button onClick={parseFullFile} disabled={!mapping.materialNumber || !mapping.materialNumberCk || isUploading}>
                                {isUploading ? "Processing..." : "Next: Preview"}
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </>
                    )}
                    {step === "preview" && (
                        <>
                            <Button variant="outline" onClick={() => setStep("mapping")}>Back</Button>
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