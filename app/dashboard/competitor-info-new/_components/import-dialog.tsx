"use client"

import * as React from "react"
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
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Upload, CheckCircle2, FileDown } from "lucide-react"
import { ProgressLoading } from "@/components/ui/progress-loading"
import Papa from "papaparse"
import { toast } from "sonner"
import { Progress } from "@/components/ui/progress"

interface ImportField {
    key: string
    label: string
}

interface ImportDialogProps {
    title: string
    description: string
    requiredFields: ImportField[]
    onImport: (data: any[]) => Promise<{ success: boolean; count?: number; error?: string }>
    templateData: Record<string, string>[]
    templateFileName: string
}

export function ImportDialog({
    title,
    description,
    requiredFields,
    onImport,
    templateData,
    templateFileName
}: ImportDialogProps) {
    const [open, setOpen] = useState(false)
    const [file, setFile] = useState<File | null>(null)
    const [csvHeaders, setCsvHeaders] = useState<string[]>([])
    const [mapping, setMapping] = useState<Record<string, string>>({})
    const [step, setStep] = useState<"upload" | "map" | "importing" | "success">("upload")
    const [progress, setProgress] = useState(0)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (!selectedFile) return
        setFile(selectedFile)

        Papa.parse(selectedFile, {
            header: true,
            skipEmptyLines: true,
            preview: 5,
            complete: (results) => {
                if (results.meta.fields) {
                    setCsvHeaders(results.meta.fields)
                    const initialMapping: Record<string, string> = {}
                    requiredFields.forEach(req => {
                        const match = results.meta.fields?.find(f =>
                            f.toLowerCase() === req.key.toLowerCase() ||
                            f.toLowerCase() === req.label.toLowerCase()
                        )
                        if (match) initialMapping[req.key] = match
                    })
                    setMapping(initialMapping)
                    setStep("map")
                }
            },
            error: (error) => {
                toast.error("Failed to parse CSV: " + error.message)
            }
        })
    }

    const downloadTemplate = () => {
        const csv = Papa.unparse(templateData)
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
        const link = document.createElement("a")
        const url = URL.createObjectURL(blob)
        link.setAttribute("href", url)
        link.setAttribute("download", templateFileName)
        link.style.visibility = "hidden"
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const startImport = () => {
        if (!file) return
        setStep("importing")
        setProgress(0)

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const total = results.data.length
                const BATCH_SIZE = 500
                const batches = Math.ceil(total / BATCH_SIZE)
                let successCount = 0

                for (let i = 0; i < batches; i++) {
                    const batchRaw = results.data.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE)
                    const mappedBatch = batchRaw.map((row) => {
                        const r = row as Record<string, unknown>
                        const newRow: Record<string, unknown> = {}
                        requiredFields.forEach(req => {
                            const mappedKey = mapping[req.key]
                            newRow[req.key] = mappedKey ? r[mappedKey] : null
                        })
                        return newRow
                    })

                    try {
                        const res = await onImport(mappedBatch)
                        if (res.success) {
                            successCount += res.count || 0
                        } else {
                            toast.error(`Error in batch ${i + 1}: ${res.error}`)
                        }
                    } catch (err) {
                        toast.error(`Exception in batch ${i + 1}`)
                    }
                    setProgress(Math.round(((i + 1) / batches) * 100))
                }

                toast.success(`Successfully imported ${successCount} records!`)
                setStep("success")
                setTimeout(() => {
                    setOpen(false)
                    window.location.reload()
                }, 2000)
            },
            error: (error) => {
                toast.error("Failed to read full file: " + error.message)
                setStep("map")
            }
        })
    }

    const reset = () => {
        setFile(null)
        setCsvHeaders([])
        setMapping({})
        setStep("upload")
        setProgress(0)
    }

    return (
        <Dialog open={open} onOpenChange={(val) => {
            if (!val && step === "importing") return
            setOpen(val)
            if (!val) setTimeout(reset, 300)
        }}>
            <DialogTrigger asChild>
                <Button variant="outline" className="font-bold">
                    <Upload className="mr-2 h-4 w-4" />
                    Import CSV
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>

                <div className="flex justify-end">
                    <Button variant="ghost" size="sm" onClick={downloadTemplate} className="text-xs">
                        <FileDown className="w-3 h-3 mr-1" />
                        Download Template
                    </Button>
                </div>

                {step === "upload" && (
                    <div className="grid w-full max-w-sm items-center gap-1.5 py-6 mx-auto">
                        <Label htmlFor="csv-upload">Select CSV File</Label>
                        <Input id="csv-upload" type="file" accept=".csv" onChange={handleFileChange} />
                    </div>
                )}

                {step === "map" && (
                    <div className="py-2 space-y-4">
                        <div className="bg-muted p-3 rounded-md text-sm">
                            <p className="font-medium text-foreground">File selected: {file?.name}</p>
                            <p className="text-muted-foreground">{csvHeaders.length} columns detected.</p>
                        </div>

                        <div className="space-y-3">
                            <h4 className="text-sm font-medium">Map Columns</h4>
                            <div className="grid gap-2 max-h-[300px] overflow-y-auto p-1 border rounded-md">
                                {requiredFields.map((field) => (
                                    <div key={field.key} className="grid grid-cols-2 items-center gap-4 py-1 border-b last:border-0 hover:bg-muted/30 px-2 transition-colors">
                                        <Label className="text-xs truncate font-semibold" title={field.label}>{field.label}</Label>
                                        <Select
                                            value={mapping[field.key] || ""}
                                            onValueChange={(val) => setMapping(prev => ({ ...prev, [field.key]: val }))}
                                        >
                                            <SelectTrigger className="h-8 text-xs">
                                                <SelectValue placeholder="Select column..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {csvHeaders.map(header => (
                                                    <SelectItem key={header} value={header} className="text-xs">
                                                        {header}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <DialogFooter className="mt-6">
                            <Button variant="outline" onClick={reset}>Cancel</Button>
                            <Button onClick={startImport} disabled={Object.keys(mapping).length === 0}>Start Import</Button>
                        </DialogFooter>
                    </div>
                )}

                {step === "importing" && (
                    <div className="py-12">
                        <ProgressLoading
                            value={progress}
                            message="Importing Data..."
                        />
                    </div>
                )}

                {step === "success" && (
                    <div className="py-12 flex flex-col items-center justify-center space-y-4 animate-in zoom-in duration-300">
                        <CheckCircle2 className="h-12 w-12 text-green-500" />
                        <h3 className="text-xl font-medium">Import Successful</h3>
                        <p className="text-sm text-muted-foreground text-center">
                            Data has been updated. The page will reload shortly.
                        </p>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
