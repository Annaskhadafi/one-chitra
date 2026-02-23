"use client"

import { useRef, useState } from "react"
import Papa from "papaparse"
import { format } from "date-fns"
import { id as localeId } from "date-fns/locale"
import {
    CalendarHeart,
    Check,
    ChevronRight,
    Download,
    FileUp,
    Loader2,
    X,
    AlertCircle,
    CheckCircle2,
    HelpCircle,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

import {
    importCustomerBirthdays,
    getCustomerListForBirthday,
    type BirthdayImportRow,
} from "@/app/actions/calendar-events"

// ─── Types ───────────────────────────────────────────────────────────────────

type Step = "upload" | "map" | "preview"

type DateFormat =
    | "auto"
    | "YYYY-MM-DD"
    | "DD/MM/YYYY"
    | "MM/DD/YYYY"
    | "DD-MM-YYYY"
    | "MM-DD-YYYY"

type IdentifierType = "code" | "name"

interface PreviewRow {
    rawIdentifier: string
    rawBirthday: string
    parsedBirthday: string | null   // YYYY-MM-DD or null
    matchedCustomer: { id: number; name: string; customerCode: string } | null
    status: "matched" | "not_found" | "invalid_date"
}

// ─── Date Parsing ─────────────────────────────────────────────────────────────

const INDONESIAN_MONTHS: Record<string, number> = {
    januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6,
    juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12,
    jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, agu: 8, agt: 8,
    sep: 9, okt: 10, nov: 11, des: 12,
}

function parseDate(raw: string, fmt: DateFormat): string | null {
    const s = raw.trim().replace(/\s+/g, " ")
    if (!s) return null

    // Try by specified format first, then auto-detect
    const attempts: DateFormat[] =
        fmt === "auto"
            ? ["YYYY-MM-DD", "DD/MM/YYYY", "MM/DD/YYYY", "DD-MM-YYYY", "MM-DD-YYYY"]
            : [fmt]

    for (const attempt of attempts) {
        const result = tryParseFormat(s, attempt)
        if (result) return result
    }

    // Try "D MMMM YYYY" Indonesian style
    const idMatch = s.match(/^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/i)
    if (idMatch) {
        const day = parseInt(idMatch[1])
        const monthName = idMatch[2].toLowerCase()
        const year = parseInt(idMatch[3])
        const month = INDONESIAN_MONTHS[monthName]
        if (month && isValidDate(year, month, day)) {
            return toISO(year, month, day)
        }
    }

    return null
}

function tryParseFormat(s: string, fmt: DateFormat): string | null {
    let m: RegExpMatchArray | null

    switch (fmt) {
        case "YYYY-MM-DD":
            m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
            if (m) return buildISO(parseInt(m[1]), parseInt(m[2]), parseInt(m[3]))
            break
        case "DD/MM/YYYY":
            m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
            if (m) return buildISO(parseInt(m[3]), parseInt(m[2]), parseInt(m[1]))
            break
        case "MM/DD/YYYY":
            m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
            if (m) return buildISO(parseInt(m[3]), parseInt(m[1]), parseInt(m[2]))
            break
        case "DD-MM-YYYY":
            m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
            if (m) return buildISO(parseInt(m[3]), parseInt(m[2]), parseInt(m[1]))
            break
        case "MM-DD-YYYY":
            m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
            if (m) return buildISO(parseInt(m[3]), parseInt(m[1]), parseInt(m[2]))
            break
    }
    return null
}

function buildISO(year: number, month: number, day: number): string | null {
    if (!isValidDate(year, month, day)) return null
    return toISO(year, month, day)
}

function toISO(y: number, m: number, d: number) {
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
}

function isValidDate(y: number, m: number, d: number): boolean {
    if (y < 1900 || y > 2100) return false
    if (m < 1 || m > 12) return false
    const date = new Date(y, m - 1, d)
    return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
}

// ─── Template download ───────────────────────────────────────────────────────

function downloadTemplate() {
    const csv = [
        "customer_code,customer_name,birthday",
        "C001,Budi Santoso,15/08/1985",
        "C002,Siti Rahayu,03/03/1990",
    ].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "template_birthday_import.csv"
    a.click()
    URL.revokeObjectURL(url)
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepBadge({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
    return (
        <div className={`flex items-center gap-2 text-sm ${active ? "text-foreground font-medium" : done ? "text-muted-foreground" : "text-muted-foreground/50"}`}>
            <span className={`flex size-6 items-center justify-center rounded-full text-xs font-bold
                ${active ? "bg-primary text-primary-foreground" : done ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"}`}>
                {done ? <Check className="size-3" /> : n}
            </span>
            {label}
        </div>
    )
}

// ─── Main component ──────────────────────────────────────────────────────────

interface BirthdayCSVImportProps {
    onSuccess?: () => void
}

export function BirthdayCSVImport({ onSuccess }: BirthdayCSVImportProps) {
    const [open, setOpen] = useState(false)
    const [step, setStep] = useState<Step>("upload")
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Step 1
    const [fileName, setFileName] = useState("")
    const [csvHeaders, setCsvHeaders] = useState<string[]>([])
    const [csvRows, setCsvRows] = useState<Record<string, string>[]>([])

    // Step 2 – mapping
    const [identifierCol, setIdentifierCol] = useState("")
    const [identifierType, setIdentifierType] = useState<IdentifierType>("code")
    const [birthdayCol, setBirthdayCol] = useState("")
    const [dateFormat, setDateFormat] = useState<DateFormat>("auto")

    // Step 3 – preview
    const [preview, setPreview] = useState<PreviewRow[]>([])
    const [isProcessing, setIsProcessing] = useState(false)
    const [isImporting, setIsImporting] = useState(false)

    const reset = () => {
        setStep("upload")
        setFileName("")
        setCsvHeaders([])
        setCsvRows([])
        setIdentifierCol("")
        setBirthdayCol("")
        setDateFormat("auto")
        setIdentifierType("code")
        setPreview([])
        if (fileInputRef.current) fileInputRef.current.value = ""
    }

    // ── Step 1: parse CSV ──────────────────────────────────────────────────

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setFileName(file.name)

        Papa.parse<Record<string, string>>(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const headers = results.meta.fields ?? []
                const rows = results.data as Record<string, string>[]

                if (headers.length === 0 || rows.length === 0) {
                    toast.error("File CSV kosong atau tidak valid")
                    return
                }

                setCsvHeaders(headers)
                setCsvRows(rows)

                // Auto-guess columns
                const lower = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "")
                identifierColGuess(headers, lower)
                birthdayColGuess(headers, lower)

                setStep("map")
            },
            error: (err) => toast.error("Gagal membaca CSV: " + err.message),
        })
    }

    const identifierColGuess = (headers: string[], lower: (h: string) => string) => {
        const codeCol = headers.find((h) =>
            ["customercode", "kodepelanggan", "kode", "code", "custcode", "cust_code"].includes(lower(h))
        )
        const nameCol = headers.find((h) =>
            ["customername", "namapelanggan", "nama", "name", "custname"].includes(lower(h))
        )
        if (codeCol) { setIdentifierCol(codeCol); setIdentifierType("code") }
        else if (nameCol) { setIdentifierCol(nameCol); setIdentifierType("name") }
        else if (headers[0]) setIdentifierCol(headers[0])
    }

    const birthdayColGuess = (headers: string[], lower: (h: string) => string) => {
        const bdayCol = headers.find((h) =>
            ["birthday", "birthdate", "tanggallahir", "tgllahir", "dob", "dateofbirth", "lahir", "ulang_tahun"].includes(lower(h))
        )
        if (bdayCol) setBirthdayCol(bdayCol)
        else if (headers[1]) setBirthdayCol(headers[1])
    }

    // ── Step 2 → 3: generate preview with client-side matching ────────────

    const generatePreview = async () => {
        if (!identifierCol || !birthdayCol) {
            toast.error("Pilih kolom identifikasi dan kolom tanggal lahir")
            return
        }
        setIsProcessing(true)
        try {
            const customerList = await getCustomerListForBirthday()
            const byCode = new Map(customerList.map((c) => [c.customerCode.toLowerCase().trim(), c]))
            const byName = new Map(customerList.map((c) => [c.name.toLowerCase().trim(), c]))

            const rows: PreviewRow[] = csvRows.map((row) => {
                const rawId = (row[identifierCol] ?? "").trim()
                const rawBd = (row[birthdayCol] ?? "").trim()
                const parsed = parseDate(rawBd, dateFormat)
                const customer = identifierType === "code"
                    ? byCode.get(rawId.toLowerCase())
                    : byName.get(rawId.toLowerCase())

                let status: PreviewRow["status"] = "matched"
                if (!parsed) status = "invalid_date"
                else if (!customer) status = "not_found"

                return {
                    rawIdentifier: rawId,
                    rawBirthday: rawBd,
                    parsedBirthday: parsed,
                    matchedCustomer: customer
                        ? { id: customer.id, name: customer.name, customerCode: customer.customerCode }
                        : null,
                    status,
                }
            }).filter((r) => r.rawIdentifier || r.rawBirthday)

            if (rows.length === 0) {
                toast.error("Tidak ada data yang valid di CSV")
                return
            }

            setPreview(rows)
            setStep("preview")
        } finally {
            setIsProcessing(false)
        }
    }

    // ── Step 3: import ────────────────────────────────────────────────────

    const handleImport = async () => {
        const validRows = preview.filter((r) => r.status === "matched" && r.parsedBirthday)

        if (validRows.length === 0) {
            toast.error("Tidak ada baris yang siap diimport")
            return
        }

        setIsImporting(true)
        try {
            const importRows: BirthdayImportRow[] = validRows.map((r) => ({
                identifier: r.rawIdentifier,
                identifierType,
                birthday: r.parsedBirthday!,
            }))

            const result = await importCustomerBirthdays(importRows)

            if (result.updated > 0) {
                toast.success(`Berhasil update ${result.updated} ulang tahun customer`)
                if (result.notFound.length > 0) {
                    toast.warning(`${result.notFound.length} customer tidak ditemukan`)
                }
                onSuccess?.()
                setOpen(false)
                reset()
            } else {
                toast.error("Tidak ada data yang berhasil diimport")
            }
        } finally {
            setIsImporting(false)
        }
    }

    const matchedCount = preview.filter((r) => r.status === "matched").length
    const notFoundCount = preview.filter((r) => r.status === "not_found").length
    const invalidDateCount = preview.filter((r) => r.status === "invalid_date").length

    return (
        <>
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
                <CalendarHeart className="mr-2 size-4" />
                Import Birthday CSV
            </Button>

            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Import Ulang Tahun Customer</DialogTitle>
                        <DialogDescription>
                            Upload file CSV, petakan kolom, lalu preview sebelum menyimpan.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Step indicator */}
                    <div className="flex items-center gap-3 py-2">
                        <StepBadge n={1} label="Upload" active={step === "upload"} done={step !== "upload"} />
                        <ChevronRight className="size-3 text-muted-foreground" />
                        <StepBadge n={2} label="Mapping Kolom" active={step === "map"} done={step === "preview"} />
                        <ChevronRight className="size-3 text-muted-foreground" />
                        <StepBadge n={3} label="Preview & Import" active={step === "preview"} done={false} />
                    </div>

                    <Separator />

                    {/* ── STEP 1: Upload ─────────────────────────────────── */}
                    {step === "upload" && (
                        <div className="space-y-4 py-2">
                            <div
                                className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-12 text-center cursor-pointer hover:border-primary/40 transition-colors"
                                onClick={() => fileInputRef.current?.click()}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                    e.preventDefault()
                                    const file = e.dataTransfer.files?.[0]
                                    if (file && fileInputRef.current) {
                                        const dt = new DataTransfer()
                                        dt.items.add(file)
                                        fileInputRef.current.files = dt.files
                                        handleFileChange({ target: fileInputRef.current } as React.ChangeEvent<HTMLInputElement>)
                                    }
                                }}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".csv"
                                    className="hidden"
                                    onChange={handleFileChange}
                                />
                                <FileUp className="size-12 mx-auto text-muted-foreground mb-3" />
                                <p className="font-medium text-sm">Klik atau drag & drop file CSV</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Format: .csv (max. 10MB)
                                </p>
                            </div>

                            <div className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm bg-muted/30">
                                <HelpCircle className="size-4 text-muted-foreground flex-shrink-0" />
                                <span className="text-muted-foreground">
                                    CSV bisa memiliki kolom apapun — Anda akan memetakan kolom di langkah berikutnya.
                                </span>
                                <Button variant="ghost" size="sm" className="ml-auto flex-shrink-0 h-7 text-xs" onClick={downloadTemplate}>
                                    <Download className="mr-1 size-3" />
                                    Unduh template
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* ── STEP 2: Column Mapping ─────────────────────────── */}
                    {step === "map" && (
                        <div className="space-y-5 py-2">
                            <div className="flex items-center gap-2 rounded-lg bg-muted/40 p-3 text-sm">
                                <Check className="size-4 text-green-500 flex-shrink-0" />
                                <span className="font-medium">{fileName}</span>
                                <span className="text-muted-foreground">— {csvRows.length} baris, {csvHeaders.length} kolom</span>
                                <Button variant="ghost" size="sm" className="ml-auto h-7" onClick={reset}>
                                    <X className="size-3 mr-1" /> Ganti file
                                </Button>
                            </div>

                            {/* Identifier column */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>
                                        Kolom Identifikasi Customer
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <HelpCircle className="ml-1 inline size-3.5 text-muted-foreground" />
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    Kolom CSV yang berisi kode atau nama customer
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </Label>
                                    <Select value={identifierCol} onValueChange={setIdentifierCol}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Pilih kolom..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {csvHeaders.map((h) => (
                                                <SelectItem key={h} value={h}>{h}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Tipe Identifikasi</Label>
                                    <Select value={identifierType} onValueChange={(v) => setIdentifierType(v as IdentifierType)}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="code">Kode Customer (customerCode)</SelectItem>
                                            <SelectItem value="name">Nama Customer</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Birthday column */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Kolom Tanggal Lahir</Label>
                                    <Select value={birthdayCol} onValueChange={setBirthdayCol}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Pilih kolom..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {csvHeaders.map((h) => (
                                                <SelectItem key={h} value={h}>{h}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>
                                        Format Tanggal
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <HelpCircle className="ml-1 inline size-3.5 text-muted-foreground" />
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    Auto-detect mencoba semua format secara otomatis
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </Label>
                                    <Select value={dateFormat} onValueChange={(v) => setDateFormat(v as DateFormat)}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="auto">🔍 Auto-detect</SelectItem>
                                            <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (15/08/1985)</SelectItem>
                                            <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (08/15/1985)</SelectItem>
                                            <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (1985-08-15)</SelectItem>
                                            <SelectItem value="DD-MM-YYYY">DD-MM-YYYY (15-08-1985)</SelectItem>
                                            <SelectItem value="MM-DD-YYYY">MM-DD-YYYY (08-15-1985)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Sample preview */}
                            {identifierCol && birthdayCol && (
                                <div className="rounded-lg border overflow-hidden">
                                    <div className="bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
                                        Contoh 3 baris dari CSV
                                    </div>
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b bg-muted/20">
                                                <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">{identifierCol}</th>
                                                <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">{birthdayCol}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {csvRows.slice(0, 3).map((row, i) => (
                                                <tr key={i} className="border-b last:border-0">
                                                    <td className="px-3 py-1.5">{row[identifierCol] || "—"}</td>
                                                    <td className="px-3 py-1.5">{row[birthdayCol] || "—"}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            <DialogFooter>
                                <Button variant="outline" onClick={reset}>Kembali</Button>
                                <Button
                                    onClick={generatePreview}
                                    disabled={isProcessing || !identifierCol || !birthdayCol}
                                >
                                    {isProcessing ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                                    Proses Data &rarr;
                                </Button>
                            </DialogFooter>
                        </div>
                    )}

                    {/* ── STEP 3: Preview & Import ─────────────────────────── */}
                    {step === "preview" && (
                        <div className="space-y-4 py-2">
                            {/* Summary badges */}
                            <div className="flex flex-wrap gap-2">
                                <Badge variant="outline" className="gap-1.5 border-green-500 text-green-600">
                                    <CheckCircle2 className="size-3" />
                                    {matchedCount} siap import
                                </Badge>
                                {notFoundCount > 0 && (
                                    <Badge variant="outline" className="gap-1.5 border-amber-500 text-amber-600">
                                        <AlertCircle className="size-3" />
                                        {notFoundCount} customer tidak ditemukan
                                    </Badge>
                                )}
                                {invalidDateCount > 0 && (
                                    <Badge variant="outline" className="gap-1.5 border-red-500 text-red-600">
                                        <X className="size-3" />
                                        {invalidDateCount} format tanggal tidak valid
                                    </Badge>
                                )}
                            </div>

                            {/* Preview table */}
                            <div className="max-h-72 overflow-auto rounded-lg border text-xs">
                                <table className="w-full">
                                    <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                                        <tr>
                                            <th className="px-3 py-2 text-left font-medium">Identifikasi CSV</th>
                                            <th className="px-3 py-2 text-left font-medium">Customer DB</th>
                                            <th className="px-3 py-2 text-left font-medium">Tanggal Lahir</th>
                                            <th className="px-3 py-2 text-left font-medium">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {preview.map((row, i) => (
                                            <tr key={i} className={`border-t ${row.status === "matched" ? "" : "opacity-60"}`}>
                                                <td className="px-3 py-2 font-mono">{row.rawIdentifier}</td>
                                                <td className="px-3 py-2">
                                                    {row.matchedCustomer
                                                        ? <span>{row.matchedCustomer.name} <span className="text-muted-foreground">({row.matchedCustomer.customerCode})</span></span>
                                                        : <span className="text-muted-foreground">—</span>
                                                    }
                                                </td>
                                                <td className="px-3 py-2">
                                                    {row.parsedBirthday
                                                        ? <span className="text-green-600">
                                                            {format(new Date(row.parsedBirthday + "T00:00:00"), "dd MMM yyyy", { locale: localeId })}
                                                        </span>
                                                        : <span className="text-red-500 text-xs">{row.rawBirthday || "kosong"}</span>
                                                    }
                                                </td>
                                                <td className="px-3 py-2">
                                                    {row.status === "matched" && (
                                                        <Badge className="h-5 bg-green-100 text-green-700 hover:bg-green-100">
                                                            <CheckCircle2 className="mr-1 size-2.5" /> Sinkron
                                                        </Badge>
                                                    )}
                                                    {row.status === "not_found" && (
                                                        <Badge className="h-5 bg-amber-100 text-amber-700 hover:bg-amber-100">
                                                            <AlertCircle className="mr-1 size-2.5" /> Tdk ditemukan
                                                        </Badge>
                                                    )}
                                                    {row.status === "invalid_date" && (
                                                        <Badge className="h-5 bg-red-100 text-red-700 hover:bg-red-100">
                                                            <X className="mr-1 size-2.5" /> Tgl invalid
                                                        </Badge>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {matchedCount === 0 && (
                                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700">
                                    Tidak ada baris yang bisa diimport. Periksa kembali mapping kolom atau kode customer.
                                </div>
                            )}

                            <DialogFooter>
                                <Button variant="outline" onClick={() => setStep("map")}>
                                    ← Kembali ke Mapping
                                </Button>
                                <Button
                                    onClick={handleImport}
                                    disabled={isImporting || matchedCount === 0}
                                >
                                    {isImporting
                                        ? <><Loader2 className="mr-2 size-4 animate-spin" />Mengimport...</>
                                        : `Import ${matchedCount} Data`
                                    }
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    )
}
