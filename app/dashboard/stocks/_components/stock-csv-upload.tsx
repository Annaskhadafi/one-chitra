"use client"

import * as React from "react"
import { useState, useRef } from "react"
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
import { Upload, FileUp, X, Check, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import Papa from "papaparse"
import { importStockChunk, type StockImportItem } from "@/app/actions/stock"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

type RawStockData = Record<string, string>

export function StockCSVUpload({ onSuccess }: { onSuccess?: () => void }) {
    const [file, setFile] = useState<File | null>(null)
    const [isOpen, setIsOpen] = useState(false)
    
    // State management
    const [status, setStatus] = useState<"idle" | "parsing" | "uploading" | "completed">("idle")
    const [progress, setProgress] = useState(0)
    const [parsedData, setParsedData] = useState<StockImportItem[]>([])
    
    // Statistics
    const [stats, setStats] = useState({
        total: 0,
        processed: 0,
        succeeded: 0,
        failed: 0,
        errors: [] as string[]
    })
    
    // Time estimation
    const startTimeRef = useRef<number>(0)
    const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<string>("")

    const resetState = () => {
        setFile(null)
        setStatus("idle")
        setProgress(0)
        setParsedData([])
        setStats({ total: 0, processed: 0, succeeded: 0, failed: 0, errors: [] })
        setEstimatedTimeRemaining("")
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (selectedFile) {
            setFile(selectedFile)
            parseFile(selectedFile)
        }
    }

    const parseFile = (file: File) => {
        setStatus("parsing")
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const data = results.data as RawStockData[]
                
                const normalized: StockImportItem[] = data.map(item => {
                    const keys = Object.keys(item)
                    
                    // Flexible key matching
                    const matKey = keys.find(k => k.toLowerCase().replace(/[^a-z]/g, "") === "materialnumber" || k.toLowerCase().replace(/[^a-z]/g, "") === "idinv")
                    const slocKey = keys.find(k => k.toLowerCase().replace(/[^a-z]/g, "") === "sloc" || k.toLowerCase().replace(/[^a-z]/g, "") === "storagelocation")
                    const qtyKey = keys.find(k => k.toLowerCase().replace(/[^a-z]/g, "") === "actstock" || k.toLowerCase().replace(/[^a-z]/g, "") === "totalstock" || k.toLowerCase().replace(/[^a-z]/g, "") === "qtystock")
                    const valKey = keys.find(k => k.toLowerCase().replace(/[^a-z]/g, "") === "valuationvalue" || k.toLowerCase().replace(/[^a-z]/g, "") === "valuestock")
                    const minKey = keys.find(k => k.toLowerCase().replace(/[^a-z]/g, "") === "minstock")

                    if (!matKey || !slocKey) return null

                    return {
                        materialNumber: item[matKey]?.toString().trim() || "",
                        sloc: item[slocKey]?.toString().trim() || "",
                        totalStock: qtyKey ? Number(item[qtyKey]) || 0 : 0,
                        valuationValue: valKey ? item[valKey]?.toString() || "0" : "0",
                        minStock: minKey ? Number(item[minKey]) || 0 : 0,
                    }
                }).filter((item): item is StockImportItem => Boolean(item && item.materialNumber && item.sloc))

                setParsedData(normalized)
                setStats(prev => ({ ...prev, total: normalized.length }))
                setStatus("idle")
                
                if (normalized.length === 0) {
                    toast.error("No valid data found in CSV. Check column headers.")
                }
            },
            error: (error) => {
                toast.error("Failed to parse CSV: " + error.message)
                setStatus("idle")
            }
        })
    }

    const handleUpload = async () => {
        if (parsedData.length === 0) return

        setStatus("uploading")
        startTimeRef.current = Date.now()
        
        const CHUNK_SIZE = 50
        const totalChunks = Math.ceil(parsedData.length / CHUNK_SIZE)
        let currentProcessed = 0
        let currentSucceeded = 0
        let currentFailed = 0
        let currentErrors: string[] = []

        for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE
            const end = Math.min(start + CHUNK_SIZE, parsedData.length)
            const chunk = parsedData.slice(start, end)

            try {
                const result = await importStockChunk(chunk)
                
                currentProcessed += chunk.length
                currentSucceeded += result.succeeded
                currentFailed += result.failed
                if (result.errors && result.errors.length > 0) {
                    currentErrors = [...currentErrors, ...result.errors]
                }

                // Update Progress
                const progressPercent = (currentProcessed / parsedData.length) * 100
                setProgress(progressPercent)
                
                // Calculate estimated time remaining
                const elapsedTime = Date.now() - startTimeRef.current
                const timePerItem = elapsedTime / currentProcessed
                const remainingItems = parsedData.length - currentProcessed
                const remainingTimeMs = remainingItems * timePerItem
                
                setEstimatedTimeRemaining(
                    remainingTimeMs > 60000 
                        ? `${Math.ceil(remainingTimeMs / 60000)} min remaining` 
                        : `${Math.ceil(remainingTimeMs / 1000)} sec remaining`
                )

                setStats({
                    total: parsedData.length,
                    processed: currentProcessed,
                    succeeded: currentSucceeded,
                    failed: currentFailed,
                    errors: currentErrors
                })

            } catch (error) {
                console.error("Chunk upload failed", error)
                currentFailed += chunk.length
                currentErrors.push(`Chunk ${i+1} failed: Network or server error`)
            }
        }

        setStatus("completed")
        onSuccess?.()
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            if (!open && status === "uploading") {
                if (!confirm("Upload is in progress. Are you sure you want to cancel?")) return
            }
            setIsOpen(open)
            if (!open) resetState()
        }}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <Upload className="mr-2 h-4 w-4" />
                    Import CSV
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Import Stock Levels</DialogTitle>
                    <DialogDescription>
                        Upload a CSV file containing IDINV, SLOC, Act Stock, and Min Stock.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {status === "completed" ? (
                        <div className="flex flex-col items-center justify-center space-y-4 py-6">
                            <div className="rounded-full bg-green-100 p-3">
                                <CheckCircle2 className="h-8 w-8 text-green-600" />
                            </div>
                            <h3 className="text-xl font-bold">Import Completed</h3>
                            <div className="w-full grid grid-cols-3 gap-4 text-center">
                                <div className="bg-slate-50 p-3 rounded-lg">
                                    <p className="text-xs text-muted-foreground uppercase">Total</p>
                                    <p className="text-lg font-bold">{stats.total}</p>
                                </div>
                                <div className="bg-green-50 p-3 rounded-lg">
                                    <p className="text-xs text-muted-foreground uppercase text-green-600">Success</p>
                                    <p className="text-lg font-bold text-green-700">{stats.succeeded}</p>
                                </div>
                                <div className="bg-red-50 p-3 rounded-lg">
                                    <p className="text-xs text-muted-foreground uppercase text-red-600">Failed</p>
                                    <p className="text-lg font-bold text-red-700">{stats.failed}</p>
                                </div>
                            </div>
                            
                            {stats.errors.length > 0 && (
                                <Alert variant="destructive" className="w-full mt-4 text-left">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>Import Issues</AlertTitle>
                                    <AlertDescription>
                                        <ScrollArea className="h-[100px] w-full pr-4 mt-2">
                                            <ul className="list-disc pl-4 text-xs space-y-1">
                                                {stats.errors.map((err, i) => (
                                                    <li key={i}>{err}</li>
                                                ))}
                                            </ul>
                                        </ScrollArea>
                                    </AlertDescription>
                                </Alert>
                            )}

                            <div className="flex gap-2 w-full pt-4">
                                <Button variant="outline" className="flex-1" onClick={resetState}>
                                    Import Again
                                </Button>
                                <Button className="flex-1" onClick={() => setIsOpen(false)}>
                                    View Data
                                </Button>
                            </div>
                        </div>
                    ) : !file ? (
                        <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-12 text-center">
                            <input
                                type="file"
                                accept=".csv"
                                id="stock-csv-upload-input"
                                className="hidden"
                                onChange={handleFileChange}
                            />
                            <label
                                htmlFor="stock-csv-upload-input"
                                className="flex flex-col items-center cursor-pointer hover:bg-muted/50 p-4 rounded-md transition-colors"
                            >
                                <FileUp className="h-12 w-12 text-muted-foreground mb-4" />
                                <span className="text-sm font-medium">Click to upload CSV</span>
                                <span className="text-xs text-muted-foreground mt-1">
                                    Required columns: IDINV, SLOC
                                </span>
                            </label>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between bg-muted p-3 rounded-lg">
                                <div className="flex items-center">
                                    <FileUp className="h-4 w-4 text-primary mr-3" />
                                    <div>
                                        <p className="text-sm font-medium">{file.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {stats.total > 0 ? `${stats.total} records found` : "Parsing..."}
                                        </p>
                                    </div>
                                </div>
                                {status !== "uploading" && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={resetState}
                                        className="h-8 w-8"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>

                            {status === "uploading" ? (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span>Importing data...</span>
                                        <span className="font-mono">{Math.round(progress)}%</span>
                                    </div>
                                    <Progress value={progress} className="h-2" />
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                        <span>{stats.processed} / {stats.total} processed</span>
                                        <span>{estimatedTimeRemaining}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 mt-4">
                                        <div className="bg-green-50 p-2 rounded border border-green-100 flex justify-between">
                                            <span className="text-xs text-green-700">Success</span>
                                            <span className="text-xs font-bold text-green-700">{stats.succeeded}</span>
                                        </div>
                                        <div className="bg-red-50 p-2 rounded border border-red-100 flex justify-between">
                                            <span className="text-xs text-red-700">Failed</span>
                                            <span className="text-xs font-bold text-red-700">{stats.failed}</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex justify-end gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={resetState}
                                    >
                                        Cancel
                                    </Button>
                                    <Button onClick={handleUpload} disabled={stats.total === 0}>
                                        Start Import
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
