"use client"

import * as React from "react"
import {
    createCosmeticTire,
    deleteCosmeticTire,
    importCosmeticTires,
    updateCosmeticTire,
    type CosmeticTireInput,
} from "@/app/actions/cosmetic-tires"
import type { getProducts } from "@/app/actions/product"
import { Check, ChevronsUpDown, Edit2, FileUp, Loader2, Plus, Search, Trash2, Upload } from "lucide-react"
import * as XLSX from "xlsx"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
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
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

type CosmeticTireRow = Awaited<ReturnType<typeof import("@/app/actions/cosmetic-tires").getCosmeticTires>>[number]
type ProductRow = Awaited<ReturnType<typeof getProducts>>[number]

const emptyForm: CosmeticTireInput = {
    tyreSize: "",
    pattern: "",
    serialNumber: "",
    month: "",
    city: "",
    year: "",
    materialNumber: "",
    description: "",
}

const formFields: Array<{
    key: keyof CosmeticTireInput
    label: string
    placeholder: string
}> = [
    { key: "tyreSize", label: "Tyre Size", placeholder: "Contoh: 12.00 R24" },
    { key: "pattern", label: "Pattern", placeholder: "Contoh: XZM TL" },
    { key: "serialNumber", label: "Serial Number", placeholder: "Serial number" },
    { key: "month", label: "Month", placeholder: "Contoh: Jan" },
    { key: "city", label: "City", placeholder: "Kota" },
    { key: "year", label: "Year", placeholder: "Contoh: 2026" },
]

function buildProductOptions(products: ProductRow[]) {
    const bestByMaterial = new Map<string, ProductRow>()

    for (const product of products) {
        const materialNumber = product.materialNumber?.trim()
        if (!materialNumber || bestByMaterial.has(materialNumber)) {
            continue
        }

        bestByMaterial.set(materialNumber, product)
    }

    return Array.from(bestByMaterial.values()).sort((left, right) =>
        left.materialNumber.localeCompare(right.materialNumber)
    )
}

function normalizeHeader(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]/g, "")
}

function stringifyCell(value: unknown) {
    if (value === null || value === undefined) return ""
    if (value instanceof Date) return value.toLocaleDateString("id-ID")
    return String(value).trim()
}

function pickValue(row: Record<string, unknown>, candidates: string[]) {
    const entry = Object.entries(row).find(([key]) => candidates.includes(normalizeHeader(key)))
    return entry ? stringifyCell(entry[1]) : ""
}

function ProductLookup({
    value,
    products,
    onSelect,
}: {
    value: string
    products: ProductRow[]
    onSelect: (product: ProductRow) => void
}) {
    const [open, setOpen] = React.useState(false)
    const productOptions = React.useMemo(() => buildProductOptions(products), [products])
    const selectedProduct = productOptions.find((product) => product.materialNumber === value)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between font-normal"
                >
                    <span className="truncate text-left">
                        {selectedProduct
                            ? `${selectedProduct.materialNumber} - ${selectedProduct.materialDescription || ""}`
                            : "Cari material number"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                    <CommandInput placeholder="Cari material number atau desc..." />
                    <CommandList>
                        <CommandEmpty>Product tidak ditemukan.</CommandEmpty>
                        <CommandGroup>
                            {productOptions.map((product) => (
                                <CommandItem
                                    key={product.materialNumber}
                                    value={`${product.materialNumber} ${product.materialDescription || ""}`}
                                    onSelect={() => {
                                        onSelect(product)
                                        setOpen(false)
                                    }}
                                >
                                    <Check
                                        className={`h-4 w-4 ${
                                            product.materialNumber === value ? "opacity-100" : "opacity-0"
                                        }`}
                                    />
                                    <div className="min-w-0">
                                        <div className="font-medium">{product.materialNumber}</div>
                                        <div className="truncate text-xs text-muted-foreground">
                                            {product.materialDescription || "-"}
                                        </div>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}

function CosmeticTireDialog({
    row,
    products,
    onSaved,
    trigger,
}: {
    row?: CosmeticTireRow
    products: ProductRow[]
    onSaved: (row: CosmeticTireRow, mode: "create" | "edit") => void
    trigger: React.ReactNode
}) {
    const [open, setOpen] = React.useState(false)
    const [loading, setLoading] = React.useState(false)
    const [form, setForm] = React.useState<CosmeticTireInput>(() => ({
        tyreSize: row?.tyreSize || "",
        pattern: row?.pattern || "",
        serialNumber: row?.serialNumber || "",
        month: row?.month || "",
        city: row?.city || "",
        year: row?.year || "",
        materialNumber: row?.materialNumber || "",
        description: row?.description || "",
    }))

    React.useEffect(() => {
        if (!open) return
        setForm({
            tyreSize: row?.tyreSize || "",
            pattern: row?.pattern || "",
            serialNumber: row?.serialNumber || "",
            month: row?.month || "",
            city: row?.city || "",
            year: row?.year || "",
            materialNumber: row?.materialNumber || "",
            description: row?.description || "",
        })
    }, [open, row])

    const handleProductChange = (product: ProductRow) => {
        setForm((current) => ({
            ...current,
            materialNumber: product.materialNumber,
            description: product?.materialDescription || "",
        }))
    }

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setLoading(true)
        const result = row
            ? await updateCosmeticTire(row.id, form)
            : await createCosmeticTire(form)
        setLoading(false)

        if (!result.success || !result.data) {
            toast.error(result.error)
            return
        }

        onSaved(result.data, row ? "edit" : "create")
        toast.success(row ? "Cosmetic tire diperbarui" : "Cosmetic tire ditambahkan")
        setOpen(false)
        if (!row) {
            setForm(emptyForm)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="sm:max-w-[720px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>{row ? "Edit Cosmetic Tire" : "Tambah Cosmetic Tire"}</DialogTitle>
                        <DialogDescription>
                            Isi data cosmetic tire sesuai kolom laporan.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4 md:grid-cols-2">
                        {formFields.map((field) => (
                            <div key={field.key}>
                                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                                    {field.label}
                                </label>
                                <Input
                                    value={form[field.key] ?? ""}
                                    onChange={(event) =>
                                        setForm((current) => ({
                                            ...current,
                                            [field.key]: event.target.value,
                                        }))
                                    }
                                    placeholder={field.placeholder}
                                />
                            </div>
                        ))}
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                                Material Number
                            </label>
                            <ProductLookup
                                value={form.materialNumber || ""}
                                products={products}
                                onSelect={handleProductChange}
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                                Desc
                            </label>
                            <Input
                                value={form.description || ""}
                                placeholder="Deskripsi material"
                                readOnly
                                className="bg-muted/40"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Batal
                        </Button>
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

function CosmeticTireImportDialog({
    products,
    onImported,
}: {
    products: ProductRow[]
    onImported: (rows: CosmeticTireRow[]) => void
}) {
    const [open, setOpen] = React.useState(false)
    const [fileName, setFileName] = React.useState("")
    const [previewRows, setPreviewRows] = React.useState<CosmeticTireInput[]>([])
    const [loading, setLoading] = React.useState(false)
    const [importing, setImporting] = React.useState(false)

    const productByMaterial = React.useMemo(() => {
        const map = new Map<string, ProductRow>()
        for (const product of products) {
            const materialNumber = product.materialNumber?.trim()
            if (materialNumber) {
                map.set(materialNumber.toUpperCase(), product)
            }
        }
        return map
    }, [products])

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
            const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
                defval: "",
            })

            const normalizedRows = rows.map((row) => {
                const materialNumber = pickValue(row, [
                    "materialnumber",
                    "materialno",
                    "material",
                    "matnumber",
                    "matno",
                ])
                const product = productByMaterial.get(materialNumber.toUpperCase())
                const description = product?.materialDescription || pickValue(row, ["desc", "description", "materialdescription"])

                return {
                    tyreSize: pickValue(row, ["tyresize", "tiresize", "size"]),
                    pattern: pickValue(row, ["pattern", "patern", "paterrn"]),
                    serialNumber: pickValue(row, ["serialnumber", "serialno", "serial"]),
                    month: pickValue(row, ["month", "bulan"]),
                    city: pickValue(row, ["city", "kota"]),
                    year: pickValue(row, ["year", "tahun"]),
                    materialNumber,
                    description,
                }
            }).filter((row) =>
                Boolean(
                    row.tyreSize ||
                    row.pattern ||
                    row.serialNumber ||
                    row.month ||
                    row.city ||
                    row.year ||
                    row.materialNumber ||
                    row.description
                )
            )

            setFileName(file.name)
            setPreviewRows(normalizedRows)
            toast.success(`${normalizedRows.length} baris siap diimport`)
        } catch (error) {
            console.error("Parse cosmetic tire import error:", error)
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
        const result = await importCosmeticTires(previewRows)
        setImporting(false)

        if (!result.success || !result.data) {
            toast.error(result.error)
            return
        }

        onImported(result.data)
        toast.success(`${result.count} data cosmetic tire berhasil diimport`)
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
            <DialogContent className="sm:max-w-[700px]">
                <DialogHeader>
                    <DialogTitle>Import Cosmetic Tire</DialogTitle>
                    <DialogDescription>
                        Upload file Excel atau CSV dengan kolom Tyre Size, Pattern, Serial Number, Month, City, Year, dan Material Number.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="rounded-lg border border-dashed p-8 text-center">
                        <input
                            id="cosmetic-tire-import"
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            className="hidden"
                            onChange={(event) => {
                                const file = event.target.files?.[0]
                                if (file) parseFile(file)
                                event.target.value = ""
                            }}
                        />
                        <label htmlFor="cosmetic-tire-import" className="flex cursor-pointer flex-col items-center gap-2">
                            <FileUp className="h-8 w-8 text-muted-foreground" />
                            <span className="text-sm font-medium">
                                {loading ? "Membaca file..." : "Klik untuk pilih file Excel/CSV"}
                            </span>
                            {fileName && <span className="text-xs text-muted-foreground">{fileName}</span>}
                        </label>
                    </div>
                    {previewRows.length > 0 && (
                        <div className="rounded-md border">
                            <div className="border-b bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                                Preview {previewRows.length} baris pertama dari file
                            </div>
                            <div className="max-h-56 overflow-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Tyre Size</TableHead>
                                            <TableHead>Pattern</TableHead>
                                            <TableHead>Serial</TableHead>
                                            <TableHead>Material</TableHead>
                                            <TableHead>Desc</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {previewRows.slice(0, 8).map((row, index) => (
                                            <TableRow key={`${row.materialNumber}-${row.serialNumber}-${index}`}>
                                                <TableCell>{row.tyreSize || "-"}</TableCell>
                                                <TableCell>{row.pattern || "-"}</TableCell>
                                                <TableCell>{row.serialNumber || "-"}</TableCell>
                                                <TableCell>{row.materialNumber || "-"}</TableCell>
                                                <TableCell>{row.description || "-"}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                        Batal
                    </Button>
                    <Button onClick={handleImport} disabled={importing || loading || previewRows.length === 0}>
                        {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Import Data
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export function CosmeticTireClient({ data, products }: { data: CosmeticTireRow[]; products: ProductRow[] }) {
    const [rows, setRows] = React.useState<CosmeticTireRow[]>(data)
    const [search, setSearch] = React.useState("")
    const [deletingId, setDeletingId] = React.useState<number | null>(null)

    const filteredRows = React.useMemo(() => {
        const keyword = search.trim().toLowerCase()
        if (!keyword) return rows

        return rows.filter((row) =>
            [
                row.tyreSize,
                row.pattern,
                row.serialNumber,
                row.month,
                row.city,
                row.year,
                row.materialNumber,
                row.description,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
                .includes(keyword)
        )
    }, [rows, search])

    const handleSaved = (savedRow: CosmeticTireRow, mode: "create" | "edit") => {
        setRows((current) => {
            if (mode === "create") {
                return [savedRow, ...current]
            }

            return current.map((row) => (row.id === savedRow.id ? savedRow : row))
        })
    }

    const handleImported = (importedRows: CosmeticTireRow[]) => {
        setRows((current) => [...importedRows, ...current])
    }

    const handleDelete = async (id: number) => {
        setDeletingId(id)
        const result = await deleteCosmeticTire(id)
        setDeletingId(null)

        if (!result.success) {
            toast.error(result.error)
            return
        }

        setRows((current) => current.filter((row) => row.id !== id))
        toast.success("Cosmetic tire dihapus")
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 rounded-lg border bg-white p-4 md:flex-row md:items-end md:justify-between">
                <div className="w-full md:max-w-sm">
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Cari Cosmetic Tire</label>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Cari tyre size, serial, material..."
                            className="pl-8"
                        />
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <CosmeticTireImportDialog products={products} onImported={handleImported} />
                    <CosmeticTireDialog
                        products={products}
                        onSaved={handleSaved}
                        trigger={
                            <Button className="gap-2">
                                <Plus className="h-4 w-4" />
                                Tambah
                            </Button>
                        }
                    />
                </div>
            </div>

            <div className="overflow-hidden rounded-md border bg-card">
                <div className="overflow-x-auto">
                    <Table className="min-w-[1180px]">
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                <TableHead className="w-14 text-center">No.</TableHead>
                                <TableHead>Tyre Size</TableHead>
                                <TableHead>Pattern</TableHead>
                                <TableHead>Serial Number</TableHead>
                                <TableHead>Month</TableHead>
                                <TableHead>City</TableHead>
                                <TableHead>Year</TableHead>
                                <TableHead>Material Number</TableHead>
                                <TableHead>Desc</TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredRows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={10} className="h-32 text-center text-sm text-muted-foreground">
                                        Belum ada data cosmetic tire.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredRows.map((row, index) => (
                                    <TableRow key={row.id}>
                                        <TableCell className="text-center font-mono">{index + 1}</TableCell>
                                        <TableCell className="font-medium">{row.tyreSize || "-"}</TableCell>
                                        <TableCell>{row.pattern || "-"}</TableCell>
                                        <TableCell>{row.serialNumber || "-"}</TableCell>
                                        <TableCell>{row.month || "-"}</TableCell>
                                        <TableCell>{row.city || "-"}</TableCell>
                                        <TableCell>{row.year || "-"}</TableCell>
                                        <TableCell className="font-medium text-blue-600">{row.materialNumber || "-"}</TableCell>
                                        <TableCell className="whitespace-normal">{row.description || "-"}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <CosmeticTireDialog
                                                    row={row}
                                                    products={products}
                                                    onSaved={handleSaved}
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
                                                    aria-label={`Hapus cosmetic tire ${row.id}`}
                                                >
                                                    {deletingId === row.id ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="h-4 w-4" />
                                                    )}
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
