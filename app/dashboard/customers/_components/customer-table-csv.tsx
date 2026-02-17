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
import { importCustomers } from "@/app/actions/customer"
import { toast } from "sonner"
import { Upload, FileSpreadsheet } from "lucide-react"
import Papa from "papaparse"

export function CustomerCSVUpload() {
    const [isOpen, setIsOpen] = useState(false)
    const [file, setFile] = useState<File | null>(null)
    const [preview, setPreview] = useState<any[]>([])
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
                const normalized = data.map(item => {
                    const keys = Object.keys(item)

                    const codeKey = keys.find(k => k.toLowerCase().replace(/[^a-z]/g, "") === "customerid" || k.toLowerCase().replace(/[^a-z]/g, "") === "customercode")
                    const nameKey = keys.find(k => k.toLowerCase().replace(/[^a-z]/g, "") === "customername" || k.toLowerCase() === "name")
                    const contactKey = keys.find(k => k.toLowerCase().replace(/[^a-z]/g, "") === "contactname")
                    const emailKey = keys.find(k => k.toLowerCase() === "email")
                    const addr1Key = keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, "") === "address1")
                    const addr2Key = keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, "") === "address2")
                    const addr3Key = keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, "") === "address3")
                    const addr4Key = keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, "") === "address4")
                    const addr5Key = keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, "") === "address5")

                    return {
                        customerCode: codeKey ? item[codeKey] : "",
                        name: nameKey ? item[nameKey] : "",
                        contactName: contactKey ? item[contactKey] : "",
                        email: emailKey ? item[emailKey] : "",
                        address1: addr1Key ? item[addr1Key] : "",
                        address2: addr2Key ? item[addr2Key] : "",
                        address3: addr3Key ? item[addr3Key] : "",
                        address4: addr4Key ? item[addr4Key] : "",
                        address5: addr5Key ? item[addr5Key] : "",
                    }
                }).filter(item => item.customerCode && item.name)

                setPreview(normalized)
            },
            error: (error) => {
                toast.error("Failed to parse CSV: " + error.message)
            }
        })
    }

    const handleUpload = async () => {
        if (preview.length === 0) return;
        setIsUploading(true)
        try {
            const result = await importCustomers(preview)
            if (result.success) {
                toast.success(`Successfully imported ${result.count} customers`)
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
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Import Customers</DialogTitle>
                    <DialogDescription>
                        Upload a CSV with columns for Customer ID, Name, Contact, Email, and Address 1-5.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <Input
                        type="file"
                        accept=".csv"
                        onChange={handleFileChange}
                    />

                    {preview.length > 0 && (
                        <div className="rounded-md bg-muted p-4 space-y-2">
                            <div className="flex items-center gap-2">
                                <FileSpreadsheet className="h-4 w-4 text-primary" />
                                <span className="text-sm font-medium">{preview.length} customers detected</span>
                            </div>
                            <div className="text-xs text-muted-foreground max-h-[100px] overflow-y-auto border-t pt-2 mt-2">
                                {preview.slice(0, 5).map((row, i) => (
                                    <div key={i} className="truncate">
                                        [{row.customerCode}] {row.name}
                                    </div>
                                ))}
                                {preview.length > 5 && <div>...and {preview.length - 5} more</div>}
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button onClick={handleUpload} disabled={!file || preview.length === 0 || isUploading} className="w-full">
                        {isUploading ? "Importing..." : "Import Customers"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
