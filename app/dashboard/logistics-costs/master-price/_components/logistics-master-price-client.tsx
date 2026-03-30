"use client"

import { useMemo, useState, useTransition } from "react"
import * as XLSX from "xlsx"
import { toast } from "sonner"
import { Download, FileSpreadsheet, Pencil, Plus, Search, Trash2, Truck } from "lucide-react"
import {
    deleteLogisticsMasterPrice,
    importLogisticsMasterPrices,
    upsertLogisticsMasterPrice,
} from "@/app/actions/logistics-master-price"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"

interface LogisticsMasterPriceRow {
    id: number
    fromLocation: string
    toLocation: string
    cost: string
    truckType: string | null
    statusTb: string | null
    ring24: number | null
    ring25: number | null
    ring29: number | null
    ring33: number | null
    ring35: number | null
    ring49: number | null
    ring51: number | null
    ring57: number | null
    ring63: number | null
    productType: string | null
    notes: string | null
    updatedAt: Date
}

interface LogisticsMasterPriceClientProps {
    initialRows: LogisticsMasterPriceRow[]
}

type FormState = {
    fromLocation: string
    toLocation: string
    cost: string
    truckType: string
    statusTb: string
    ring24: string
    ring25: string
    ring29: string
    ring33: string
    ring35: string
    ring49: string
    ring51: string
    ring57: string
    ring63: string
    productType: string
    notes: string
}

type ImportMapping = Record<string, string>

const fieldDefinitions = [
    { key: "fromLocation", label: "From" },
    { key: "toLocation", label: "To" },
    { key: "cost", label: "Cost" },
    { key: "truckType", label: "Truck Type" },
    { key: "statusTb", label: "Status TB until" },
    { key: "ring24", label: 'Ring 24"' },
    { key: "ring25", label: 'Ring 25"' },
    { key: "ring29", label: 'Ring 29"' },
    { key: "ring33", label: 'Ring 33"' },
    { key: "ring35", label: 'Ring 35"' },
    { key: "ring49", label: 'Ring 49"' },
    { key: "ring51", label: 'Ring 51"' },
    { key: "ring57", label: 'Ring 57"' },
    { key: "ring63", label: 'Ring 63"' },
    { key: "productType", label: "Product Type" },
    { key: "notes", label: "Notes" },
] as const

const emptyForm: FormState = {
    fromLocation: "",
    toLocation: "",
    cost: "",
    truckType: "",
    statusTb: "",
    ring24: "",
    ring25: "",
    ring29: "",
    ring33: "",
    ring35: "",
    ring49: "",
    ring51: "",
    ring57: "",
    ring63: "",
    productType: "",
    notes: "",
}

const fmtCurrency = (value: number) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value)

const parseNumber = (value: string) => {
    const cleaned = value.replace(/[^0-9.-]/g, "")
    return cleaned ? Number(cleaned) : 0
}

const parseNullableInt = (value: string) => {
    const cleaned = value.replace(/[^0-9-]/g, "")
    return cleaned ? Number(cleaned) : null
}

function RingCapacityCell({ row }: { row: LogisticsMasterPriceRow }) {
    const ringItems = [
        { label: '24"', value: row.ring24 },
        { label: '25"', value: row.ring25 },
        { label: '29"', value: row.ring29 },
        { label: '33"', value: row.ring33 },
        { label: '35"', value: row.ring35 },
        { label: '49"', value: row.ring49 },
        { label: '51"', value: row.ring51 },
        { label: '57"', value: row.ring57 },
        { label: '63"', value: row.ring63 },
    ]

    return (
        <div className="grid min-w-[260px] grid-cols-3 gap-1.5">
            {ringItems.map((item) => (
                <div
                    key={item.label}
                    className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] leading-tight"
                >
                    <div className="font-bold text-slate-500">Ring {item.label}</div>
                    <div className="mt-0.5 font-semibold text-slate-900">
                        {item.value !== null && item.value !== undefined ? `Max ${item.value} pcs` : "-"}
                    </div>
                </div>
            ))}
        </div>
    )
}

function toFormState(row?: LogisticsMasterPriceRow): FormState {
    if (!row) return emptyForm

    return {
        fromLocation: row.fromLocation ?? "",
        toLocation: row.toLocation ?? "",
        cost: String(Math.round(Number(row.cost || 0))),
        truckType: row.truckType ?? "",
        statusTb: row.statusTb ?? "",
        ring24: row.ring24?.toString() ?? "",
        ring25: row.ring25?.toString() ?? "",
        ring29: row.ring29?.toString() ?? "",
        ring33: row.ring33?.toString() ?? "",
        ring35: row.ring35?.toString() ?? "",
        ring49: row.ring49?.toString() ?? "",
        ring51: row.ring51?.toString() ?? "",
        ring57: row.ring57?.toString() ?? "",
        ring63: row.ring63?.toString() ?? "",
        productType: row.productType ?? "",
        notes: row.notes ?? "",
    }
}

function inferMapping(columns: string[]) {
    const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "")

    const candidates: Record<string, string[]> = {
        fromLocation: ["from", "origin", "asal"],
        toLocation: ["to", "destination", "tujuan"],
        cost: ["cost", "harga", "ongkir", "deliveryprice", "pricedelivery"],
        truckType: ["trucktype", "jenistruck", "truck"],
        statusTb: ["statustbuntill", "statustbuntil", "statustb", "tbuntil", "statustbuntillring24"],
        ring24: ["ring24"],
        ring25: ["ring25"],
        ring29: ["ring29"],
        ring33: ["ring33"],
        ring35: ["ring35"],
        ring49: ["ring49"],
        ring51: ["ring51"],
        ring57: ["ring57"],
        ring63: ["ring63"],
        productType: ["producttype", "jenisproduct", "typeproduct", "emtbacc"],
        notes: ["notes", "keterangan", "remark"],
    }

    return Object.fromEntries(
        fieldDefinitions.map((field) => {
            const match = columns.find((column) => {
                const normalizedColumn = normalize(column)
                return candidates[field.key].some((candidate) => normalizedColumn.includes(candidate))
            })
            return [field.key, match ?? "__skip__"]
        })
    ) as ImportMapping
}

export function LogisticsMasterPriceClient({ initialRows }: LogisticsMasterPriceClientProps) {
    const [rows, setRows] = useState(initialRows)
    const [searchInput, setSearchInput] = useState("")
    const [search, setSearch] = useState("")
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [form, setForm] = useState<FormState>(emptyForm)
    const [isImportOpen, setIsImportOpen] = useState(false)
    const [importRows, setImportRows] = useState<Record<string, unknown>[]>([])
    const [importColumns, setImportColumns] = useState<string[]>([])
    const [mapping, setMapping] = useState<ImportMapping>({} as ImportMapping)
    const [importMode, setImportMode] = useState<"append" | "replace">("append")
    const [isPending, startTransition] = useTransition()

    const filteredRows = useMemo(() => {
        const keyword = search.trim().toLowerCase()
        if (!keyword) return rows

        return rows.filter((row) =>
            [
                row.fromLocation,
                row.toLocation,
                row.truckType,
                row.statusTb,
                row.productType,
                row.notes,
                row.cost,
                row.ring24,
                row.ring25,
                row.ring29,
                row.ring33,
                row.ring35,
                row.ring49,
                row.ring51,
                row.ring57,
                row.ring63,
            ]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(keyword))
        )
    }, [rows, search])

    const totalRoutes = rows.length
    const totalCost = rows.reduce((sum, row) => sum + Number(row.cost || 0), 0)

    const applySearch = () => {
        setSearch(searchInput.trim())
    }

    const resetSearch = () => {
        setSearchInput("")
        setSearch("")
    }

    const openCreateDialog = () => {
        setEditingId(null)
        setForm(emptyForm)
        setIsFormOpen(true)
    }

    const openEditDialog = (row: LogisticsMasterPriceRow) => {
        setEditingId(row.id)
        setForm(toFormState(row))
        setIsFormOpen(true)
    }

    const updateForm = (key: keyof FormState, value: string) => {
        setForm((current) => ({ ...current, [key]: value }))
    }

    const buildPayload = () => ({
        fromLocation: form.fromLocation.trim(),
        toLocation: form.toLocation.trim(),
        cost: parseNumber(form.cost),
        truckType: form.truckType || null,
        statusTb: form.statusTb || null,
        ring24: parseNullableInt(form.ring24),
        ring25: parseNullableInt(form.ring25),
        ring29: parseNullableInt(form.ring29),
        ring33: parseNullableInt(form.ring33),
        ring35: parseNullableInt(form.ring35),
        ring49: parseNullableInt(form.ring49),
        ring51: parseNullableInt(form.ring51),
        ring57: parseNullableInt(form.ring57),
        ring63: parseNullableInt(form.ring63),
        productType: form.productType || null,
        notes: form.notes || null,
    })

    const refreshRows = (nextRows: LogisticsMasterPriceRow[]) => {
        setRows(nextRows.sort((left, right) => right.id - left.id))
    }

    const handleSave = () => {
        startTransition(async () => {
            const result = await upsertLogisticsMasterPrice(buildPayload(), editingId ?? undefined)
            if (!result.success) {
                toast.error(result.error || "Gagal menyimpan data")
                return
            }

            const nextRow: LogisticsMasterPriceRow = {
                id: editingId ?? Math.max(0, ...rows.map((row) => row.id)) + 1,
                ...buildPayload(),
                cost: String(buildPayload().cost),
                updatedAt: new Date(),
            }

            if (editingId) {
                refreshRows(rows.map((row) => (row.id === editingId ? nextRow : row)))
                toast.success("Data logistic price berhasil diperbarui")
            } else {
                refreshRows([nextRow, ...rows])
                toast.success("Data logistic price berhasil ditambahkan")
            }

            setIsFormOpen(false)
            setForm(emptyForm)
            setEditingId(null)
        })
    }

    const handleDelete = (row: LogisticsMasterPriceRow) => {
        if (!confirm(`Hapus route ${row.fromLocation} -> ${row.toLocation}?`)) {
            return
        }

        startTransition(async () => {
            const result = await deleteLogisticsMasterPrice(row.id)
            if (!result.success) {
                toast.error(result.error || "Gagal menghapus data")
                return
            }

            refreshRows(rows.filter((item) => item.id !== row.id))
            toast.success("Data logistic price berhasil dihapus")
        })
    }

    const handleFileImport = async (file: File) => {
        const buffer = await file.arrayBuffer()
        const workbook = XLSX.read(buffer, { type: "array" })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "" })

        if (!rawRows.length) {
            toast.error("File import tidak memiliki data")
            return
        }

        const columns = Object.keys(rawRows[0] ?? {})
        setImportRows(rawRows)
        setImportColumns(columns)
        setMapping(inferMapping(columns))
        toast.success(`${rawRows.length} baris berhasil dibaca. Silakan cek mapping kolom.`)
    }

    const handleImportSubmit = () => {
        if (!importRows.length) {
            toast.error("Belum ada file yang dipilih")
            return
        }

        const mappedRows = importRows
            .map((row) => {
                const read = (field: string) => {
                    const column = mapping[field]
                    return column && column !== "__skip__" ? row[column] : ""
                }

                return {
                    fromLocation: String(read("fromLocation") || "").trim(),
                    toLocation: String(read("toLocation") || "").trim(),
                    cost: parseNumber(String(read("cost") || "0")),
                    truckType: String(read("truckType") || "").trim() || null,
                    statusTb: String(read("statusTb") || "").trim() || null,
                    ring24: parseNullableInt(String(read("ring24") || "")),
                    ring25: parseNullableInt(String(read("ring25") || "")),
                    ring29: parseNullableInt(String(read("ring29") || "")),
                    ring33: parseNullableInt(String(read("ring33") || "")),
                    ring35: parseNullableInt(String(read("ring35") || "")),
                    ring49: parseNullableInt(String(read("ring49") || "")),
                    ring51: parseNullableInt(String(read("ring51") || "")),
                    ring57: parseNullableInt(String(read("ring57") || "")),
                    ring63: parseNullableInt(String(read("ring63") || "")),
                    productType: String(read("productType") || "").trim() || null,
                    notes: String(read("notes") || "").trim() || null,
                }
            })
            .filter((row) => row.fromLocation && row.toLocation)

        if (!mappedRows.length) {
            toast.error("Tidak ada data valid yang bisa diimport")
            return
        }

        startTransition(async () => {
            const result = await importLogisticsMasterPrices(mappedRows, importMode)
            if (!result.success) {
                toast.error(result.error || "Gagal import data")
                return
            }

            const maxExistingId = rows.reduce((max, row) => Math.max(max, row.id), 0)
            const synthesizedRows: LogisticsMasterPriceRow[] = mappedRows.map((row, index) => ({
                id: importMode === "replace" ? index + 1 : maxExistingId + index + 1,
                ...row,
                cost: String(row.cost),
                updatedAt: new Date(),
            }))

            refreshRows(importMode === "replace" ? synthesizedRows : [...synthesizedRows, ...rows])
            setIsImportOpen(false)
            setImportRows([])
            setImportColumns([])
            setMapping({} as ImportMapping)
            setImportMode("append")
            toast.success(`${result.imported ?? mappedRows.length} data berhasil diimport`)
        })
    }

    const exportTemplate = () => {
        const workbook = XLSX.utils.book_new()
        const worksheet = XLSX.utils.json_to_sheet([
            {
                From: "BALIKPAPAN",
                To: "BALIKPAPAN (KOTA-KOTA)",
                Cost: 997000,
                TruckType: "Long Bad Type",
                "Status TB untill": "Max 80 Pcs",
                'Ring 24"': 16,
                'Ring 25"': 9,
                'Ring 29"': 9,
                'Ring 33"': 9,
                'Ring 35"': 6,
                'Ring 49"': 4,
                'Ring 51"': 2,
                'Ring 57"': 1,
                'Ring 63"': 1,
                "Product Type (EM / TB / Acc)": "TB & EM",
                Notes: "",
            },
        ])
        XLSX.utils.book_append_sheet(workbook, worksheet, "Master Price Logistic")
        XLSX.writeFile(workbook, "master-price-logistic-template.xlsx")
    }

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">Total Route</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-black text-slate-900">{totalRoutes}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">Total Cost</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-black text-emerald-700">{fmtCurrency(totalCost)}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">Truck Type</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-black text-blue-700">
                            {new Set(rows.map((row) => row.truckType).filter(Boolean)).size}
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardContent className="space-y-4 pt-6">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex w-full max-w-2xl flex-col gap-2 sm:flex-row">
                            <div className="relative flex-1">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={searchInput}
                                    onChange={(event) => setSearchInput(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                            event.preventDefault()
                                            applySearch()
                                        }
                                    }}
                                    className="pl-9"
                                    placeholder="Cari from, to, cost, truck type, status TB, product type..."
                                />
                            </div>
                            <Button type="button" variant="outline" onClick={applySearch}>
                                <Search className="mr-2 h-4 w-4" />
                                Search
                            </Button>
                            <Button type="button" variant="ghost" onClick={resetSearch}>
                                Reset
                            </Button>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" onClick={exportTemplate}>
                                <Download className="mr-2 h-4 w-4" />
                                Download Template
                            </Button>
                            <Button variant="outline" onClick={() => setIsImportOpen(true)}>
                                <FileSpreadsheet className="mr-2 h-4 w-4" />
                                Import & Mapping
                            </Button>
                            <Button onClick={openCreateDialog}>
                                <Plus className="mr-2 h-4 w-4" />
                                Tambah Data
                            </Button>
                        </div>
                    </div>

                    <div className="overflow-x-auto rounded-xl border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>From</TableHead>
                                    <TableHead>To</TableHead>
                                    <TableHead>Cost</TableHead>
                                    <TableHead>Truck Type</TableHead>
                                    <TableHead>Status TB</TableHead>
                                    <TableHead>Product Type</TableHead>
                                    <TableHead>Ring</TableHead>
                                    <TableHead className="text-right">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredRows.length ? filteredRows.map((row) => (
                                    <TableRow key={row.id}>
                                        <TableCell className="font-semibold">{row.fromLocation}</TableCell>
                                        <TableCell>{row.toLocation}</TableCell>
                                        <TableCell className="font-semibold text-emerald-700">{fmtCurrency(Number(row.cost || 0))}</TableCell>
                                        <TableCell>{row.truckType || "-"}</TableCell>
                                        <TableCell className="max-w-[180px] truncate">{row.statusTb || "-"}</TableCell>
                                        <TableCell>{row.productType || "-"}</TableCell>
                                        <TableCell>
                                            <RingCapacityCell row={row} />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="ghost" size="icon" onClick={() => openEditDialog(row)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(row)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                                            Data belum ada. Tambahkan manual atau import dari file.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>{editingId ? "Edit Master Price Logistic" : "Tambah Master Price Logistic"}</DialogTitle>
                        <DialogDescription>
                            Simpan route delivery beserta harga, truck type, kapasitas ring, dan product type.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>From</Label>
                            <Input value={form.fromLocation} onChange={(e) => updateForm("fromLocation", e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>To</Label>
                            <Input value={form.toLocation} onChange={(e) => updateForm("toLocation", e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Cost</Label>
                            <Input value={form.cost} onChange={(e) => updateForm("cost", e.target.value)} inputMode="numeric" />
                        </div>
                        <div className="space-y-2">
                            <Label>Truck Type</Label>
                            <Input value={form.truckType} onChange={(e) => updateForm("truckType", e.target.value)} />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Status TB until</Label>
                        <Input value={form.statusTb} onChange={(e) => updateForm("statusTb", e.target.value)} />
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                        {(["ring24", "ring25", "ring29", "ring33", "ring35", "ring49", "ring51", "ring57", "ring63"] as const).map((field) => (
                            <div className="space-y-2" key={field}>
                                <Label>{field.replace("ring", 'Ring ')}</Label>
                                <Input value={form[field]} onChange={(e) => updateForm(field, e.target.value)} inputMode="numeric" />
                            </div>
                        ))}
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Product Type</Label>
                            <Input value={form.productType} onChange={(e) => updateForm("productType", e.target.value)} placeholder="TB / EM / Acc" />
                        </div>
                        <div className="space-y-2">
                            <Label>Notes</Label>
                            <Textarea value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} rows={3} />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsFormOpen(false)}>Batal</Button>
                        <Button onClick={handleSave} disabled={isPending}>
                            <Truck className="mr-2 h-4 w-4" />
                            {editingId ? "Update Data" : "Simpan Data"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
                    <DialogHeader>
                        <DialogTitle>Import Master Price Logistic</DialogTitle>
                        <DialogDescription>
                            Upload file CSV/XLSX, lalu atur mapping kolom manual sebelum import data.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 md:grid-cols-[1.4fr_220px]">
                        <div className="space-y-2">
                            <Label>Pilih File</Label>
                            <Input
                                type="file"
                                accept=".csv,.xlsx,.xls"
                                onChange={(e) => {
                                    const file = e.target.files?.[0]
                                    if (file) {
                                        void handleFileImport(file)
                                    }
                                }}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Mode Import</Label>
                            <Select value={importMode} onValueChange={(value) => setImportMode(value as "append" | "replace")}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="append">Append</SelectItem>
                                    <SelectItem value="replace">Replace Existing</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {importColumns.length > 0 ? (
                        <>
                            <div className="grid gap-4 md:grid-cols-2">
                                {fieldDefinitions.map((field) => (
                                    <div className="space-y-2" key={field.key}>
                                        <Label>{field.label}</Label>
                                        <Select
                                            value={mapping[field.key] || "__skip__"}
                                            onValueChange={(value) => setMapping((current) => ({ ...current, [field.key]: value }))}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Pilih kolom sumber" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="__skip__">Skip</SelectItem>
                                                {importColumns.map((column) => (
                                                    <SelectItem key={column} value={column}>
                                                        {column}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                ))}
                            </div>

                            <div className="overflow-x-auto rounded-xl border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            {importColumns.slice(0, 6).map((column) => (
                                                <TableHead key={column}>{column}</TableHead>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {importRows.slice(0, 5).map((row, index) => (
                                            <TableRow key={index}>
                                                {importColumns.slice(0, 6).map((column) => (
                                                    <TableCell key={column}>{String(row[column] ?? "")}</TableCell>
                                                ))}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </>
                    ) : null}

                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsImportOpen(false)}>Tutup</Button>
                        <Button onClick={handleImportSubmit} disabled={isPending || !importRows.length}>
                            <FileSpreadsheet className="mr-2 h-4 w-4" />
                            Import Data
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
