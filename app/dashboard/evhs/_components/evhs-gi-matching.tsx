"use client"

import { type ChangeEvent, useMemo, useRef, useState } from "react"
import { format } from "date-fns"
import Papa from "papaparse"
import * as XLSX from "xlsx"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, Search, Upload } from "lucide-react"
import { toast } from "sonner"

import { getEvhsVouchers, getGiRecords, importEvhsGiRecords } from "@/app/actions/evhs"
import { getEvhsMasterPrices } from "@/app/actions/evhs-master"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

type WarehouseOption = {
    id: number
    sloc: string
    description: string | null
}

type ParsedGiRow = Record<string, unknown>

type VoucherItem = {
    qty: number
    materialNumberCk?: string | null
    serialNumber?: string | null
    unitPrice?: string | number | null
    product?: {
        materialNumber?: string | null
        materialDescription?: string | null
    } | null
}

type EvhsVoucherRow = {
    id: number
    vhsNo: string
    woNo?: string | null
    warehouseId?: number | null
    warehouse?: WarehouseOption | null
    items?: VoucherItem[]
}

type GiItem = {
    materialNumber: string
    materialDescription?: string | null
    qty: string | number
    price?: string | number | null
}

type GiRecord = {
    id: number
    documentNo?: string | null
    woNo?: string | null
    periodDate?: string | null
    warehouseId?: number | null
    warehouse?: WarehouseOption | null
    items?: GiItem[]
}

type MasterPrice = {
    warehouseId: number
    materialNumberCp?: string | null
    materialNumberCk?: string | null
    price: string | number
}

type MappingState = {
    sloc: string
    documentNo: string
    woNo: string
    materialNumber: string
    qty: string
    price: string
    periodDate: string
}

type GiImportSummary = {
    imported: number
    failed: number
    parseErrors: string[]
    serverErrors: {
        record: number
        reference: string
        error: string
    }[]
}

type MatchStatus = "MATCHED" | "UNMATCHED" | "PENDING"
type ExceptionCategory = "ALL" | "PENDING_GI" | "MISMATCH" | "ORPHAN_GI"

type GiMatchRow = {
    rowId: string
    voucherId: number
    vhsNo: string
    woNo?: string | null
    warehouseId?: number | null
    warehouse?: WarehouseOption | null
    item: VoucherItem | null
    price: number | null
    ckPrice: number | null
    matchedGi: GiRecord | null
    giItem: GiItem | null
    matchStatus: MatchStatus
    issues: string[]
}

type GiExceptionRow = {
    id: string
    category: Exclude<ExceptionCategory, "ALL">
    source: "Voucher" | "GI"
    severity: "high" | "medium"
    site: string
    reference: string
    material: string
    voucherNo: string
    woNo: string
    giNo: string
    issue: string
    detail: string
    action: string
}

const defaultMapping: MappingState = {
    sloc: "",
    documentNo: "",
    woNo: "",
    materialNumber: "",
    qty: "",
    price: "",
    periodDate: "",
}

function normalizeHeader(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "")
}

function findHeader(headers: string[], candidates: string[]) {
    const normalizedCandidates = candidates.map(normalizeHeader)

    return headers.find((header) => {
        const normalizedHeader = normalizeHeader(header)

        return normalizedCandidates.some((candidate) => (
            normalizedHeader === candidate ||
            normalizedHeader.includes(candidate) ||
            candidate.includes(normalizedHeader)
        ))
    }) || ""
}

function getStringValue(row: ParsedGiRow, header: string) {
    if (!header) return ""

    const value = row[header]

    if (value == null) return ""
    if (typeof value === "string") return value.trim()
    if (typeof value === "number") return Number.isFinite(value) ? value.toString() : ""
    if (value instanceof Date) return format(value, "yyyy-MM-dd")

    return String(value).trim()
}

function parseNumberValue(value: unknown) {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : null
    }

    if (typeof value !== "string") {
        return null
    }

    const raw = value.trim().replace(/\s+/g, "")
    if (!raw) return null

    let normalized = raw

    if (normalized.includes(",") && normalized.includes(".")) {
        if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) {
            normalized = normalized.replace(/\./g, "").replace(",", ".")
        } else {
            normalized = normalized.replace(/,/g, "")
        }
    } else if (normalized.includes(",")) {
        const segments = normalized.split(",")
        normalized = segments.length === 2 && segments[1].length <= 2
            ? normalized.replace(",", ".")
            : normalized.replace(/,/g, "")
    }

    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
}

function toIsoDate(date: Date) {
    return format(date, "yyyy-MM-dd")
}

function parseDateValue(value: unknown) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return toIsoDate(value)
    }

    if (typeof value === "number") {
        const parsed = XLSX.SSF.parse_date_code(value)
        if (parsed?.y && parsed?.m && parsed?.d) {
            return toIsoDate(new Date(parsed.y, parsed.m - 1, parsed.d))
        }
        return null
    }

    if (typeof value !== "string") {
        return null
    }

    const raw = value.trim()
    if (!raw) return null

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        return raw
    }

    const directDate = new Date(raw)
    if (!Number.isNaN(directDate.getTime())) {
        return toIsoDate(directDate)
    }

    const parts = raw.split(/[./-]/).map((part) => part.trim())
    if (parts.length !== 3) {
        return null
    }

    let year = 0
    let month = 0
    let day = 0

    if (parts[0].length === 4) {
        year = Number(parts[0])
        month = Number(parts[1])
        day = Number(parts[2])
    } else if (parts[2].length === 4) {
        day = Number(parts[0])
        month = Number(parts[1])
        year = Number(parts[2])
    }

    if (!year || !month || !day) {
        return null
    }

    const parsed = new Date(year, month - 1, day)
    return Number.isNaN(parsed.getTime()) ? null : toIsoDate(parsed)
}

async function parseGiFile(file: File): Promise<{ headers: string[]; rows: ParsedGiRow[] }> {
    const isCsvFile = file.name.toLowerCase().endsWith(".csv")

    if (isCsvFile) {
        return new Promise((resolve, reject) => {
            Papa.parse<ParsedGiRow>(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    const rows = (results.data || []).filter((row) => (
                        Object.values(row || {}).some((value) => String(value ?? "").trim() !== "")
                    ))
                    const headers = results.meta.fields || Object.keys(rows[0] || {})

                    resolve({ headers, rows })
                },
                error: (error) => reject(error),
            })
        })
    }

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true })
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<ParsedGiRow>(firstSheet, {
        defval: "",
        raw: false,
    }).filter((row) => (
        Object.values(row || {}).some((value) => String(value ?? "").trim() !== "")
    ))
    const headers = Object.keys(rows[0] || {})

    return { headers, rows }
}

function findMasterPrice(masterPrices: MasterPrice[], materialCp?: string, materialCk?: string, warehouseId?: number) {
    if (!warehouseId) return null

    const found = masterPrices.find((price) => (
        price.warehouseId === warehouseId &&
        (
            (materialCp && price.materialNumberCp === materialCp) ||
            (materialCk && price.materialNumberCk === materialCk)
        )
    ))

    return found ? Number(found.price) : null
}

function formatWarehouseLabel(warehouse?: WarehouseOption | null) {
    if (!warehouse) return "-"

    if (warehouse.description) {
        return `${warehouse.sloc} - ${warehouse.description}`
    }

    return warehouse.sloc
}

function getExceptionBadgeClass(category: GiExceptionRow["category"]) {
    if (category === "PENDING_GI") {
        return "border-amber-200 bg-amber-50 text-amber-700"
    }

    if (category === "MISMATCH") {
        return "border-rose-200 bg-rose-50 text-rose-700"
    }

    return "border-blue-200 bg-blue-50 text-blue-700"
}

export function EvhsGiMatching({ warehouses = [] }: { warehouses?: WarehouseOption[] }) {
    const queryClient = useQueryClient()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [searchTerm, setSearchTerm] = useState("")
    const [exceptionFilter, setExceptionFilter] = useState<ExceptionCategory>("ALL")
    const [isImportOpen, setIsImportOpen] = useState(false)
    const [importStep, setImportStep] = useState<"mapping" | "processing" | "result">("mapping")
    const [headers, setHeaders] = useState<string[]>([])
    const [parsedRows, setParsedRows] = useState<ParsedGiRow[]>([])
    const [fallbackWarehouseId, setFallbackWarehouseId] = useState("")
    const [mapping, setMapping] = useState<MappingState>(defaultMapping)
    const [importSummary, setImportSummary] = useState<GiImportSummary | null>(null)

    const { data: giRecords = [], isLoading: giRecordsLoading } = useQuery<GiRecord[]>({
        queryKey: ["evhs-gi-records"],
        queryFn: getGiRecords,
    })

    const { data: vouchers = [], isLoading: vouchersLoading } = useQuery<EvhsVoucherRow[]>({
        queryKey: ["evhs-vouchers"],
        queryFn: getEvhsVouchers,
    })

    const { data: masterPrices = [], isLoading: masterPricesLoading } = useQuery<MasterPrice[]>({
        queryKey: ["evhs-master-prices"],
        queryFn: getEvhsMasterPrices,
    })

    const importMutation = useMutation({
        mutationFn: importEvhsGiRecords,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["evhs-gi-records"] })
            queryClient.invalidateQueries({ queryKey: ["evhs-mrko-data"] })
        },
    })

    const warehouseLookup = useMemo(() => (
        new Map(
            warehouses
                .filter((warehouse) => Boolean(warehouse.sloc))
                .map((warehouse) => [normalizeHeader(warehouse.sloc), warehouse])
        )
    ), [warehouses])

    const rawMatchingData = useMemo<GiMatchRow[]>(() => {
        const rows: GiMatchRow[] = []

        for (const voucher of vouchers) {
            const voucherItems = voucher.items && voucher.items.length > 0 ? voucher.items : [null]

            voucherItems.forEach((voucherItem, index) => {
                const materialCp = voucherItem?.product?.materialNumber || ""
                const materialCk = voucherItem?.materialNumberCk || ""

                const matchedGi = giRecords.find((gi) => {
                    const warehouseMatches = !gi.warehouseId || gi.warehouseId === voucher.warehouseId
                    const woMatches = Boolean(voucher.woNo) && gi.woNo === voucher.woNo
                    const materialMatches = Boolean(materialCk) && gi.items?.some((item) => item.materialNumber === materialCk)

                    return warehouseMatches && (woMatches || materialMatches)
                }) || null

                const giItem = materialCk
                    ? matchedGi?.items?.find((item) => item.materialNumber === materialCk) || matchedGi?.items?.[0] || null
                    : matchedGi?.items?.[0] || null

                const price = voucherItem?.unitPrice != null
                    ? Number(voucherItem.unitPrice)
                    : findMasterPrice(masterPrices, materialCp, materialCk, voucher.warehouseId)
                const ckMasterPrice = findMasterPrice(masterPrices, undefined, giItem?.materialNumber, voucher.warehouseId)
                const giLinePrice = giItem?.price != null ? Number(giItem.price) : null
                const ckPrice = ckMasterPrice ?? giLinePrice

                const issues: string[] = []

                if (!matchedGi) {
                    if (!voucher.woNo && !materialCk) {
                        issues.push("WO dan material CK belum diisi")
                    } else {
                        if (!voucher.woNo) {
                            issues.push("WO voucher belum diisi")
                        }
                        if (!materialCk) {
                            issues.push("Material CK belum diisi")
                        }
                    }

                    issues.push("Dokumen GI belum ditemukan")
                } else {
                    if (!materialCk) {
                        issues.push("Material CK belum diisi")
                    }

                    if (!giItem) {
                        issues.push("Material GI tidak ditemukan pada dokumen yang match")
                    } else {
                        if (materialCk && giItem.materialNumber !== materialCk) {
                            issues.push("Material CK tidak sama dengan material GI")
                        }

                        if (Number(giItem.qty) !== Number(voucherItem?.qty || 0)) {
                            issues.push("Qty voucher dan qty GI berbeda")
                        }
                    }

                    if (price != null && ckPrice != null && Math.abs(price - ckPrice) > 0.01) {
                        issues.push("Harga master dan harga GI berbeda")
                    }
                }

                const matchStatus: MatchStatus = !matchedGi
                    ? "PENDING"
                    : issues.length > 0
                        ? "UNMATCHED"
                        : "MATCHED"

                rows.push({
                    rowId: `${voucher.id}-${index}`,
                    voucherId: voucher.id,
                    vhsNo: voucher.vhsNo,
                    woNo: voucher.woNo,
                    warehouseId: voucher.warehouseId,
                    warehouse: voucher.warehouse,
                    item: voucherItem,
                    price,
                    ckPrice,
                    matchedGi,
                    giItem,
                    matchStatus,
                    issues,
                })
            })
        }

        return rows
    }, [giRecords, masterPrices, vouchers])

    const matchingData = useMemo(() => {
        if (!searchTerm.trim()) {
            return rawMatchingData
        }

        const query = searchTerm.toLowerCase()
        return rawMatchingData.filter((row) => (
            [
                row.vhsNo,
                row.woNo,
                row.item?.materialNumberCk,
                row.item?.product?.materialNumber,
                row.matchedGi?.documentNo,
                row.giItem?.materialNumber,
                row.giItem?.materialDescription,
            ].some((value) => String(value ?? "").toLowerCase().includes(query))
        ))
    }, [rawMatchingData, searchTerm])

    const exceptionQueue = useMemo<GiExceptionRow[]>(() => {
        const exceptions: GiExceptionRow[] = []

        for (const row of rawMatchingData) {
            if (row.matchStatus === "MATCHED") {
                continue
            }

            const category: GiExceptionRow["category"] = row.matchedGi ? "MISMATCH" : "PENDING_GI"
            const detail = row.issues.join("; ")

            exceptions.push({
                id: `voucher-${row.rowId}`,
                category,
                source: "Voucher",
                severity: row.matchedGi ? "medium" : "high",
                site: formatWarehouseLabel(row.warehouse),
                reference: row.vhsNo,
                material: row.item?.materialNumberCk || row.item?.product?.materialNumber || "-",
                voucherNo: row.vhsNo,
                woNo: row.woNo || "-",
                giNo: row.matchedGi?.documentNo || "-",
                issue: category === "PENDING_GI" ? "GI belum match" : "Mismatch data GI",
                detail,
                action: category === "PENDING_GI"
                    ? "Periksa WO atau material CK pada voucher, lalu pastikan file GI customer sudah diimport."
                    : "Cek qty, material CK, dan harga pada voucher atau file GI lalu lakukan koreksi.",
            })
        }

        const matchedGiRecordIds = new Set(
            rawMatchingData
                .map((row) => row.matchedGi?.id)
                .filter((id): id is number => typeof id === "number")
        )

        for (const giRecord of giRecords) {
            if (matchedGiRecordIds.has(giRecord.id)) {
                continue
            }

            const materialSummary = giRecord.items?.map((item) => `${item.materialNumber} (${Number(item.qty)})`).join(", ") || "-"

            exceptions.push({
                id: `gi-${giRecord.id}`,
                category: "ORPHAN_GI",
                source: "GI",
                severity: "medium",
                site: formatWarehouseLabel(giRecord.warehouse),
                reference: giRecord.documentNo || giRecord.woNo || `GI Record #${giRecord.id}`,
                material: materialSummary,
                voucherNo: "-",
                woNo: giRecord.woNo || "-",
                giNo: giRecord.documentNo || "-",
                issue: "GI tanpa voucher pasangan",
                detail: "Dokumen GI sudah terimport tetapi belum punya voucher atau WO/material CK yang cocok.",
                action: "Tinjau WO customer, material CK, dan voucher VHS yang terkait sebelum MRKO dijalankan.",
            })
        }

        return exceptions
    }, [giRecords, rawMatchingData])

    const filteredExceptionQueue = useMemo(() => {
        const baseRows = exceptionFilter === "ALL"
            ? exceptionQueue
            : exceptionQueue.filter((row) => row.category === exceptionFilter)

        if (!searchTerm.trim()) {
            return baseRows
        }

        const query = searchTerm.toLowerCase()
        return baseRows.filter((row) => (
            [row.reference, row.material, row.voucherNo, row.woNo, row.giNo, row.site, row.detail, row.issue]
                .some((value) => String(value ?? "").toLowerCase().includes(query))
        ))
    }, [exceptionFilter, exceptionQueue, searchTerm])

    const exceptionSummary = useMemo(() => ({
        total: exceptionQueue.length,
        pendingGi: exceptionQueue.filter((row) => row.category === "PENDING_GI").length,
        mismatch: exceptionQueue.filter((row) => row.category === "MISMATCH").length,
        orphanGi: exceptionQueue.filter((row) => row.category === "ORPHAN_GI").length,
    }), [exceptionQueue])

    const importPreviewRows = useMemo(() => (
        parsedRows.slice(0, 5).map((row, index) => ({
            id: `${index}`,
            sloc: getStringValue(row, mapping.sloc),
            documentNo: getStringValue(row, mapping.documentNo),
            woNo: getStringValue(row, mapping.woNo),
            materialNumber: getStringValue(row, mapping.materialNumber),
            qty: getStringValue(row, mapping.qty),
            price: getStringValue(row, mapping.price),
            periodDate: getStringValue(row, mapping.periodDate),
        }))
    ), [mapping, parsedRows])

    const importDedupeSummary = useMemo(() => {
        if (parsedRows.length === 0 || !mapping.materialNumber || !mapping.qty) {
            return { duplicateRows: 0, uniqueGroups: 0 }
        }

        const groups = new Map<string, number>()

        for (const row of parsedRows) {
            const key = [
                getStringValue(row, mapping.sloc) || fallbackWarehouseId || "-",
                getStringValue(row, mapping.documentNo) || "-",
                getStringValue(row, mapping.woNo) || "-",
                getStringValue(row, mapping.materialNumber) || "-",
                getStringValue(row, mapping.periodDate) || "-",
            ].join("|")

            groups.set(key, (groups.get(key) || 0) + 1)
        }

        const duplicateRows = Array.from(groups.values()).reduce((total, count) => total + Math.max(count - 1, 0), 0)

        return {
            duplicateRows,
            uniqueGroups: groups.size,
        }
    }, [fallbackWarehouseId, mapping, parsedRows])

    const isLoading = giRecordsLoading || vouchersLoading || masterPricesLoading

    const resetImportState = () => {
        setHeaders([])
        setParsedRows([])
        setFallbackWarehouseId("")
        setMapping(defaultMapping)
        setImportSummary(null)
        setImportStep("mapping")

        if (fileInputRef.current) {
            fileInputRef.current.value = ""
        }
    }

    const handleDialogOpenChange = (open: boolean) => {
        if (!open && importMutation.isPending) {
            return
        }

        setIsImportOpen(open)
        if (!open) {
            resetImportState()
        }
    }

    const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        try {
            const parsed = await parseGiFile(file)
            const availableHeaders = parsed.headers.length > 0 ? parsed.headers : Object.keys(parsed.rows[0] || {})

            if (parsed.rows.length === 0 || availableHeaders.length === 0) {
                toast.error("File tidak berisi data GI yang bisa diproses")
                return
            }

            setHeaders(availableHeaders)
            setParsedRows(parsed.rows)
            setImportSummary(null)
            setMapping({
                sloc: findHeader(availableHeaders, ["sloc", "site", "warehouse"]),
                documentNo: findHeader(availableHeaders, ["documentno", "nogi", "ginumber", "gidoc"]),
                woNo: findHeader(availableHeaders, ["wono", "wo", "workorder"]),
                materialNumber: findHeader(availableHeaders, ["materialnumber", "materialck", "material", "itemcode"]),
                qty: findHeader(availableHeaders, ["qty", "quantity"]),
                price: findHeader(availableHeaders, ["price", "harga", "amount"]),
                periodDate: findHeader(availableHeaders, ["perioddate", "tanggal", "date", "postingdate"]),
            })
            setImportStep("mapping")
            setIsImportOpen(true)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Gagal membaca file GI")
        } finally {
            event.target.value = ""
        }
    }

    const handleImport = async () => {
        if (!mapping.materialNumber || !mapping.qty) {
            toast.error("Kolom material dan qty wajib dipetakan")
            return
        }

        if (!mapping.sloc && !fallbackWarehouseId) {
            toast.error("Pilih kolom SLOC atau tentukan fallback warehouse")
            return
        }

        setImportStep("processing")
        setImportSummary(null)

        const parseErrors: string[] = []
        const groupedRecords = new Map<string, {
            warehouseId: number
            periodDate: string
            documentNo?: string
            woNo?: string
            items: {
                materialNumber: string
                qty: number
                price?: number
            }[]
        }>()

        for (const [index, row] of parsedRows.entries()) {
            const sloc = getStringValue(row, mapping.sloc)
            const warehouseFromRow = sloc ? warehouseLookup.get(normalizeHeader(sloc)) : undefined
            const warehouseId = warehouseFromRow?.id || (fallbackWarehouseId ? Number(fallbackWarehouseId) : 0)
            const materialNumber = getStringValue(row, mapping.materialNumber)
            const qtyValue = mapping.qty ? parseNumberValue(row[mapping.qty]) : null
            const priceRaw = getStringValue(row, mapping.price)
            const priceValue = mapping.price ? parseNumberValue(row[mapping.price]) : null
            const documentNo = getStringValue(row, mapping.documentNo) || undefined
            const woNo = getStringValue(row, mapping.woNo) || undefined
            const periodDate = parseDateValue(mapping.periodDate ? row[mapping.periodDate] : undefined) || toIsoDate(new Date())

            if (!warehouseId) {
                parseErrors.push(`Baris ${index + 2}: warehouse untuk SLOC "${sloc || "-"}" tidak ditemukan`)
                continue
            }

            if (!materialNumber) {
                parseErrors.push(`Baris ${index + 2}: material number wajib diisi`)
                continue
            }

            if (!qtyValue || qtyValue <= 0) {
                parseErrors.push(`Baris ${index + 2}: qty "${getStringValue(row, mapping.qty)}" tidak valid`)
                continue
            }

            if (priceRaw && priceValue == null) {
                parseErrors.push(`Baris ${index + 2}: price "${priceRaw}" tidak valid`)
                continue
            }

            const key = [warehouseId, documentNo || "", woNo || "", periodDate].join("|")
            const groupedRecord = groupedRecords.get(key) || {
                warehouseId,
                periodDate,
                documentNo,
                woNo,
                items: [],
            }

            const existingItem = groupedRecord.items.find((item) => (
                item.materialNumber === materialNumber &&
                (item.price ?? null) === (priceValue ?? null)
            ))

            if (existingItem) {
                existingItem.qty += qtyValue
            } else {
                groupedRecord.items.push({
                    materialNumber,
                    qty: qtyValue,
                    ...(priceValue != null ? { price: priceValue } : {}),
                })
            }

            groupedRecords.set(key, groupedRecord)
        }

        if (groupedRecords.size === 0) {
            setImportSummary({
                imported: 0,
                failed: parseErrors.length,
                parseErrors,
                serverErrors: [],
            })
            setImportStep("result")
            toast.error("Tidak ada data GI valid yang bisa diimport")
            return
        }

        try {
            const result = await importMutation.mutateAsync(Array.from(groupedRecords.values()))
            const summary: GiImportSummary = {
                imported: result.imported,
                failed: parseErrors.length + result.failed,
                parseErrors,
                serverErrors: result.errors || [],
            }

            setImportSummary(summary)
            setImportStep("result")

            if (summary.failed === 0) {
                toast.success(`${summary.imported} record GI berhasil diimport`)
            } else if (summary.imported > 0) {
                toast.success(`${summary.imported} record GI diimport, ${summary.failed} baris perlu ditinjau`)
            } else {
                toast.error("Import GI gagal diproses")
            }
        } catch (error) {
            setImportSummary({
                imported: 0,
                failed: parseErrors.length + 1,
                parseErrors,
                serverErrors: [
                    {
                        record: 0,
                        reference: "request",
                        error: error instanceof Error ? error.message : "Gagal mengirim data import GI",
                    },
                ],
            })
            setImportStep("result")
            toast.error("Import GI gagal dijalankan")
        }
    }

    return (
        <div className="space-y-4">
            <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xls,.xlsx"
                className="hidden"
                onChange={handleFileSelect}
            />

            <Dialog open={isImportOpen} onOpenChange={handleDialogOpenChange}>
                <DialogContent className={cn(importStep === "result" ? "sm:max-w-3xl" : "sm:max-w-xl")}>
                    <DialogHeader>
                        <DialogTitle>Import GI Customer</DialogTitle>
                        <DialogDescription>
                            {importStep === "mapping" && "Petakan kolom file GI ke field EVHS sebelum diproses."}
                            {importStep === "processing" && "Data GI sedang diproses dan dikelompokkan per dokumen."}
                            {importStep === "result" && "Hasil import GI siap ditinjau."}
                        </DialogDescription>
                    </DialogHeader>

                    {importStep === "mapping" && (
                        <div className="space-y-4">
                            <div className="rounded-lg border bg-slate-50 p-3 text-xs text-slate-600">
                                Terdeteksi {parsedRows.length} baris dengan {headers.length} kolom dari file yang dipilih.
                            </div>

                            <div className="grid gap-3">
                                {[
                                    { key: "sloc", label: "SLOC / Site", required: false },
                                    { key: "documentNo", label: "Document / GI No", required: false },
                                    { key: "woNo", label: "WO Number", required: false },
                                    { key: "materialNumber", label: "Material Number", required: true },
                                    { key: "qty", label: "Quantity", required: true },
                                    { key: "price", label: "Price", required: false },
                                    { key: "periodDate", label: "Period Date", required: false },
                                ].map((field) => (
                                    <div key={field.key} className="grid gap-2 sm:grid-cols-[180px,1fr] sm:items-center">
                                        <Label className="text-xs font-semibold uppercase tracking-wide">
                                            {field.label} {field.required ? <span className="text-red-500">*</span> : null}
                                        </Label>
                                        <select
                                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                                            value={mapping[field.key as keyof MappingState]}
                                            onChange={(event) => setMapping((current) => ({
                                                ...current,
                                                [field.key]: event.target.value,
                                            }))}
                                        >
                                            <option value="">Pilih kolom...</option>
                                            {headers.map((header) => (
                                                <option key={header} value={header}>{header}</option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-2 rounded-lg border border-dashed p-3">
                                <Label htmlFor="fallbackWarehouse" className="text-xs font-semibold uppercase tracking-wide">
                                    Fallback Warehouse
                                </Label>
                                <select
                                    id="fallbackWarehouse"
                                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                                    value={fallbackWarehouseId}
                                    onChange={(event) => setFallbackWarehouseId(event.target.value)}
                                >
                                    <option value="">Pilih warehouse...</option>
                                    {warehouses.map((warehouse) => (
                                        <option key={warehouse.id} value={warehouse.id}>
                                            {warehouse.sloc} - {warehouse.description || "Tanpa deskripsi"}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-[11px] text-muted-foreground">
                                    Dipakai jika file tidak punya kolom SLOC atau ada baris yang site-nya kosong.
                                </p>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-3">
                                <div className="rounded-lg border bg-blue-50 p-3">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">Preview Rows</p>
                                    <p className="mt-2 text-2xl font-bold text-blue-900">{importPreviewRows.length}</p>
                                    <p className="text-[11px] text-blue-700">5 baris pertama dari file hasil mapping</p>
                                </div>
                                <div className="rounded-lg border bg-amber-50 p-3">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Unique Groups</p>
                                    <p className="mt-2 text-2xl font-bold text-amber-900">{importDedupeSummary.uniqueGroups}</p>
                                    <p className="text-[11px] text-amber-700">Grouping berdasarkan site, GI, WO, material, dan periode</p>
                                </div>
                                <div className="rounded-lg border bg-rose-50 p-3">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-700">Estimated Duplicates</p>
                                    <p className="mt-2 text-2xl font-bold text-rose-900">{importDedupeSummary.duplicateRows}</p>
                                    <p className="text-[11px] text-rose-700">Baris ganda yang akan digabung saat import</p>
                                </div>
                            </div>

                            <div className="space-y-2 rounded-lg border p-3">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Preview Hasil Mapping</p>
                                    <p className="text-[11px] text-muted-foreground">
                                        Gunakan preview ini untuk cek apakah SLOC, WO, material, qty, dan tanggal sudah terbaca benar sebelum import.
                                    </p>
                                </div>
                                <div className="overflow-auto">
                                    <Table className="min-w-[760px]">
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>SLOC</TableHead>
                                                <TableHead>GI No</TableHead>
                                                <TableHead>WO</TableHead>
                                                <TableHead>Material</TableHead>
                                                <TableHead className="text-right">Qty</TableHead>
                                                <TableHead className="text-right">Price</TableHead>
                                                <TableHead>Period</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {importPreviewRows.map((row) => (
                                                <TableRow key={row.id} className="text-xs">
                                                    <TableCell>{row.sloc || (fallbackWarehouseId ? "Fallback" : "-")}</TableCell>
                                                    <TableCell className="font-mono">{row.documentNo || "-"}</TableCell>
                                                    <TableCell className="font-mono">{row.woNo || "-"}</TableCell>
                                                    <TableCell className="font-mono">{row.materialNumber || "-"}</TableCell>
                                                    <TableCell className="text-right font-mono">{row.qty || "-"}</TableCell>
                                                    <TableCell className="text-right font-mono">{row.price || "-"}</TableCell>
                                                    <TableCell>{row.periodDate || "-"}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>

                            <DialogFooter>
                                <Button variant="outline" onClick={() => handleDialogOpenChange(false)}>
                                    Batal
                                </Button>
                                <Button onClick={handleImport} className="bg-blue-600 hover:bg-blue-700 text-white">
                                    Mulai Import
                                </Button>
                            </DialogFooter>
                        </div>
                    )}

                    {importStep === "processing" && (
                        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                            <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
                            <div className="space-y-1">
                                <p className="text-sm font-semibold">Memproses {parsedRows.length} baris GI</p>
                                <p className="text-xs text-muted-foreground">Mohon tunggu, data sedang divalidasi dan disimpan.</p>
                            </div>
                        </div>
                    )}

                    {importStep === "result" && importSummary && (
                        <div className="space-y-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-center">
                                    <p className="text-2xl font-bold text-emerald-700">{importSummary.imported}</p>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Record berhasil</p>
                                </div>
                                <div className="rounded-lg border border-rose-100 bg-rose-50 p-4 text-center">
                                    <p className="text-2xl font-bold text-rose-700">{importSummary.failed}</p>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">Baris gagal</p>
                                </div>
                            </div>

                            {importSummary.parseErrors.length > 0 && (
                                <div className="space-y-2 rounded-lg border p-3">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Validasi file</p>
                                    <div className="max-h-40 space-y-2 overflow-auto text-xs text-slate-700">
                                        {importSummary.parseErrors.map((error, index) => (
                                            <div key={`${error}-${index}`} className="rounded bg-amber-50 px-2 py-1">
                                                {error}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {importSummary.serverErrors.length > 0 && (
                                <div className="space-y-2 rounded-lg border p-3">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Error penyimpanan</p>
                                    <div className="max-h-40 space-y-2 overflow-auto text-xs text-slate-700">
                                        {importSummary.serverErrors.map((error) => (
                                            <div key={`${error.record}-${error.reference}`} className="rounded bg-rose-50 px-2 py-1">
                                                Record {error.record || "-"} ({error.reference}): {error.error}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <DialogFooter>
                                <Button onClick={() => handleDialogOpenChange(false)} className="w-full">
                                    Tutup
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <div className="flex flex-col gap-4 rounded-lg border border-blue-100 bg-blue-50 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                    <h4 className="text-sm font-bold text-blue-900">Import GI Excel Customer</h4>
                    <p className="text-xs text-blue-700">
                        Upload file CSV atau Excel GI harian customer, lalu cocokkan dengan voucher VHS yang sudah terbit.
                    </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="relative min-w-[260px] flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Cari voucher, WO, material CK, atau GI..."
                            className="bg-white pl-8"
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                        />
                    </div>
                    <Button
                        variant="outline"
                        className="bg-white border-blue-200 text-blue-700 hover:bg-blue-100"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={importMutation.isPending}
                    >
                        {importMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                        Upload CSV / Excel
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
                {[
                    {
                        key: "ALL" as const,
                        title: "Total Exception",
                        value: exceptionSummary.total,
                        tone: "text-slate-800 border-slate-200 bg-white",
                    },
                    {
                        key: "PENDING_GI" as const,
                        title: "GI Belum Match",
                        value: exceptionSummary.pendingGi,
                        tone: "text-amber-700 border-amber-200 bg-amber-50",
                    },
                    {
                        key: "MISMATCH" as const,
                        title: "Mismatch Voucher vs GI",
                        value: exceptionSummary.mismatch,
                        tone: "text-rose-700 border-rose-200 bg-rose-50",
                    },
                    {
                        key: "ORPHAN_GI" as const,
                        title: "GI Tanpa Voucher",
                        value: exceptionSummary.orphanGi,
                        tone: "text-blue-700 border-blue-200 bg-blue-50",
                    },
                ].map((card) => (
                    <button
                        key={card.key}
                        type="button"
                        onClick={() => setExceptionFilter(card.key)}
                        className={cn(
                            "text-left transition-transform hover:-translate-y-0.5",
                            exceptionFilter === card.key && "ring-2 ring-blue-500 ring-offset-2 rounded-lg"
                        )}
                    >
                        <Card className={cn("h-full border shadow-sm", card.tone)}>
                            <CardContent className="flex items-center justify-between p-4">
                                <div className="space-y-1">
                                    <p className="text-xs font-semibold uppercase tracking-wide">{card.title}</p>
                                    <p className="text-2xl font-bold">{card.value}</p>
                                </div>
                                <Badge variant="outline" className="bg-white/70">
                                    {card.key === "ALL" ? "Semua" : "Filter"}
                                </Badge>
                            </CardContent>
                        </Card>
                    </button>
                ))}
            </div>

            <div className="rounded-md border bg-card overflow-auto shadow-sm">
                <Table className="min-w-[1280px]">
                    <TableHeader>
                        <TableRow className="bg-slate-50 border-b-2">
                            <TableHead colSpan={7} className="bg-blue-50/50 py-1 text-center text-[10px] font-bold tracking-widest text-blue-800 uppercase border-r">
                                PT. CHITRA PARATAMA
                            </TableHead>
                            <TableHead colSpan={6} className="bg-emerald-50/50 py-1 text-center text-[10px] font-bold tracking-widest text-emerald-800 uppercase border-r">
                                PT. CIPTA KRIDATAMA
                            </TableHead>
                            <TableHead className="py-1 text-center text-[10px] font-bold tracking-widest text-slate-800 uppercase">
                                Status
                            </TableHead>
                        </TableRow>
                        <TableRow className="bg-slate-100/50 text-[9px] font-bold tracking-tighter uppercase">
                            <TableHead className="border-r px-2">Material Description</TableHead>
                            <TableHead className="border-r px-2">Material Number</TableHead>
                            <TableHead className="border-r px-2 text-center bg-amber-50">Mat Number CK</TableHead>
                            <TableHead className="border-r px-2">Serial Number</TableHead>
                            <TableHead className="border-r px-2">WO</TableHead>
                            <TableHead className="border-r px-2 text-center">Qty</TableHead>
                            <TableHead className="border-r px-2 text-right bg-blue-50 font-bold text-blue-800">Price (Voucher CK)</TableHead>
                            <TableHead className="border-r px-2">Material Description</TableHead>
                            <TableHead className="border-r px-2 bg-amber-50">Material Number CK</TableHead>
                            <TableHead className="border-r px-2">WO</TableHead>
                            <TableHead className="border-r px-2 text-center">Qty</TableHead>
                            <TableHead className="border-r px-2 text-right font-bold text-emerald-800">Price (GI / Master CK)</TableHead>
                            <TableHead className="border-r px-2">No GI</TableHead>
                            <TableHead className="px-2 text-center">Matched / Unmatched</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={14} className="h-24 text-center">
                                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Memuat data GI matching...
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : matchingData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={14} className="h-24 text-center text-muted-foreground italic">
                                    Belum ada data penggunaan yang cocok dengan filter saat ini.
                                </TableCell>
                            </TableRow>
                        ) : (
                            matchingData.map((data) => (
                                <TableRow
                                    key={data.rowId}
                                    className={cn(
                                        "text-[10px] transition-colors hover:bg-slate-50",
                                        data.matchStatus === "MATCHED" && "bg-emerald-50/20",
                                        data.matchStatus === "UNMATCHED" && "bg-rose-50/20",
                                    )}
                                >
                                    <TableCell className="max-w-[150px] truncate border-r px-2" title={data.item?.product?.materialDescription || ""}>
                                        {data.item?.product?.materialDescription || "-"}
                                    </TableCell>
                                    <TableCell className="border-r px-2 font-mono">{data.item?.product?.materialNumber || "-"}</TableCell>
                                    <TableCell className="border-r bg-amber-50/30 px-2 font-mono font-bold text-blue-700">
                                        {data.item?.materialNumberCk || "-"}
                                    </TableCell>
                                    <TableCell className="border-r px-2 font-mono italic">{data.item?.serialNumber || "-"}</TableCell>
                                    <TableCell className="border-r px-2 font-bold">{data.woNo || "-"}</TableCell>
                                    <TableCell className="border-r px-2 text-center font-bold">{data.item?.qty || 0}</TableCell>
                                    <TableCell className="border-r bg-blue-100/40 px-2 text-right font-mono font-bold text-blue-900">
                                        {data.price != null
                                            ? Number(data.price).toLocaleString("id-ID", { minimumFractionDigits: 2 })
                                            : "-"}
                                    </TableCell>
                                    <TableCell className="max-w-[150px] truncate border-r px-2 italic text-slate-500">
                                        {data.giItem?.materialDescription || "-"}
                                    </TableCell>
                                    <TableCell className="border-r bg-amber-50/30 px-2 font-mono">
                                        {data.giItem?.materialNumber || "-"}
                                    </TableCell>
                                    <TableCell className="border-r px-2 font-medium">{data.matchedGi?.woNo || "-"}</TableCell>
                                    <TableCell className="border-r px-2 text-center font-bold">
                                        {data.giItem?.qty ? Number(data.giItem.qty) : "-"}
                                    </TableCell>
                                    <TableCell className="border-r bg-emerald-50 px-2 text-right font-mono font-bold text-emerald-900">
                                        {data.ckPrice != null
                                            ? Number(data.ckPrice).toLocaleString("id-ID", { minimumFractionDigits: 2 })
                                            : data.giItem?.price
                                                ? Number(data.giItem.price).toLocaleString("id-ID", { minimumFractionDigits: 2 })
                                                : "-"}
                                    </TableCell>
                                    <TableCell className="border-r px-2 font-mono text-blue-600">
                                        {data.matchedGi?.documentNo || "-"}
                                    </TableCell>
                                    <TableCell className="px-2 text-center">
                                        {data.matchStatus === "MATCHED" ? (
                                            <Badge className="bg-emerald-500 text-white border-transparent">Matched</Badge>
                                        ) : data.matchStatus === "UNMATCHED" ? (
                                            <div className="space-y-1">
                                                <Badge variant="destructive">Unmatched</Badge>
                                                <p className="max-w-[180px] whitespace-normal text-[9px] text-rose-600">
                                                    {data.issues.join("; ")}
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="space-y-1">
                                                <Badge variant="outline" className="border-slate-200 text-slate-500">Pending</Badge>
                                                <p className="max-w-[180px] whitespace-normal text-[9px] text-amber-600">
                                                    {data.issues.join("; ")}
                                                </p>
                                            </div>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="space-y-3 rounded-md border bg-card p-4 shadow-sm">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-1">
                        <h4 className="text-sm font-bold text-slate-900">Exception Queue GI</h4>
                        <p className="text-xs text-muted-foreground">
                            Daftar unmatched, mismatch, dan GI orphan yang perlu tindak lanjut sebelum proses MRKO.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Filter aktif:</span>
                        <Badge variant="outline" className={cn("capitalize", getExceptionBadgeClass(exceptionFilter === "ALL" ? "ORPHAN_GI" : exceptionFilter))}>
                            {exceptionFilter === "ALL" ? "Semua Exception" : exceptionFilter.replace("_", " ").toLowerCase()}
                        </Badge>
                    </div>
                </div>

                <div className="rounded-md border overflow-auto">
                    <Table className="min-w-[1200px]">
                        <TableHeader className="bg-slate-50">
                            <TableRow>
                                <TableHead className="w-[120px]">Kategori</TableHead>
                                <TableHead className="w-[90px]">Source</TableHead>
                                <TableHead className="w-[180px]">Site</TableHead>
                                <TableHead className="w-[160px]">Reference</TableHead>
                                <TableHead className="w-[160px]">Material</TableHead>
                                <TableHead className="w-[100px]">WO</TableHead>
                                <TableHead className="w-[120px]">GI No</TableHead>
                                <TableHead>Issue Detail</TableHead>
                                <TableHead className="min-w-[220px]">Recommended Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="h-24 text-center text-sm text-muted-foreground">
                                        Memuat exception queue...
                                    </TableCell>
                                </TableRow>
                            ) : filteredExceptionQueue.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="h-24 text-center text-sm text-muted-foreground">
                                        Tidak ada exception GI untuk filter saat ini.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredExceptionQueue.map((row) => (
                                    <TableRow key={row.id} className="text-xs align-top">
                                        <TableCell>
                                            <Badge variant="outline" className={getExceptionBadgeClass(row.category)}>
                                                {row.category === "PENDING_GI"
                                                    ? "GI Pending"
                                                    : row.category === "MISMATCH"
                                                        ? "Mismatch"
                                                        : "GI Orphan"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={row.severity === "high" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-slate-200 bg-slate-50 text-slate-700"}>
                                                {row.source}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{row.site}</TableCell>
                                        <TableCell className="font-mono text-[11px]">{row.reference}</TableCell>
                                        <TableCell className="font-mono text-[11px]">{row.material}</TableCell>
                                        <TableCell className="font-mono text-[11px]">{row.woNo}</TableCell>
                                        <TableCell className="font-mono text-[11px] text-blue-700">{row.giNo}</TableCell>
                                        <TableCell>
                                            <p className="font-semibold text-slate-800">{row.issue}</p>
                                            <p className="text-muted-foreground">{row.detail}</p>
                                        </TableCell>
                                        <TableCell className="text-slate-600">{row.action}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    )
}
