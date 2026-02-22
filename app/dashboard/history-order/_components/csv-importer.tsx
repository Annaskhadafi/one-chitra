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
import { Upload, CheckCircle2 } from "lucide-react"
import { ProgressLoading } from "@/components/ui/progress-loading"
import Papa from "papaparse"
import { toast } from "sonner"
import { importHistoryOrderBatch } from "@/app/actions/history-order"
import { Progress } from "@/components/ui/progress"

const REQUIRED_FIELDS = [
    { key: "Sorg.", label: "Sorg." },
    { key: "BillTy", label: "BillTy" },
    { key: "Rev. Type", label: "Rev. Type" },
    { key: "Customer", label: "Customer" },
    { key: "Customer Name", label: "Customer Name" },
    { key: "Salesman", label: "Salesman" },
    { key: "Item", label: "Item" },
    { key: "Sloc", label: "Sloc" },
    { key: "Plant", label: "Plant" },
    { key: "Material No", label: "Material No" },
    { key: "Material Description", label: "Material Description" },
    { key: "Qty", label: "Qty" },
    { key: "Revenue in Doc Curr.", label: "Revenue" },
    { key: "Billing Date", label: "Billing Date" },
    { key: "PO No.", label: "PO No." },
    { key: "Mat Grp Desc.", label: "Mat Grp Desc." },
]

export function CsvImporter() {
    const [open, setOpen] = useState(false)
    const [file, setFile] = useState<File | null>(null)
    const [csvHeaders, setCsvHeaders] = useState<string[]>([])
    const [mapping, setMapping] = useState<Record<string, string>>({})
    // Status
    const [step, setStep] = useState<"upload" | "map" | "importing" | "success">("upload")
    const [progress, setProgress] = useState(0)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (!selectedFile) return
        setFile(selectedFile)

        Papa.parse(selectedFile, {
            header: true,
            skipEmptyLines: true,
            preview: 5, // Just to get headers quickly
            complete: (results) => {
                if (results.meta.fields) {
                    setCsvHeaders(results.meta.fields)

                    // Auto-map logic
                    const initialMapping: Record<string, string> = {}
                    REQUIRED_FIELDS.forEach(req => {
                        const match = results.meta.fields?.find(f => f.toLowerCase() === req.key.toLowerCase() || f.toLowerCase() === req.label.toLowerCase())
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

    const startImport = () => {
        if (!file) return
        setStep("importing")
        setProgress(0)

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const total = results.data.length
                const BATCH_SIZE = 1000
                const batches = Math.ceil(total / BATCH_SIZE)

                let successCount = 0

                for (let i = 0; i < batches; i++) {
                    const batchRaw = results.data.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE)

                    // Apply mapping
                    const mappedBatch = batchRaw.map((row) => {
                        const r = row as Record<string, unknown>
                        const newRow: Record<string, unknown> = {}
                        // Always pass mapped values based on the required fields
                        REQUIRED_FIELDS.forEach(req => {
                            const mappedKey = mapping[req.key]
                            newRow[req.key] = mappedKey ? r[mappedKey] : null
                        })
                        // Also safely attach any unmapped fields as-is just in case the server action looks for them (like matGrp1, basePrice etc if exact match)
                        return { ...r, ...newRow }
                    })

                    try {
                        const res = await importHistoryOrderBatch(mappedBatch)
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
            if (!val && step === "importing") return // Prevent closing while importing
            setOpen(val)
            if (!val) setTimeout(reset, 300)
        }}>
            <DialogTrigger asChild>
                <Button>
                    <Upload className="mr-2 h-4 w-4" />
                    Import CSV
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Import History Orders</DialogTitle>
                    <DialogDescription>
                        Upload a CSV file to add historical order data. Map your columns to ensure data aligns correctly.
                    </DialogDescription>
                </DialogHeader>

                {step === "upload" && (
                    <div className="grid w-full max-w-sm items-center gap-1.5 py-6 mx-auto">
                        <Label htmlFor="csv-upload">Select CSV File</Label>
                        <Input id="csv-upload" type="file" accept=".csv" onChange={handleFileChange} />
                    </div>
                )}

                {step === "map" && (
                    <div className="py-4 space-y-4">
                        <div className="bg-muted p-3 rounded-md text-sm">
                            <p className="font-medium text-foreground">File selected: {file?.name}</p>
                            <p className="text-muted-foreground">{csvHeaders.length} columns detected.</p>
                        </div>

                        <div className="space-y-3">
                            <h4 className="text-sm font-medium">Map Columns</h4>
                            <div className="grid gap-3 max-h-[400px] overflow-y-auto p-1">
                                {REQUIRED_FIELDS.map((field) => (
                                    <div key={field.key} className="grid grid-cols-2 items-center gap-4">
                                        <Label className="text-right text-xs truncate" title={field.label}>{field.label}</Label>
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
                            <Button onClick={startImport}>Start Import</Button>
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
                            Your history orders have been updated. The page will reload shortly.
                        </p>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
