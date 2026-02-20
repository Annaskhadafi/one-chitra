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
import { Label } from "@/components/ui/label"
import { Upload, FileUp, Download, ArrowRight, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import Papa from "papaparse"
import { importBillingRecords } from "@/app/actions/billing"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

export function BillingImportDialog() {
    const [open, setOpen] = useState(false)
    const [file, setFile] = useState<File | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [step, setStep] = useState<'upload' | 'map' | 'importing'>('upload')
    const [csvData, setCsvData] = useState<any[]>([])
    const [headers, setHeaders] = useState<string[]>([])
    const [mapping, setMapping] = useState<Record<string, string>>({
        customer: "",
        poNo: "",
        poDate: "",
        deliveryNo: "",
        materialNo: "",
        description: "",
        qty: "",
        price: "",
        amount: "",
    })

    const dbFields = [
        { id: "customer", label: "Customer Name" },
        { id: "poNo", label: "PO Number" },
        { id: "poDate", label: "PO Date" },
        { id: "deliveryNo", label: "Delivery Number" },
        { id: "materialNo", label: "Material/Product No" },
        { id: "description", label: "Description" },
        { id: "qty", label: "Quantity" },
        { id: "price", label: "Unit Price" },
        { id: "amount", label: "Total Amount" },
    ]

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0]
            setFile(selectedFile)

            Papa.parse(selectedFile, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    if (results.data.length > 0) {
                        setCsvData(results.data)
                        const csvHeaders = Object.keys(results.data[0] as object)
                        setHeaders(csvHeaders)

                        // Auto-mapping attempt
                        const newMapping = { ...mapping }
                        csvHeaders.forEach(h => {
                            const low = h.toLowerCase()
                            if (low.includes("customer")) newMapping.customer = h
                            if (low.includes("po") && low.includes("no")) newMapping.poNo = h
                            if (low.includes("po") && low.includes("date")) newMapping.poDate = h
                            if (low.includes("delivery") || low.includes("do")) newMapping.deliveryNo = h
                            if (low.includes("material") || low.includes("product")) newMapping.materialNo = h
                            if (low.includes("desc")) newMapping.description = h
                            if (low.includes("qty") || low.includes("quant")) newMapping.qty = h
                            if (low.includes("price")) newMapping.price = h
                            if (low.includes("amount")) newMapping.amount = h
                        })
                        setMapping(newMapping)
                        setStep('map')
                    }
                }
            })
        }
    }

    const downloadTemplate = () => {
        const headers = ["Customer", "PO No", "PO Date", "Delivery No", "Material No", "Description", "Qty", "Price", "Amount"]
        const csvContent = headers.join(",") + "\n" +
            "Example Corp,PO-12345,2024-02-20,DO-999,MAT-001,Widget A,10,100,1000"

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
        const link = document.createElement("a")
        const url = URL.createObjectURL(blob)
        link.setAttribute("href", url)
        link.setAttribute("download", "billing_template.csv")
        link.style.visibility = "hidden"
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const handleUpload = async () => {
        if (!csvData.length) return

        setIsLoading(true)
        setStep('importing')

        try {
            // Transform data based on mapping
            const transformedData = csvData.map(row => ({
                customer: row[mapping.customer] || "",
                poNo: row[mapping.poNo] || "",
                poDate: row[mapping.poDate] ? new Date(row[mapping.poDate]) : null,
                deliveryNo: row[mapping.deliveryNo] || "",
                materialNo: row[mapping.materialNo] || "",
                description: row[mapping.description] || "",
                qty: Number(row[mapping.qty]) || 0,
                price: Number(row[mapping.price]) || 0,
                amount: Number(row[mapping.amount]) || 0,
            }))

            const result = await importBillingRecords(transformedData)

            if (result.success) {
                toast.success(`Successfully imported ${transformedData.length} records`)
                setOpen(false)
                resetState()
            } else {
                toast.error(result.error || "Failed to import records")
                setStep('map')
            }
        } catch (error) {
            console.error("Import error:", error)
            toast.error("An error occurred during import")
            setStep('map')
        } finally {
            setIsLoading(false)
        }
    }

    const resetState = () => {
        setFile(null)
        setStep('upload')
        setCsvData([])
        setHeaders([])
        setMapping({
            customer: "",
            poNo: "",
            poDate: "",
            deliveryNo: "",
            materialNo: "",
            description: "",
            qty: "",
            price: "",
            amount: "",
        })
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <FileUp className="mr-2 h-4 w-4" />
                    Import from SAP
                </Button>
            </DialogTrigger>
            <DialogContent className={step === 'map' ? "sm:max-w-[700px]" : "sm:max-w-[425px]"}>
                <DialogHeader>
                    <DialogTitle>Import Billing Data</DialogTitle>
                    <DialogDescription>
                        {step === 'upload' ? "Upload a CSV file from SAP to update billing records." :
                            step === 'map' ? "Match CSV columns to Billing fields." : "Importing data..."}
                    </DialogDescription>
                </DialogHeader>

                {step === 'upload' && (
                    <div className="grid gap-4 py-4">
                        <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-10 gap-4 hover:bg-muted/50 transition-colors cursor-pointer relative">
                            <Upload className="h-10 w-10 text-muted-foreground" />
                            <div className="text-center">
                                <p className="text-sm font-medium">Click to upload or drag and drop</p>
                                <p className="text-xs text-muted-foreground">CSV or Excel files only</p>
                            </div>
                            <Input
                                id="file"
                                type="file"
                                accept=".csv,.xlsx"
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                onChange={handleFileChange}
                            />
                        </div>
                        <Button variant="ghost" size="sm" onClick={downloadTemplate} className="w-full">
                            <Download className="mr-2 h-4 w-4" />
                            Download CSV Template
                        </Button>
                    </div>
                )}

                {step === 'map' && (
                    <div className="max-h-[400px] overflow-y-auto pr-2">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Billing Field</TableHead>
                                    <TableHead>CSV Column</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {dbFields.map((field) => (
                                    <TableRow key={field.id}>
                                        <TableCell className="font-medium">{field.label}</TableCell>
                                        <TableCell>
                                            <Select
                                                value={mapping[field.id]}
                                                onValueChange={(val) => setMapping(prev => ({ ...prev, [field.id]: val }))}
                                            >
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Select column..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {headers.map(h => (
                                                        <SelectItem key={h} value={h}>{h}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}

                {step === 'importing' && (
                    <div className="flex flex-col items-center justify-center py-10 gap-4">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                        <p className="text-sm font-medium">Processing {csvData.length} records...</p>
                    </div>
                )}

                <DialogFooter className="gap-2">
                    {step === 'map' && (
                        <Button variant="ghost" onClick={() => setStep('upload')}>Back</Button>
                    )}
                    <Button onClick={handleUpload} disabled={step === 'upload' || isLoading}>
                        {isLoading ? "Importing..." : step === 'map' ? "Import Now" : "Import"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
