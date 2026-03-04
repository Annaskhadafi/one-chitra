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

const COLUMN_CANDIDATES: Record<keyof Pick<CustomerData, "customerCode" | "name" | "contactName" | "email" | "birthday" | "address1" | "address2" | "address3" | "address4" | "address5">, string[]> = {
    customerCode: ["customercode", "customer_code", "customerid", "code", "kode", "kodepelanggan", "idcustomer", "customer", "kodecustomer", "codecustomer", "customer_no", "customerno", "custcode", "sapcode"],
    name: ["name", "customername", "customer_name", "nama", "namapelanggan", "custname"],
    contactName: ["contactname", "contact_name", "contact", "kontak", "cp", "pic"],
    email: ["email", "mail", "surel"],
    birthday: ["birthday", "birthdate", "dateofbirth", "tanggal_lahir", "tanggallahir", "dob"],
    address1: ["address1", "address_1", "address", "alamat1", "alamat"],
    address2: ["address2", "address_2", "alamat2"],
    address3: ["address3", "address_3", "alamat3", "city", "kota"],
    address4: ["address4", "address_4", "alamat4", "state", "provinsi"],
    address5: ["address5", "address_5", "alamat5", "postalcode", "zip", "kodepos"],
}

const normalizeKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "")

const isHeaderMatch = (header: string, candidate: string) => {
    const normalizedHeader = normalizeKey(header)
    const normalizedCandidate = normalizeKey(candidate)

    return normalizedHeader === normalizedCandidate
        || normalizedHeader.includes(normalizedCandidate)
        || normalizedCandidate.includes(normalizedHeader)
}

const normalizeText = (value: unknown) => {
    const trimmed = value?.toString().trim()
    return trimmed ? trimmed : null
}

const normalizeBirthday = (value: unknown) => {
    const text = value?.toString().trim()
    if (!text) return null

    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        return text
    }

    const dateParts = text.split(/[\/\-\.]/)
    if (dateParts.length === 3) {
        const [first, second, third] = dateParts
        if (first.length === 2 && second.length === 2 && third.length === 4) {
            return `${third}-${second}-${first}`
        }
    }

    return null
}

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

                const normalized = data.map((item) => {
                    const keys = Object.keys(item)
                    const findValue = (candidates: string[]) => {
                        const keyFound = keys.find((keyName) => {
                            return candidates.some((candidate) => isHeaderMatch(keyName, candidate))
                        })

                        return keyFound ? item[keyFound] : null
                    }

                    const mappedCustomerCode = normalizeText(findValue(COLUMN_CANDIDATES.customerCode))
                    const mappedName = normalizeText(findValue(COLUMN_CANDIDATES.name))

                    if (!mappedCustomerCode || !mappedName) {
                        return null
                    }

                    return {
                        customerCode: mappedCustomerCode,
                        name: mappedName,
                        contactName: normalizeText(findValue(COLUMN_CANDIDATES.contactName)),
                        email: normalizeText(findValue(COLUMN_CANDIDATES.email)),
                        birthday: normalizeBirthday(findValue(COLUMN_CANDIDATES.birthday)),
                        address1: normalizeText(findValue(COLUMN_CANDIDATES.address1)),
                        address2: normalizeText(findValue(COLUMN_CANDIDATES.address2)),
                        address3: normalizeText(findValue(COLUMN_CANDIDATES.address3)),
                        address4: normalizeText(findValue(COLUMN_CANDIDATES.address4)),
                        address5: normalizeText(findValue(COLUMN_CANDIDATES.address5)),
                        id: undefined,
                        createdAt: undefined,
                        updatedAt: undefined,
                    } as CustomerData
                }).filter(Boolean) as CustomerData[]

                if (normalized.length === 0 && data.length > 0) {
                    // Diagnostic: Check what headers were actually found
                    const firstRowHeaders = Object.keys(data[0]).join(", ")
                    toast.error(`No valid rows found. Detected headers: ${firstRowHeaders}. Required mapped fields: Customer Code & Name.`)
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
                                    Must include Customer Code and Name (other fields can be auto-mapped)
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
