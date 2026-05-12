"use client"

import * as React from "react"
import * as XLSX from "xlsx"
import { toast } from "sonner"
import { Edit2, FileUp, Filter, Loader2, Plus, Search, Trash2, Upload } from "lucide-react"

import {
    createTirePerformanceRecord,
    deleteTirePerformanceRecord,
    importTirePerformanceRecords,
    updateTirePerformanceRecord,
    type TirePerformanceActionInput,
} from "@/app/actions/tire-performance"
import {
    aggregateTirePerformanceRows,
    normalizeTirePerformanceImportRow,
    type TirePerformanceRow,
    type TirePerformanceType,
} from "@/lib/tire-performance"
import { Badge } from "@/components/ui/badge"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

type TirePerformanceDbRow = Awaited<ReturnType<typeof import("@/app/actions/tire-performance").getTirePerformanceRecords>>[number]

const tabConfig: Record<TirePerformanceType, { label: string; title: string; dateLabel: string }> = {
    running: {
        label: "Tire Running Performance",
        title: "CHITRA PARATAMA - ALL TIRE RUNNING PERFORMANCE",
        dateLabel: "Input Date",
    },
    scrap: {
        label: "Tire Scrap",
        title: "CHITRA PARATAMA - ALL TIRE SCRAP PERFORMANCE",
        dateLabel: "Date Removed",
    },
}

const emptyForm = (type: TirePerformanceType): TirePerformanceActionInput => ({
    type,
    performanceDate: "",
    endUser: "",
    mineSite: "",
    manufacture: "",
    specification: "",
    avgHours: "",
    recordCount: "",
    remarks: "",
})

const formatNumber = (value: number | string) => {
    const parsed = Number(value) || 0
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(parsed)
}

function rowToTypedRecord(row: TirePerformanceDbRow): TirePerformanceRow {
    return {
        id: row.id,
        type: row.type as TirePerformanceType,
        performanceDate: row.performanceDate,
        endUser: row.endUser,
        mineSite: row.mineSite,
        manufacture: row.manufacture,
        specification: row.specification,
        avgHours: String(row.avgHours),
        recordCount: row.recordCount,
        remarks: row.remarks,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    }
}

function uniqueOptions(rows: TirePerformanceRow[], key: keyof Pick<TirePerformanceRow, "performanceDate" | "endUser" | "mineSite" | "manufacture" | "specification">) {
    return Array.from(new Set(rows.map((row) => row[key]).filter(Boolean))).sort((left, right) => left.localeCompare(right))
}

function TirePerformanceDialog({
    type,
    row,
    onSaved,
    trigger,
}: {
    type: TirePerformanceType
    row?: TirePerformanceRow
    onSaved: (row: TirePerformanceDbRow, mode: "create" | "edit") => void
    trigger: React.ReactNode
}) {
    const [open, setOpen] = React.useState(false)
    const [loading, setLoading] = React.useState(false)
    const [form, setForm] = React.useState<TirePerformanceActionInput>(() => ({
        ...emptyForm(type),
        performanceDate: row?.performanceDate || "",
        endUser: row?.endUser || "",
        mineSite: row?.mineSite || "",
        manufacture: row?.manufacture || "",
        specification: row?.specification || "",
        avgHours: row?.avgHours || "",
        recordCount: row?.recordCount || "",
        remarks: row?.remarks || "",
    }))

    React.useEffect(() => {
        if (!open) return
        setForm({
            ...emptyForm(type),
            performanceDate: row?.performanceDate || "",
            endUser: row?.endUser || "",
            mineSite: row?.mineSite || "",
            manufacture: row?.manufacture || "",
            specification: row?.specification || "",
            avgHours: row?.avgHours || "",
            recordCount: row?.recordCount || "",
            remarks: row?.remarks || "",
        })
    }, [open, row, type])

    const updateField = (key: keyof TirePerformanceActionInput, value: string) => {
        setForm((current) => ({ ...current, [key]: value }))
    }

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setLoading(true)
        const payload = { ...form, type }
        const result = row
            ? await updateTirePerformanceRecord(row.id, payload)
            : await createTirePerformanceRecord(payload)
        setLoading(false)

        if (!result.success || !result.data) {
            toast.error(result.error)
            return
        }

        onSaved(result.data, row ? "edit" : "create")
        toast.success(row ? "Data tire performance diperbarui" : "Data tire performance ditambahkan")
        setOpen(false)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="sm:max-w-[760px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>{row ? "Edit" : "Tambah"} {tabConfig[type].label}</DialogTitle>
                        <DialogDescription>Isi data sesuai kolom report performance.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4 md:grid-cols-2">
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{tabConfig[type].dateLabel}</label>
                            <Input value={form.performanceDate || ""} onChange={(event) => updateField("performanceDate", event.target.value)} placeholder={type === "running" ? "Aug 2024" : "2024"} />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">End User</label>
                            <Input value={form.endUser || ""} onChange={(event) => updateField("endUser", event.target.value)} placeholder="KPC / PPA" />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Mine Site</label>
                            <Input value={form.mineSite || ""} onChange={(event) => updateField("mineSite", event.target.value)} placeholder="WARA / BIB / KPC" />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Manufacture</label>
                            <Input value={form.manufacture || ""} onChange={(event) => updateField("manufacture", event.target.value)} placeholder="Michelin / Bridgestone" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Specification</label>
                            <Input value={form.specification || ""} onChange={(event) => updateField("specification", event.target.value)} placeholder="27.00R49 XD GRIP B ***" />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Avg. Hours</label>
                            <Input value={String(form.avgHours ?? "")} onChange={(event) => updateField("avgHours", event.target.value)} inputMode="decimal" placeholder="5620.30" />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Record Count</label>
                            <Input value={String(form.recordCount ?? "")} onChange={(event) => updateField("recordCount", event.target.value)} inputMode="numeric" placeholder="321" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Remarks</label>
                            <Textarea value={form.remarks || ""} onChange={(event) => updateField("remarks", event.target.value)} placeholder="Catatan tambahan" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Simpan
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

function TirePerformanceImportDialog({
    type,
    onImported,
}: {
    type: TirePerformanceType
    onImported: (rows: TirePerformanceDbRow[]) => void
}) {
    const [open, setOpen] = React.useState(false)
    const [fileName, setFileName] = React.useState("")
    const [previewRows, setPreviewRows] = React.useState<TirePerformanceActionInput[]>([])
    const [loading, setLoading] = React.useState(false)
    const [importing, setImporting] = React.useState(false)

    const resetImport = () => {
        setFileName("")
        setPreviewRows([])
    }

    const parseFile = async (file: File) => {
        setLoading(true)
        try {
            const buffer = await file.arrayBuffer()
            const workbook = XLSX.read(buffer, { type: "array" })
            const sheet = workbook.Sheets[workbook.SheetNames[0]]
            const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" })
            const normalizedRows = rows
                .map((row) => normalizeTirePerformanceImportRow(row, type))
                .filter((row) => Boolean(row.performanceDate || row.endUser || row.mineSite || row.manufacture || row.specification || row.avgHours || row.recordCount))

            setFileName(file.name)
            setPreviewRows(normalizedRows)
            toast.success(`${normalizedRows.length} baris siap diimport`)
        } catch (error) {
            console.error("Parse tire performance import error:", error)
            toast.error("Gagal membaca file import")
        } finally {
            setLoading(false)
        }
    }

    const handleImport = async () => {
        if (previewRows.length === 0) {
            toast.error("Pilih file import terlebih dahulu")
            return
        }

        setImporting(true)
        const result = await importTirePerformanceRecords(previewRows)
        setImporting(false)

        if (!result.success || !result.data) {
            toast.error(result.error)
            return
        }

        onImported(result.data)
        toast.success(`${result.count} data tire performance berhasil diimport`)
        setOpen(false)
        resetImport()
    }

    return (
        <Dialog open={open} onOpenChange={(nextOpen) => {
            setOpen(nextOpen)
            if (!nextOpen) resetImport()
        }}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                    <Upload className="h-4 w-4" />
                    Import
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[780px]">
                <DialogHeader>
                    <DialogTitle>Import {tabConfig[type].label}</DialogTitle>
                    <DialogDescription>
                        Upload Excel/CSV. Kolom akan dipetakan otomatis dari {tabConfig[type].dateLabel}, End User, Mine site, Manufacture, Specification, Avg. Hours, Record Count.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="rounded-lg border border-dashed p-8 text-center">
                        <input
                            id={`tire-performance-import-${type}`}
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            className="hidden"
                            onChange={(event) => {
                                const file = event.target.files?.[0]
                                if (file) parseFile(file)
                                event.target.value = ""
                            }}
                        />
                        <label htmlFor={`tire-performance-import-${type}`} className="flex cursor-pointer flex-col items-center gap-2">
                            <FileUp className="h-8 w-8 text-muted-foreground" />
                            <span className="text-sm font-medium">{loading ? "Membaca file..." : "Klik untuk pilih file Excel/CSV"}</span>
                            {fileName && <span className="text-xs text-muted-foreground">{fileName}</span>}
                        </label>
                    </div>
                    {previewRows.length > 0 && (
                        <div className="overflow-hidden rounded-md border">
                            <div className="border-b bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                                Preview {Math.min(previewRows.length, 8)} dari {previewRows.length} baris
                            </div>
                            <div className="max-h-56 overflow-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>{tabConfig[type].dateLabel}</TableHead>
                                            <TableHead>End User</TableHead>
                                            <TableHead>Mine Site</TableHead>
                                            <TableHead>Manufacture</TableHead>
                                            <TableHead>Specification</TableHead>
                                            <TableHead className="text-right">Avg. Hours</TableHead>
                                            <TableHead className="text-right">Record Count</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {previewRows.slice(0, 8).map((row, index) => (
                                            <TableRow key={`${row.performanceDate}-${row.specification}-${index}`}>
                                                <TableCell>{row.performanceDate || "-"}</TableCell>
                                                <TableCell>{row.endUser || "-"}</TableCell>
                                                <TableCell>{row.mineSite || "-"}</TableCell>
                                                <TableCell>{row.manufacture || "-"}</TableCell>
                                                <TableCell>{row.specification || "-"}</TableCell>
                                                <TableCell className="text-right">{formatNumber(String(row.avgHours || "0"))}</TableCell>
                                                <TableCell className="text-right">{formatNumber(String(row.recordCount || "0"))}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
                    <Button onClick={handleImport} disabled={importing || loading || previewRows.length === 0}>
                        {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Import Data
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function FilterSelect({
    value,
    onChange,
    label,
    options,
}: {
    value: string
    onChange: (value: string) => void
    label: string
    options: string[]
}) {
    return (
        <label className="min-w-[180px] flex-1 text-xs font-medium text-muted-foreground">
            {label}
            <select
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm"
            >
                <option value="">Semua</option>
                {options.map((option) => (
                    <option key={option} value={option}>{option}</option>
                ))}
            </select>
        </label>
    )
}

function PerformanceTab({
    type,
    rows,
    onSaved,
    onImported,
    onDeleted,
}: {
    type: TirePerformanceType
    rows: TirePerformanceRow[]
    onSaved: (row: TirePerformanceDbRow, mode: "create" | "edit") => void
    onImported: (rows: TirePerformanceDbRow[]) => void
    onDeleted: (id: number) => void
}) {
    const config = tabConfig[type]
    const [search, setSearch] = React.useState("")
    const [filters, setFilters] = React.useState({
        performanceDate: "",
        endUser: "",
        mineSite: "",
        manufacture: "",
        specification: "",
    })
    const [viewMode, setViewMode] = React.useState<"summary" | "detail">("summary")
    const [deletingId, setDeletingId] = React.useState<number | null>(null)

    const filteredRows = React.useMemo(() => {
        const keyword = search.trim().toLowerCase()
        return rows.filter((row) => {
            const matchesFilters = Object.entries(filters).every(([key, value]) => !value || String(row[key as keyof typeof filters]) === value)
            if (!matchesFilters) return false
            if (!keyword) return true
            return [row.performanceDate, row.endUser, row.mineSite, row.manufacture, row.specification, row.avgHours, row.recordCount, row.remarks]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
                .includes(keyword)
        })
    }, [filters, rows, search])

    const aggregates = React.useMemo(() => aggregateTirePerformanceRows(filteredRows), [filteredRows])

    const handleDelete = async (id: number) => {
        setDeletingId(id)
        const result = await deleteTirePerformanceRecord(id)
        setDeletingId(null)

        if (!result.success) {
            toast.error(result.error)
            return
        }

        onDeleted(id)
        toast.success("Data tire performance dihapus")
    }

    return (
        <div className="space-y-4">
            <div className="overflow-hidden rounded-lg border bg-white">
                <div className="flex flex-col gap-4 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <Badge variant="secondary" className="mb-2">{config.label}</Badge>
                        <h1 className="text-xl font-black tracking-tight text-cyan-700 md:text-2xl">{config.title}</h1>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button variant={viewMode === "summary" ? "default" : "outline"} onClick={() => setViewMode("summary")}>Summary</Button>
                        <Button variant={viewMode === "detail" ? "default" : "outline"} onClick={() => setViewMode("detail")}>Detail CRUD</Button>
                        <TirePerformanceImportDialog type={type} onImported={onImported} />
                        <TirePerformanceDialog
                            type={type}
                            onSaved={onSaved}
                            trigger={
                                <Button className="gap-2">
                                    <Plus className="h-4 w-4" />
                                    Tambah
                                </Button>
                            }
                        />
                    </div>
                </div>
                <div className="space-y-3 p-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
                        <div className="w-full xl:max-w-xs">
                            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Cari Data</label>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari end user, site, spec..." className="pl-8" />
                            </div>
                        </div>
                        <div className="flex flex-1 flex-wrap gap-2">
                            <FilterSelect label={config.dateLabel} value={filters.performanceDate} onChange={(value) => setFilters((current) => ({ ...current, performanceDate: value }))} options={uniqueOptions(rows, "performanceDate")} />
                            <FilterSelect label="End User" value={filters.endUser} onChange={(value) => setFilters((current) => ({ ...current, endUser: value }))} options={uniqueOptions(rows, "endUser")} />
                            <FilterSelect label="Mine Site" value={filters.mineSite} onChange={(value) => setFilters((current) => ({ ...current, mineSite: value }))} options={uniqueOptions(rows, "mineSite")} />
                            <FilterSelect label="Manufacture" value={filters.manufacture} onChange={(value) => setFilters((current) => ({ ...current, manufacture: value }))} options={uniqueOptions(rows, "manufacture")} />
                            <FilterSelect label="Specification" value={filters.specification} onChange={(value) => setFilters((current) => ({ ...current, specification: value }))} options={uniqueOptions(rows, "specification")} />
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Filter className="h-3.5 w-3.5" />
                        {filteredRows.length} detail row, {aggregates.length} summary group
                    </div>
                </div>
            </div>

            <div className="overflow-hidden rounded-md border bg-card">
                <div className="overflow-x-auto">
                    <Table className="min-w-[1180px]">
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                <TableHead>{config.dateLabel}</TableHead>
                                <TableHead>End User</TableHead>
                                <TableHead>Mine Site</TableHead>
                                <TableHead>Manufacture</TableHead>
                                <TableHead>Specification</TableHead>
                                <TableHead className="text-right">Avg. Hours</TableHead>
                                <TableHead className="text-right">Record Count</TableHead>
                                {viewMode === "detail" && <TableHead>Remarks</TableHead>}
                                {viewMode === "detail" && <TableHead className="text-right">Aksi</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {viewMode === "summary" ? (
                                aggregates.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-32 text-center text-sm text-muted-foreground">Belum ada data.</TableCell>
                                    </TableRow>
                                ) : (
                                    aggregates.map((row) => (
                                        <TableRow key={row.key}>
                                            <TableCell className="font-medium">{row.performanceDate}</TableCell>
                                            <TableCell>{row.endUser}</TableCell>
                                            <TableCell>{row.mineSite}</TableCell>
                                            <TableCell>{row.manufacture}</TableCell>
                                            <TableCell>{row.specification}</TableCell>
                                            <TableCell className="text-right font-medium">{formatNumber(row.avgHours)}</TableCell>
                                            <TableCell className="text-right">{formatNumber(row.recordCount)}</TableCell>
                                        </TableRow>
                                    ))
                                )
                            ) : filteredRows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="h-32 text-center text-sm text-muted-foreground">Belum ada data.</TableCell>
                                </TableRow>
                            ) : (
                                filteredRows.map((row) => (
                                    <TableRow key={row.id}>
                                        <TableCell className="font-medium">{row.performanceDate || "-"}</TableCell>
                                        <TableCell>{row.endUser || "-"}</TableCell>
                                        <TableCell>{row.mineSite || "-"}</TableCell>
                                        <TableCell>{row.manufacture || "-"}</TableCell>
                                        <TableCell>{row.specification || "-"}</TableCell>
                                        <TableCell className="text-right font-medium">{formatNumber(row.avgHours)}</TableCell>
                                        <TableCell className="text-right">{formatNumber(row.recordCount)}</TableCell>
                                        <TableCell>{row.remarks || "-"}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <TirePerformanceDialog
                                                    type={type}
                                                    row={row}
                                                    onSaved={onSaved}
                                                    trigger={
                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                            <Edit2 className="h-4 w-4" />
                                                        </Button>
                                                    }
                                                />
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-destructive"
                                                    onClick={() => handleDelete(row.id)}
                                                    disabled={deletingId === row.id}
                                                    aria-label={`Hapus tire performance ${row.id}`}
                                                >
                                                    {deletingId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                                </Button>
                                            </div>
                                        </TableCell>
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

export function TirePerformanceClient({ data }: { data: TirePerformanceDbRow[] }) {
    const [rows, setRows] = React.useState<TirePerformanceRow[]>(data.map(rowToTypedRecord))

    const handleSaved = (savedRow: TirePerformanceDbRow, mode: "create" | "edit") => {
        const typedRow = rowToTypedRecord(savedRow)
        setRows((current) => mode === "create"
            ? [typedRow, ...current]
            : current.map((row) => (row.id === typedRow.id ? typedRow : row)))
    }

    const handleImported = (importedRows: TirePerformanceDbRow[]) => {
        setRows((current) => [...importedRows.map(rowToTypedRecord), ...current])
    }

    const handleDeleted = (id: number) => {
        setRows((current) => current.filter((row) => row.id !== id))
    }

    const runningRows = rows.filter((row) => row.type === "running")
    const scrapRows = rows.filter((row) => row.type === "scrap")

    return (
        <Tabs defaultValue="running" className="space-y-4">
            <TabsList className="grid w-full max-w-xl grid-cols-2">
                <TabsTrigger value="running">Tire Running Performance</TabsTrigger>
                <TabsTrigger value="scrap">Tire Scrap</TabsTrigger>
            </TabsList>
            <TabsContent value="running">
                <PerformanceTab type="running" rows={runningRows} onSaved={handleSaved} onImported={handleImported} onDeleted={handleDeleted} />
            </TabsContent>
            <TabsContent value="scrap">
                <PerformanceTab type="scrap" rows={scrapRows} onSaved={handleSaved} onImported={handleImported} onDeleted={handleDeleted} />
            </TabsContent>
        </Tabs>
    )
}
