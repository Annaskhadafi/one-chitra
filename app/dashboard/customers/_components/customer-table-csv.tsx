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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

type RawCustomerData = Record<string, string>
type CustomerData = NewCustomer
type MappableField = "customerCode" | "name" | "contactName" | "email" | "birthday" | "address1" | "address2" | "address3" | "address4" | "address5"

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

const MAPPING_FIELDS: { key: MappableField; label: string; required?: boolean }[] = [
    { key: "customerCode", label: "Customer Code", required: true },
    { key: "name", label: "Name", required: true },
    { key: "contactName", label: "Contact Name" },
    { key: "email", label: "Email" },
    { key: "birthday", label: "Birthday" },
    { key: "address1", label: "Address 1" },
    { key: "address2", label: "Address 2" },
    { key: "address3", label: "Address 3" },
    { key: "address4", label: "Address 4" },
    { key: "address5", label: "Address 5" },
]

export function CustomerCSVUpload({ onSuccess }: { onSuccess?: () => void }) {
    const [file, setFile] = useState<File | null>(null)
    const [isUploading, setIsUploading] = useState(false)
    const [preview, setPreview] = useState<CustomerData[]>([])
    const [isOpen, setIsOpen] = useState(false)
    const [rawData, setRawData] = useState<RawCustomerData[]>([])
    const [headers, setHeaders] = useState<string[]>([])
    const [manualMapping, setManualMapping] = useState<Record<MappableField, string>>({
        customerCode: "",
        name: "",
        contactName: "",
        email: "",
        birthday: "",
        address1: "",
        address2: "",
        address3: "",
        address4: "",
        address5: "",
    })
    const [showManualMapping, setShowManualMapping] = useState(false)

    const parseRowsWithMapping = (data: RawCustomerData[], resolver: (item: RawCustomerData, field: MappableField) => string | null) => {
        return data.map((item) => {
            const mappedCustomerCode = normalizeText(resolver(item, "customerCode"))
            const mappedName = normalizeText(resolver(item, "name"))

            if (!mappedCustomerCode || !mappedName) {
                return null
            }

            return {
                customerCode: mappedCustomerCode,
                name: mappedName,
                contactName: normalizeText(resolver(item, "contactName")),
                email: normalizeText(resolver(item, "email")),
                birthday: normalizeBirthday(resolver(item, "birthday")),
                address1: normalizeText(resolver(item, "address1")),
                address2: normalizeText(resolver(item, "address2")),
                address3: normalizeText(resolver(item, "address3")),
                address4: normalizeText(resolver(item, "address4")),
                address5: normalizeText(resolver(item, "address5")),
                id: undefined,
                createdAt: undefined,
                updatedAt: undefined,
            } as CustomerData
        }).filter(Boolean) as CustomerData[]
    }

    const buildInitialManualMapping = (detectedHeaders: string[]) => {
        const next = { ...manualMapping }

        MAPPING_FIELDS.forEach((field) => {
            const detected = detectedHeaders.find((header) =>
                COLUMN_CANDIDATES[field.key].some((candidate) => isHeaderMatch(header, candidate))
            )
            next[field.key] = detected || ""
        })

        setManualMapping(next)
    }

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
                const detectedHeaders = (results.meta.fields && results.meta.fields.length > 0)
                    ? results.meta.fields
                    : (data[0] ? Object.keys(data[0]) : [])

                setRawData(data)
                setHeaders(detectedHeaders)
                buildInitialManualMapping(detectedHeaders)

                const normalized = parseRowsWithMapping(data, (item, field) => {
                    const keys = Object.keys(item)
                    const keyFound = keys.find((keyName) =>
                        COLUMN_CANDIDATES[field].some((candidate) => isHeaderMatch(keyName, candidate))
                    )
                    return keyFound ? item[keyFound] : null
                })

                if (normalized.length === 0 && data.length > 0) {
                    setShowManualMapping(true)
                    const firstRowHeaders = detectedHeaders.join(", ")
                    toast.error(`Auto mapping gagal. Silakan manual mapping. Detected headers: ${firstRowHeaders}`)
                } else if (normalized.length === 0) {
                    setShowManualMapping(false)
                    toast.error("File appears to be empty or could not be parsed.")
                } else {
                    setShowManualMapping(false)
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

    const applyManualMapping = () => {
        if (rawData.length === 0) return
        if (!manualMapping.customerCode || !manualMapping.name) {
            toast.error("Manual mapping wajib memilih Customer Code dan Name")
            return
        }

        const normalized = parseRowsWithMapping(rawData, (item, field) => {
            const selectedHeader = manualMapping[field]
            return selectedHeader ? item[selectedHeader] ?? null : null
        })

        setPreview(normalized)

        if (normalized.length === 0) {
            toast.error("Tidak ada row valid setelah manual mapping")
            return
        }

        toast.success(`Manual mapping berhasil: ${normalized.length} valid rows`)
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
                                        setRawData([])
                                        setHeaders([])
                                        setShowManualMapping(false)
                                    }}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>

                            {showManualMapping && headers.length > 0 && (
                                <div className="border rounded-lg p-3 space-y-3">
                                    <div className="text-sm font-medium">Manual Mapping CSV</div>
                                    <div className="grid grid-cols-2 gap-3">
                                        {MAPPING_FIELDS.map((field) => (
                                            <div key={field.key} className="space-y-1">
                                                <div className="text-xs text-muted-foreground">
                                                    {field.label}{field.required ? " *" : ""}
                                                </div>
                                                <Select
                                                    value={manualMapping[field.key] || "__none__"}
                                                    onValueChange={(value) => {
                                                        setManualMapping((prev) => ({
                                                            ...prev,
                                                            [field.key]: value === "__none__" ? "" : value,
                                                        }))
                                                    }}
                                                >
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue placeholder="Pilih kolom CSV" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="__none__">(Tidak dipakai)</SelectItem>
                                                        {headers.map((header) => (
                                                            <SelectItem key={`${field.key}-${header}`} value={header}>
                                                                {header}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex justify-end">
                                        <Button type="button" variant="secondary" onClick={applyManualMapping}>
                                            Apply Mapping
                                        </Button>
                                    </div>
                                </div>
                            )}

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
                                        setRawData([])
                                        setHeaders([])
                                        setShowManualMapping(false)
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
