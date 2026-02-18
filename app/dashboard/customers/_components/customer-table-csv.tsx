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
} from "@/components/ui/dialog"
import { Upload, FileUp, X, Check } from "lucide-react"
import { toast } from "sonner"
import Papa from "papaparse"
import { importCustomers } from "@/app/actions/customer"
import { NewCustomer } from "@/lib/types"

type RawCustomerData = Record<string, string>
type CustomerData = NewCustomer

export function CustomerCSVUpload({ onSuccess }: { onSuccess?: () => void }) {
    const [file, setFile] = useState<File | null>(null)
    const [isUploading, setIsUploading] = useState(false)
    const [preview, setPreview] = useState<CustomerData[]>([])
    const [isOpen, setIsOpen] = useState(false)

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
                const data = results.data as RawCustomerData[]

                // Helper to find key case-insensitively and ignoring special chars
                const findKey = (obj: any, candidates: string[]) => {
                    const keys = Object.keys(obj)
                    return keys.find(k => {
                        const normalizedKey = k.toLowerCase().replace(/[^a-z0-9]/g, "")
                        return candidates.some(c => normalizedKey === c.replace(/[^a-z0-9]/g, ""))
                    })
                }

                const normalized = data.map(item => {
                    // Extended candidate list for flexibility
                    const codeKey = findKey(item, [
                        "customercode", "customerid", "code", "id", "kode", "kodepelanggan", "no", "nomor"
                    ])
                    const nameKey = findKey(item, [
                        "customername", "name", "nama", "namapelanggan", "custname"
                    ])
                    const contactKey = findKey(item, ["contactname", "contact", "kontak", "cp"])
                    const emailKey = findKey(item, ["email", "mail", "surel"])

                    // Address fields
                    const addr1Key = findKey(item, ["address1", "address", "alamat1", "alamat"])
                    const addr2Key = findKey(item, ["address2", "alamat2"])
                    const addr3Key = findKey(item, ["address3", "alamat3"])
                    const addr4Key = findKey(item, ["address4", "alamat4"])
                    const addr5Key = findKey(item, ["address5", "alamat5"])

                    // Only return if we found at least one meaningful field, 
                    // relying on loose matching for the import to be useful.
                    // However, we MUST have at least a Name or Code to create a customer.
                    if (!codeKey && !nameKey) return null;

                    return {
                        customerCode: codeKey ? item[codeKey].toString() : `GEN-${Math.random().toString(36).substr(2, 9).toUpperCase()}`, // Fallback if needed, though usually required
                        name: nameKey ? item[nameKey].toString() : (codeKey ? item[codeKey].toString() : "Unknown"),
                        contactName: contactKey ? item[contactKey].toString() : null,
                        email: emailKey ? item[emailKey].toString() : null,
                        address1: addr1Key ? item[addr1Key].toString() : null,
                        address2: addr2Key ? item[addr2Key].toString() : null,
                        address3: addr3Key ? item[addr3Key].toString() : null,
                        address4: addr4Key ? item[addr4Key].toString() : null,
                        address5: addr5Key ? item[addr5Key].toString() : null,
                    }
                }).filter(Boolean) as CustomerData[]

                if (normalized.length === 0 && data.length > 0) {
                    // Diagnostic: Check what headers were actually found
                    const firstRowHeaders = Object.keys(data[0]).join(", ")
                    toast.error(`No valid rows found. Detected headers: ${firstRowHeaders}. Expected 'Name' or 'Customer Code'.`)
                } else if (normalized.length === 0) {
                    toast.error("File appears to be empty or could not be parsed.")
                }

                setPreview(normalized)
            },
            error: (error) => {
                toast.error("Failed to parse CSV: " + error.message)
            }
        })
    }

    const handleUpload = async () => {
        if (preview.length === 0) return

        setIsUploading(true)
        try {
            const result = await importCustomers(preview)
            if (result.success) {
                toast.success(`Successfully imported ${result.count} customers`)
                setIsOpen(false)
                setFile(null)
                setPreview([])
                onSuccess?.()
            } else {
                toast.error(result.error)
            }
        } catch (_error) {
            toast.error("Failed to import customers")
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
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Import Customers</DialogTitle>
                    <DialogDescription>
                        Upload a CSV file containing customer data.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {!file ? (
                        <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-12 text-center">
                            <input
                                type="file"
                                accept=".csv"
                                id="csv-upload"
                                className="hidden"
                                onChange={handleFileChange}
                            />
                            <label
                                htmlFor="csv-upload"
                                className="flex flex-col items-center cursor-pointer"
                            >
                                <FileUp className="h-12 w-12 text-muted-foreground mb-4" />
                                <span className="text-sm font-medium">Click to upload CSV</span>
                                <span className="text-xs text-muted-foreground mt-1">
                                    Must include Customer Code and Name columns
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
                                    onClick={() => {
                                        setFile(null)
                                        setPreview([])
                                    }}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>

                            {preview.length > 0 && (
                                <div className="max-h-[300px] overflow-auto border rounded-lg">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-muted sticky top-0">
                                            <tr>
                                                <th className="p-2 border-b">Code</th>
                                                <th className="p-2 border-b">Name</th>
                                                <th className="p-2 border-b">Email</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {preview.slice(0, 10).map((item, i) => (
                                                <tr key={i}>
                                                    <td className="p-2 border-b">{item.customerCode}</td>
                                                    <td className="p-2 border-b">{item.name}</td>
                                                    <td className="p-2 border-b">{item.email || "-"}</td>
                                                </tr>
                                            ))}
                                            {preview.length > 10 && (
                                                <tr>
                                                    <td colSpan={3} className="p-2 text-center text-muted-foreground italic">
                                                        ... and {preview.length - 10} more rows
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            <div className="flex justify-end gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setFile(null)
                                        setPreview([])
                                    }}
                                >
                                    Reset
                                </Button>
                                <Button onClick={handleUpload} disabled={isUploading || preview.length === 0}>
                                    {isUploading ? "Importing..." : "Start Import"}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
