"use client"

import { useRef, useState } from "react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
    Plus,
    Trash2,
    Upload,
    Search,
    FileDown,
    Loader2,
    FileSpreadsheet,
    CheckCircle2,
    AlertCircle,
    X,
    ArrowRight,
    Download,
    Check,
} from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
    getEvhsMasterPrices,
    createOrUpdateMasterPrice,
    deleteMasterPrice,
    bulkDeleteMasterPrices,
    bulkImportMasterPrices,
    type BulkImportMasterPriceResult,
} from "@/app/actions/evhs-master"
import { toast } from "sonner"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import Papa from "papaparse"
import * as XLSX from "xlsx"
import {
    parseCleanPrice,
    formatPriceToDbString,
    matchWarehouse,
    type WarehouseOption,
} from "@/lib/evhs-price-parser"

type ImportStep = "idle" | "upload" | "mapping" | "preview" | "processing" | "result"
type MasterPriceRow = Awaited<ReturnType<typeof getEvhsMasterPrices>>[number]

interface MappingState {
    sloc: string
    warehouseName: string
    materialNumberCp: string
    materialNumberCk: string
    price: string
}

function autoDetectField(
    headers: string[],
    type: "sloc" | "warehouseName" | "cp" | "ck" | "price"
): string {
    const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "")
    for (const h of headers) {
        const c = clean(h)
        if (type === "sloc" && (/sloc|siteid|kodesloc|plant/i.test(c) || c === "sloc")) return h
        if (
            type === "warehouseName" &&
            /warehouse|warehousename|namagudang|gudang|namasite|site/i.test(c) &&
            !/sloc/i.test(c)
        )
            return h
        if (
            type === "cp" &&
            (/materialcp|materialnumbercp|materialcf|partcp|kodecp|matcp/i.test(c) ||
                (c.includes("cp") && c.includes("mat")))
        )
            return h
        if (
            type === "ck" &&
            (/materialck|materialnumberck|partck|kodeck|mmck|matck/i.test(c) ||
                (c.includes("ck") && c.includes("mat")))
        )
            return h
        if (type === "price" && /price|harga|unitprice|hargasatuan|nominal|rate|tarif/i.test(c))
            return h
    }

    // Fallback pass
    for (const h of headers) {
        const c = clean(h)
        if (
            type === "cp" &&
            !/ck/i.test(c) &&
            /material|partnumber|itemcode|kodepart|partno/i.test(c)
        )
            return h
    }
    return ""
}

export function EvhsMasterPriceTable({ warehouses = [] }: { warehouses?: WarehouseOption[] }) {
    const queryClient = useQueryClient()
    const fileInputRef = useRef<HTMLInputElement>(null)

    // UI State
    const [searchQuery, setSearchQuery] = useState("")
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isImportOpen, setIsImportOpen] = useState(false)
    const [importStep, setImportStep] = useState<ImportStep>("upload")
    const [selectedIds, setSelectedIds] = useState<number[]>([])

    // Manual Add/Edit Form State
    const [formData, setFormData] = useState({
        materialNumberCp: "",
        materialNumberCk: "",
        warehouseId: "",
        price: "",
    })

    // Import State
    const [uploadedFile, setUploadedFile] = useState<File | null>(null)
    const [csvHeaders, setCsvHeaders] = useState<string[]>([])
    const [rawRows, setRawRows] = useState<Record<string, string>[]>([])
    const [mapping, setMapping] = useState<MappingState>({
        sloc: "",
        warehouseName: "",
        materialNumberCp: "",
        materialNumberCk: "",
        price: "",
    })
    const [importProgress, setImportProgress] = useState(0)
    const [importResults, setImportResults] = useState<BulkImportMasterPriceResult>({
        success: true,
        total: 0,
        successCount: 0,
        failedCount: 0,
        errors: [],
    })

    const { data: prices = [], isLoading } = useQuery<MasterPriceRow[]>({
        queryKey: ["evhs-master-prices"],
        queryFn: () => getEvhsMasterPrices(),
    })

    const mutation = useMutation({
        mutationFn: createOrUpdateMasterPrice,
        onSuccess: (result) => {
            if (result.success) {
                toast.success("Data harga berhasil disimpan")
                setIsDialogOpen(false)
                queryClient.invalidateQueries({ queryKey: ["evhs-master-prices"] })
                setFormData({ materialNumberCp: "", materialNumberCk: "", warehouseId: "", price: "" })
            } else {
                toast.error(result.error || "Gagal menyimpan data")
            }
        },
    })

    const deleteMutation = useMutation({
        mutationFn: deleteMasterPrice,
        onSuccess: () => {
            toast.success("Data berhasil dihapus")
            queryClient.invalidateQueries({ queryKey: ["evhs-master-prices"] })
        },
    })

    const bulkDeleteMutation = useMutation({
        mutationFn: bulkDeleteMasterPrices,
        onSuccess: (result) => {
            if (result.success) {
                toast.success(`${selectedIds.length} data berhasil dihapus`)
                setSelectedIds([])
                queryClient.invalidateQueries({ queryKey: ["evhs-master-prices"] })
            } else {
                toast.error(result.error || "Gagal menghapus data massal")
            }
        },
    })

    const filteredPrices = prices.filter(
        (p) =>
            p.materialNumberCp?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.materialNumberCk?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.productDescription?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.warehouse?.sloc?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.warehouse?.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.materialNumberCp || !formData.warehouseId || !formData.price) {
            return toast.error("Mohon isi semua field yang wajib")
        }
        mutation.mutate({
            ...formData,
            warehouseId: parseInt(formData.warehouseId, 10),
        })
    }

    // Template Download (CSV & Excel)
    const downloadTemplateCsv = () => {
        const headers = ["sloc", "warehouse_name", "material_cp", "material_ck", "price"]
        const sampleRows = [
            ["14", "CK KIM", "499A100027", "900120083", "540000"],
            ["107", "CK BIB", "460A170038", "900125802", "590000"],
            ["6", "CK Lahat", "1991206203", "900121928", "4800000"],
            ["116", "CK MHU", "1991206203", "900121928", "4800000"],
            ["123", "CK BMB", "1991206203", "900121928", "4800000"],
        ]

        const csvContent =
            "data:text/csv;charset=utf-8,\uFEFF" +
            [headers.join(","), ...sampleRows.map((r) => r.join(","))].join("\n")

        const encodedUri = encodeURI(csvContent)
        const link = document.createElement("a")
        link.setAttribute("href", encodedUri)
        link.setAttribute("download", "template_master_price_ck.csv")
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const downloadTemplateXlsx = () => {
        const headers = ["sloc", "warehouse_name", "material_cp", "material_ck", "price"]
        const sampleRows = [
            ["14", "CK KIM", "499A100027", "900120083", 540000],
            ["107", "CK BIB", "460A170038", "900125802", 590000],
            ["6", "CK Lahat", "1991206203", "900121928", 4800000],
            ["116", "CK MHU", "1991206203", "900121928", 4800000],
            ["123", "CK BMB", "1991206203", "900121928", 4800000],
        ]

        // Sheet 1: Template
        const wsTemplate = XLSX.utils.aoa_to_sheet([headers, ...sampleRows])
        // Sheet 2: Daftar Sloc Gudang CK yang valid sebagai panduan
        const siteRows = warehouses.map((w) => [w.sloc || "-", w.description || "-"])
        const wsSites = XLSX.utils.aoa_to_sheet([["SLOC", "NAMA GUDANG / SITE"], ...siteRows])

        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, wsTemplate, "Template Price CK")
        XLSX.utils.book_append_sheet(wb, wsSites, "Daftar Sloc Gudang")
        XLSX.writeFile(wb, "template_master_price_ck.xlsx")
    }

    // Export Data CSV
    const exportDataCsv = () => {
        if (prices.length === 0) {
            return toast.error("Tidak ada data untuk diekspor")
        }

        const headers = [
            "sloc",
            "warehouse_name",
            "material_cp",
            "material_ck",
            "product_description",
            "price",
        ]
        const rows = prices.map((p) => [
            `"${p.warehouse?.sloc || ""}"`,
            `"${p.warehouse?.description || ""}"`,
            `"${p.materialNumberCp || ""}"`,
            `"${p.materialNumberCk || ""}"`,
            `"${(p.productDescription || "").replace(/"/g, '""')}"`,
            Number(p.price || 0).toFixed(2),
        ])

        const csvContent =
            "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")

        const encodedUri = encodeURI(csvContent)
        const link = document.createElement("a")
        link.setAttribute("href", encodedUri)
        link.setAttribute(
            "download",
            `export_master_price_ck_${new Date().toISOString().slice(0, 10)}.csv`
        )
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    // Parsing File Upload (CSV atau Excel)
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploadedFile(file)
        const isExcel =
            file.name.endsWith(".xlsx") ||
            file.name.endsWith(".xls") ||
            file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
            file.type === "application/vnd.ms-excel"

        try {
            if (isExcel) {
                const arrayBuffer = await file.arrayBuffer()
                const data = new Uint8Array(arrayBuffer)
                const workbook = XLSX.read(data, { type: "array" })
                const firstSheetName = workbook.SheetNames[0]
                const worksheet = workbook.Sheets[firstSheetName]

                const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
                    defval: "",
                })
                if (jsonData.length === 0) {
                    toast.error("File Excel kosong atau tidak memiliki data")
                    return
                }

                // Ambil header
                const firstRow = jsonData[0]
                const headers = Object.keys(firstRow).map((h) => h.trim())
                const stringRows = jsonData.map((row) => {
                    const record: Record<string, string> = {}
                    for (const key of Object.keys(row)) {
                        record[key.trim()] = String(row[key] ?? "").trim()
                    }
                    return record
                })

                setupMappingAndRows(headers, stringRows)
            } else {
                // Parsing CSV dengan PapaParse
                Papa.parse<Record<string, string>>(file, {
                    header: true,
                    skipEmptyLines: true,
                    transformHeader: (header) => header.trim(),
                    complete: (results) => {
                        const headers = (results.meta.fields || []).map((h) => h.trim())
                        if (headers.length === 0 || results.data.length === 0) {
                            toast.error("File CSV kosong atau format header tidak valid")
                            return
                        }
                        const cleanedData = results.data.map((row) => {
                            const record: Record<string, string> = {}
                            for (const key of Object.keys(row)) {
                                record[key.trim()] = String(row[key] ?? "").trim()
                            }
                            return record
                        })
                        setupMappingAndRows(headers, cleanedData)
                    },
                    error: (error) => {
                        toast.error(`Gagal membaca file CSV: ${error.message}`)
                    },
                })
            }
        } catch (err) {
            toast.error(
                `Terjadi kesalahan saat membaca file: ${err instanceof Error ? err.message : "Error"}`
            )
        }
    }

    const setupMappingAndRows = (headers: string[], rows: Record<string, string>[]) => {
        setCsvHeaders(headers)
        setRawRows(rows)

        // Auto mapping cerdas
        const newMapping: MappingState = {
            sloc: autoDetectField(headers, "sloc"),
            warehouseName: autoDetectField(headers, "warehouseName"),
            materialNumberCp: autoDetectField(headers, "cp"),
            materialNumberCk: autoDetectField(headers, "ck"),
            price: autoDetectField(headers, "price"),
        }

        setMapping(newMapping)
        setImportStep("mapping")
        setIsImportOpen(true)
    }

    // Menyiapkan baris preview
    const previewItems = rawRows.slice(0, 5).map((row, idx) => {
        const slocVal = mapping.sloc ? row[mapping.sloc] : ""
        const nameVal = mapping.warehouseName ? row[mapping.warehouseName] : ""
        const cpVal = mapping.materialNumberCp ? row[mapping.materialNumberCp] : ""
        const ckVal = mapping.materialNumberCk ? row[mapping.materialNumberCk] : ""
        const priceVal = mapping.price ? row[mapping.price] : ""

        const matchedWh = matchWarehouse(warehouses, slocVal, nameVal)
        const parsedPrice = parseCleanPrice(priceVal)

        return {
            rowNumber: idx + 2,
            sloc: slocVal,
            warehouseName: nameVal,
            matchedWarehouse: matchedWh,
            materialCp: cpVal,
            materialCk: ckVal,
            rawPrice: priceVal,
            parsedPrice: parsedPrice,
            isValid: Boolean(matchedWh && cpVal && parsedPrice !== null && parsedPrice >= 0),
        }
    })

    // Eksekusi Import
    const startImport = async () => {
        if (!mapping.materialNumberCp || !mapping.price || (!mapping.sloc && !mapping.warehouseName)) {
            return toast.error("Mohon petakan minimal Sloc/Warehouse, Material CP, dan Harga")
        }

        setImportStep("processing")
        setImportProgress(20)

        const payloadItems = rawRows.map((row) => ({
            sloc: mapping.sloc ? row[mapping.sloc]?.trim() : "",
            warehouseName: mapping.warehouseName ? row[mapping.warehouseName]?.trim() : "",
            materialNumberCp: mapping.materialNumberCp ? row[mapping.materialNumberCp]?.trim() : "",
            materialNumberCk: mapping.materialNumberCk ? row[mapping.materialNumberCk]?.trim() : "",
            price: mapping.price ? row[mapping.price]?.trim() : "",
        }))

        setImportProgress(50)

        try {
            const result = await bulkImportMasterPrices(payloadItems)
            setImportProgress(100)
            setImportResults(result)
            setImportStep("result")

            if (result.successCount > 0) {
                toast.success(`Berhasil mengimpor ${result.successCount} data master price`)
                queryClient.invalidateQueries({ queryKey: ["evhs-master-prices"] })
            }
            if (result.failedCount > 0) {
                toast.error(`${result.failedCount} baris data gagal diimpor. Cek detail error.`)
            }
        } catch (err) {
            setImportStep("result")
            const errorMsg = err instanceof Error ? err.message : "Terjadi kesalahan pada server"
            setImportResults({
                success: false,
                total: payloadItems.length,
                successCount: 0,
                failedCount: payloadItems.length,
                errors: [{ line: 1, error: errorMsg, data: {} }],
            })
            toast.error(`Gagal import: ${errorMsg}`)
        }
    }

    const resetImportState = () => {
        setUploadedFile(null)
        setCsvHeaders([])
        setRawRows([])
        setMapping({
            sloc: "",
            warehouseName: "",
            materialNumberCp: "",
            materialNumberCk: "",
            price: "",
        })
        setImportStep("upload")
        setImportProgress(0)
    }

    return (
        <div className="space-y-4">
            {/* Header Box */}
            <div className="flex flex-col gap-4 rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-cyan-50/80 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <h4 className="flex items-center gap-2 text-sm font-bold text-blue-950">
                        <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                        Master Data Price PT. CK
                    </h4>
                    <p className="text-xs text-blue-700/90">
                        Kelola harga material khusus untuk PT. Cipta Kridatama per Sloc dan Warehouse.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {/* Tombol Template */}
                    <div className="flex rounded-md shadow-sm">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 border-blue-200 bg-white text-xs font-semibold text-blue-700 hover:bg-blue-50"
                            onClick={downloadTemplateCsv}
                        >
                            <FileDown className="mr-1.5 h-3.5 w-3.5 text-blue-600" /> Template CSV
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="-ml-px h-8 border-blue-200 bg-white px-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                            title="Download Template Excel (.xlsx)"
                            onClick={downloadTemplateXlsx}
                        >
                            .XLSX
                        </Button>
                    </div>

                    {/* Tombol Export */}
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        onClick={exportDataCsv}
                    >
                        <Download className="mr-1.5 h-3.5 w-3.5 text-slate-600" /> Export CSV
                    </Button>

                    {/* Tombol Import */}
                    <div className="relative">
                        <input
                            type="file"
                            accept=".csv, .xlsx, .xls"
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            onClick={(e) => {
                                ;(e.target as HTMLInputElement).value = ""
                            }}
                        />
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 border-blue-300 bg-blue-50 text-xs font-semibold text-blue-800 hover:bg-blue-100"
                            onClick={() => {
                                resetImportState()
                                setIsImportOpen(true)
                            }}
                        >
                            <Upload className="mr-1.5 h-3.5 w-3.5 text-blue-600" /> Import Data Price
                        </Button>
                    </div>

                    {/* Tombol Tambah Harga */}
                    <Button
                        size="sm"
                        className="h-8 bg-blue-600 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
                        onClick={() => setIsDialogOpen(true)}
                    >
                        <Plus className="mr-1.5 h-3.5 w-3.5" /> Tambah Harga
                    </Button>
                </div>
            </div>

            {/* Filter Search & Bulk Action */}
            <div className="flex items-center justify-between gap-2">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Cari Material, Sloc, atau Warehouse..."
                        className="h-9 pl-8 text-xs sm:text-sm"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                {selectedIds.length > 0 && (
                    <Button
                        variant="destructive"
                        size="sm"
                        className="h-9 bg-red-600 hover:bg-red-700 text-xs font-semibold shadow-sm"
                        onClick={() => {
                            if (confirm(`Hapus ${selectedIds.length} data master price yang terpilih?`)) {
                                bulkDeleteMutation.mutate(selectedIds)
                            }
                        }}
                        disabled={bulkDeleteMutation.isPending}
                    >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                        {bulkDeleteMutation.isPending ? "Menghapus..." : `Hapus (${selectedIds.length})`}
                    </Button>
                )}
            </div>

            {/* Tabel Data Master Price */}
            <div className="rounded-lg border bg-card overflow-x-auto shadow-sm">
                <Table className="min-w-[1100px]">
                    <TableHeader className="bg-slate-50 uppercase text-[10px] tracking-wider font-bold text-slate-700">
                        <TableRow>
                            <TableHead className="w-[40px] px-2 text-center border-r">
                                <Checkbox
                                    checked={
                                        filteredPrices.length > 0 &&
                                        selectedIds.length === filteredPrices.length
                                    }
                                    onCheckedChange={(checked) => {
                                        if (checked) {
                                            setSelectedIds(filteredPrices.map((p) => p.id))
                                        } else {
                                            setSelectedIds([])
                                        }
                                    }}
                                />
                            </TableHead>
                            <TableHead className="w-[100px] border-r">Sloc</TableHead>
                            <TableHead className="w-[160px] border-r">Warehouse Name</TableHead>
                            <TableHead className="w-[180px] border-r">Material CP</TableHead>
                            <TableHead className="w-[180px] border-r">Material CK</TableHead>
                            <TableHead className="border-r">Product Description</TableHead>
                            <TableHead className="w-[180px] text-right border-r">Price (IDR)</TableHead>
                            <TableHead className="w-[70px] text-center">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-600 mb-2" />
                                    Memuat data master price...
                                </TableCell>
                            </TableRow>
                        ) : filteredPrices.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={8}
                                    className="text-center py-12 text-muted-foreground italic text-sm"
                                >
                                    Belum ada data harga master price PT. CK.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredPrices.map((p) => (
                                <TableRow
                                    key={p.id}
                                    className={cn(
                                        "text-xs group hover:bg-blue-50/30 transition-colors",
                                        selectedIds.includes(p.id) && "bg-blue-50/50"
                                    )}
                                >
                                    <TableCell className="px-2 text-center border-r">
                                        <Checkbox
                                            checked={selectedIds.includes(p.id)}
                                            onCheckedChange={(checked) => {
                                                if (checked) {
                                                    setSelectedIds([...selectedIds, p.id])
                                                } else {
                                                    setSelectedIds(selectedIds.filter((id) => id !== p.id))
                                                }
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell className="border-r font-bold text-blue-700">
                                        {p.warehouse?.sloc || "-"}
                                    </TableCell>
                                    <TableCell
                                        className="border-r text-slate-700 font-medium truncate max-w-[150px]"
                                        title={p.warehouse?.description || "-"}
                                    >
                                        {p.warehouse?.description || "-"}
                                    </TableCell>
                                    <TableCell className="font-mono font-semibold text-slate-900 border-r">
                                        {p.materialNumberCp}
                                    </TableCell>
                                    <TableCell className="text-slate-600 font-mono border-r">
                                        {p.materialNumberCk || "-"}
                                    </TableCell>
                                    <TableCell
                                        className="border-r text-slate-700 max-w-[280px] truncate"
                                        title={p.productDescription || "-"}
                                    >
                                        {p.productDescription || "-"}
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-bold text-slate-900 border-r">
                                        {Number(p.price).toLocaleString("id-ID", {
                                            minimumFractionDigits: 2,
                                        })}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full"
                                            onClick={() => {
                                                if (confirm("Hapus data harga ini?"))
                                                    deleteMutation.mutate(p.id)
                                            }}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Dialog Manual Add/Edit */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[440px]">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold text-slate-900">
                            Tambah / Update Harga Master
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 mt-3">
                        <div className="grid gap-3.5">
                            <div className="space-y-1.5">
                                <Label htmlFor="warehouse" className="text-xs font-bold uppercase tracking-wide text-slate-700">
                                    Warehouse / Site (Sloc) <span className="text-red-500">*</span>
                                </Label>
                                <select
                                    id="warehouse"
                                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs sm:text-sm shadow-sm focus:ring-1 focus:ring-blue-500"
                                    value={formData.warehouseId}
                                    onChange={(e) =>
                                        setFormData({ ...formData, warehouseId: e.target.value })
                                    }
                                >
                                    <option value="">Pilih Warehouse / Site...</option>
                                    {warehouses.map((w) => (
                                        <option key={w.id} value={w.id}>
                                            {w.sloc ? `Sloc ${w.sloc} - ` : ""}
                                            {w.description || "Gudang"}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label htmlFor="matCp" className="text-xs font-bold uppercase tracking-wide text-slate-700">
                                        Material CP <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        id="matCp"
                                        placeholder="Contoh: 110149C112"
                                        className="h-9 text-xs sm:text-sm font-mono"
                                        value={formData.materialNumberCp}
                                        onChange={(e) =>
                                            setFormData({ ...formData, materialNumberCp: e.target.value })
                                        }
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="matCk" className="text-xs font-bold uppercase tracking-wide text-slate-700">
                                        Material CK
                                    </Label>
                                    <Input
                                        id="matCk"
                                        placeholder="Contoh: 900052960"
                                        className="h-9 text-xs sm:text-sm font-mono"
                                        value={formData.materialNumberCk}
                                        onChange={(e) =>
                                            setFormData({ ...formData, materialNumberCk: e.target.value })
                                        }
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="price" className="text-xs font-bold uppercase tracking-wide text-slate-700">
                                    Harga Satuan (IDR) <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="price"
                                    placeholder="Contoh: 540.000 atau 540000"
                                    className="h-9 text-xs sm:text-sm font-mono font-bold"
                                    value={formData.price}
                                    onChange={(e) =>
                                        setFormData({ ...formData, price: e.target.value })
                                    }
                                />
                                <p className="text-[11px] text-muted-foreground">
                                    Mendukung format angka langsung, format ribuan titik (540.000) atau koma.
                                </p>
                            </div>
                        </div>
                        <DialogFooter className="gap-2 sm:gap-0 mt-4">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setIsDialogOpen(false)}
                            >
                                Batal
                            </Button>
                            <Button
                                type="submit"
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                                disabled={mutation.isPending}
                            >
                                {mutation.isPending ? "Menyimpan..." : "Simpan Data Harga"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Dialog Advanced Import (CSV & Excel) */}
            <Dialog
                open={isImportOpen}
                onOpenChange={(open) => {
                    setIsImportOpen(open)
                    if (!open) resetImportState()
                }}
            >
                <DialogContent
                    className={cn(
                        "transition-all duration-300 max-h-[90vh] overflow-y-auto",
                        importStep === "preview" || importStep === "result"
                            ? "sm:max-w-3xl"
                            : "sm:max-w-lg"
                    )}
                >
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
                            <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                            Import Master Price PT. CK
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Unggah file CSV atau Excel (.xlsx) data master harga PT Cipta Kridatama.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Stepper Wizard Indicator */}
                    <div className="flex items-center justify-between border-b pb-3 text-xs font-semibold text-slate-600">
                        <div
                            className={cn(
                                "flex items-center gap-1.5",
                                importStep === "upload" && "text-blue-600 font-bold"
                            )}
                        >
                            <span
                                className={cn(
                                    "flex h-5 w-5 items-center justify-center rounded-full text-[10px]",
                                    importStep === "upload"
                                        ? "bg-blue-600 text-white"
                                        : "bg-slate-200 text-slate-700"
                                )}
                            >
                                1
                            </span>
                            Upload File
                        </div>
                        <ArrowRight className="h-3 w-3 text-slate-300" />
                        <div
                            className={cn(
                                "flex items-center gap-1.5",
                                importStep === "mapping" && "text-blue-600 font-bold"
                            )}
                        >
                            <span
                                className={cn(
                                    "flex h-5 w-5 items-center justify-center rounded-full text-[10px]",
                                    importStep === "mapping"
                                        ? "bg-blue-600 text-white"
                                        : "bg-slate-200 text-slate-700"
                                )}
                            >
                                2
                            </span>
                            Pemetaan Kolom
                        </div>
                        <ArrowRight className="h-3 w-3 text-slate-300" />
                        <div
                            className={cn(
                                "flex items-center gap-1.5",
                                importStep === "preview" && "text-blue-600 font-bold"
                            )}
                        >
                            <span
                                className={cn(
                                    "flex h-5 w-5 items-center justify-center rounded-full text-[10px]",
                                    importStep === "preview"
                                        ? "bg-blue-600 text-white"
                                        : "bg-slate-200 text-slate-700"
                                )}
                            >
                                3
                            </span>
                            Pratinjau Data
                        </div>
                    </div>

                    {/* STEP 1: UPLOAD */}
                    {importStep === "upload" && (
                        <div className="space-y-4 py-3">
                            <div className="flex items-center justify-between">
                                <p className="text-xs text-slate-500">Pilih berkas dari komputer Anda:</p>
                                <div className="flex gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                        onClick={downloadTemplateCsv}
                                    >
                                        <Download className="mr-1 h-3 w-3" /> Template CSV
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                        onClick={downloadTemplateXlsx}
                                    >
                                        <Download className="mr-1 h-3 w-3" /> Template Excel
                                    </Button>
                                </div>
                            </div>

                            <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-blue-500 hover:bg-blue-50/30 transition-all">
                                <div className="flex flex-col items-center justify-center text-center px-4">
                                    <Upload className="h-8 w-8 text-blue-500 mb-2" />
                                    <p className="text-xs font-semibold text-slate-800">
                                        Klik untuk memilih file CSV atau Excel (.xlsx, .xls)
                                    </p>
                                    <p className="text-[11px] text-slate-400 mt-1">
                                        Mendukung pemisah koma, titik koma (;), dan format angka Indonesia
                                    </p>
                                </div>
                                <input
                                    type="file"
                                    accept=".csv, .xlsx, .xls"
                                    className="hidden"
                                    onChange={handleFileSelect}
                                    onClick={(e) => {
                                        ;(e.target as HTMLInputElement).value = ""
                                    }}
                                />
                            </label>
                        </div>
                    )}

                    {/* STEP 2: MAPPING */}
                    {importStep === "mapping" && (
                        <div className="space-y-4 py-2">
                            <div className="rounded-lg bg-blue-50/70 p-3 border border-blue-100 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                                    <span className="text-xs font-bold text-blue-900 truncate max-w-[280px]">
                                        {uploadedFile?.name}
                                    </span>
                                </div>
                                <span className="text-[11px] bg-blue-200/60 text-blue-800 px-2 py-0.5 rounded-full font-semibold">
                                    {rawRows.length} baris data
                                </span>
                            </div>

                            <p className="text-xs text-slate-600">
                                Sesuaikan kolom berkas Anda dengan field database di bawah ini:
                            </p>

                            <div className="grid gap-3 border rounded-lg p-3.5 bg-slate-50/50">
                                {/* SLOC */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-2">
                                    <Label className="text-xs font-bold text-slate-700">
                                        Sloc / Site ID <span className="text-red-500">*</span>
                                    </Label>
                                    <select
                                        className="h-8 rounded-md border border-input bg-background px-2.5 text-xs shadow-sm"
                                        value={mapping.sloc}
                                        onChange={(e) => setMapping({ ...mapping, sloc: e.target.value })}
                                    >
                                        <option value="">Pilih Kolom Sloc...</option>
                                        {csvHeaders.map((h) => (
                                            <option key={h} value={h}>
                                                {h}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Warehouse Name */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-2">
                                    <Label className="text-xs font-medium text-slate-600">
                                        Warehouse Name <span className="text-slate-400 font-normal">(Opsional)</span>
                                    </Label>
                                    <select
                                        className="h-8 rounded-md border border-input bg-background px-2.5 text-xs shadow-sm"
                                        value={mapping.warehouseName}
                                        onChange={(e) =>
                                            setMapping({ ...mapping, warehouseName: e.target.value })
                                        }
                                    >
                                        <option value="">(Tidak Ada / Sesuai Sloc)</option>
                                        {csvHeaders.map((h) => (
                                            <option key={h} value={h}>
                                                {h}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Material CP */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-2">
                                    <Label className="text-xs font-bold text-slate-700">
                                        Material CP / CF <span className="text-red-500">*</span>
                                    </Label>
                                    <select
                                        className="h-8 rounded-md border border-input bg-background px-2.5 text-xs shadow-sm"
                                        value={mapping.materialNumberCp}
                                        onChange={(e) =>
                                            setMapping({ ...mapping, materialNumberCp: e.target.value })
                                        }
                                    >
                                        <option value="">Pilih Kolom Material CP...</option>
                                        {csvHeaders.map((h) => (
                                            <option key={h} value={h}>
                                                {h}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Material CK */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-2">
                                    <Label className="text-xs font-medium text-slate-600">
                                        Material CK <span className="text-slate-400 font-normal">(Opsional)</span>
                                    </Label>
                                    <select
                                        className="h-8 rounded-md border border-input bg-background px-2.5 text-xs shadow-sm"
                                        value={mapping.materialNumberCk}
                                        onChange={(e) =>
                                            setMapping({ ...mapping, materialNumberCk: e.target.value })
                                        }
                                    >
                                        <option value="">(Tidak Ada)</option>
                                        {csvHeaders.map((h) => (
                                            <option key={h} value={h}>
                                                {h}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Price */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-2">
                                    <Label className="text-xs font-bold text-slate-700">
                                        Harga Satuan (Price) <span className="text-red-500">*</span>
                                    </Label>
                                    <select
                                        className="h-8 rounded-md border border-input bg-background px-2.5 text-xs shadow-sm"
                                        value={mapping.price}
                                        onChange={(e) => setMapping({ ...mapping, price: e.target.value })}
                                    >
                                        <option value="">Pilih Kolom Harga...</option>
                                        {csvHeaders.map((h) => (
                                            <option key={h} value={h}>
                                                {h}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <DialogFooter className="pt-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setImportStep("upload")}
                                >
                                    Kembali
                                </Button>
                                <Button
                                    size="sm"
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                                    onClick={() => {
                                        if (
                                            (!mapping.sloc && !mapping.warehouseName) ||
                                            !mapping.materialNumberCp ||
                                            !mapping.price
                                        ) {
                                            return toast.error(
                                                "Mohon lengkapi pemetaan kolom Sloc, Material CP, dan Harga"
                                            )
                                        }
                                        setImportStep("preview")
                                    }}
                                >
                                    Lanjut: Pratinjau Data <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                                </Button>
                            </DialogFooter>
                        </div>
                    )}

                    {/* STEP 3: PREVIEW */}
                    {importStep === "preview" && (
                        <div className="space-y-4 py-2">
                            <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border">
                                <span>
                                    Menampilkan <strong>{previewItems.length}</strong> contoh baris pertama dari total{" "}
                                    <strong>{rawRows.length}</strong> baris.
                                </span>
                                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                                    <Check className="h-3.5 w-3.5" /> Kolom Terpetakan
                                </span>
                            </div>

                            <div className="rounded-lg border overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-slate-100 text-[10px] uppercase font-bold text-slate-700">
                                        <TableRow>
                                            <TableHead className="w-[80px]">Sloc</TableHead>
                                            <TableHead className="w-[140px]">Gudang Terdeteksi</TableHead>
                                            <TableHead className="w-[120px]">Material CP</TableHead>
                                            <TableHead className="w-[110px]">Material CK</TableHead>
                                            <TableHead className="w-[120px]">Input Harga</TableHead>
                                            <TableHead className="text-right">Harga Hasil Normalisasi</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody className="text-xs">
                                        {previewItems.map((p, idx) => (
                                            <TableRow
                                                key={idx}
                                                className={cn(!p.isValid && "bg-red-50/50 hover:bg-red-50/70")}
                                            >
                                                <TableCell className="font-bold text-blue-700">
                                                    {p.sloc || p.warehouseName || "-"}
                                                </TableCell>
                                                <TableCell>
                                                    {p.matchedWarehouse ? (
                                                        <span className="text-emerald-700 font-medium">
                                                            {p.matchedWarehouse.description || `Sloc ${p.matchedWarehouse.sloc}`}
                                                        </span>
                                                    ) : (
                                                        <span className="text-red-500 font-semibold flex items-center gap-1">
                                                            <AlertCircle className="h-3 w-3" /> Tidak Ditemukan
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="font-mono font-semibold">
                                                    {p.materialCp || (
                                                        <span className="text-red-500 italic">Kosong</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="font-mono text-slate-600">
                                                    {p.materialCk || "-"}
                                                </TableCell>
                                                <TableCell className="font-mono text-slate-500">
                                                    {p.rawPrice || "-"}
                                                </TableCell>
                                                <TableCell className="text-right font-mono font-bold text-slate-900">
                                                    {p.parsedPrice !== null ? (
                                                        `Rp ${p.parsedPrice.toLocaleString("id-ID", {
                                                            minimumFractionDigits: 2,
                                                        })}`
                                                    ) : (
                                                        <span className="text-red-500 font-sans text-[11px] font-semibold">
                                                            Format Salah
                                                        </span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            <DialogFooter className="pt-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setImportStep("mapping")}
                                >
                                    Kembali ke Mapping
                                </Button>
                                <Button
                                    size="sm"
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                                    onClick={startImport}
                                >
                                    Mulai Import Sekarang ({rawRows.length} Baris)
                                </Button>
                            </DialogFooter>
                        </div>
                    )}

                    {/* STEP 4: PROCESSING */}
                    {importStep === "processing" && (
                        <div className="space-y-6 py-12 text-center">
                            <Loader2 className="h-10 w-10 text-blue-600 animate-spin mx-auto" />
                            <div className="space-y-2">
                                <p className="text-sm font-bold text-slate-800">
                                    Memproses import data master harga...
                                </p>
                                <p className="text-xs text-slate-500">
                                    Menyinkronkan data dengan database PT. CK
                                </p>
                                <Progress value={importProgress} className="h-2 max-w-xs mx-auto" />
                            </div>
                        </div>
                    )}

                    {/* STEP 5: RESULT */}
                    {importStep === "result" && (
                        <div className="space-y-4 py-2">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 text-center">
                                    <div className="flex items-center justify-center gap-1.5 text-emerald-700 mb-1">
                                        <CheckCircle2 className="h-4 w-4" />
                                        <span className="text-xs uppercase font-bold tracking-wider">
                                            Berhasil
                                        </span>
                                    </div>
                                    <p className="text-3xl font-extrabold text-emerald-800 font-mono">
                                        {importResults.successCount}
                                    </p>
                                </div>
                                <div className="bg-rose-50 p-4 rounded-xl border border-rose-200 text-center">
                                    <div className="flex items-center justify-center gap-1.5 text-rose-700 mb-1">
                                        <AlertCircle className="h-4 w-4" />
                                        <span className="text-xs uppercase font-bold tracking-wider">
                                            Gagal
                                        </span>
                                    </div>
                                    <p className="text-3xl font-extrabold text-rose-800 font-mono">
                                        {importResults.failedCount}
                                    </p>
                                </div>
                            </div>

                            {importResults.errors.length > 0 && (
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-rose-800 flex items-center gap-1">
                                        <AlertCircle className="h-3.5 w-3.5" /> Detail Baris Bermasalah (
                                        {importResults.errors.length})
                                    </Label>
                                    <div className="space-y-1.5 max-h-[180px] overflow-auto border border-rose-100 rounded-lg p-3 bg-rose-50/40 text-xs">
                                        {importResults.errors.map((err, idx) => (
                                            <div
                                                key={idx}
                                                className="flex items-start gap-2 text-rose-900 border-b border-rose-100/60 pb-1.5 last:border-0 last:pb-0"
                                            >
                                                <span className="font-bold shrink-0 text-rose-700 font-mono">
                                                    Baris {err.line}:
                                                </span>
                                                <span className="text-slate-800">{err.error}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <Button
                                size="sm"
                                className="w-full bg-slate-800 hover:bg-slate-900 text-white font-semibold"
                                onClick={() => {
                                    setIsImportOpen(false)
                                    resetImportState()
                                }}
                            >
                                Selesai & Tutup
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
