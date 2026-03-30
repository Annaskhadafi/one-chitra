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
import { Plus, Trash2, Upload, Search, FileDown, Loader2 } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getEvhsMasterPrices, createOrUpdateMasterPrice, deleteMasterPrice, bulkDeleteMasterPrices } from "@/app/actions/evhs-master"
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

type ImportStep = "idle" | "mapping" | "processing" | "result"
type WarehouseOption = {
    id: number
    sloc: string
    description: string | null
}
type MasterPriceRow = Awaited<ReturnType<typeof getEvhsMasterPrices>>[number]
type ImportPreviewRow = {
    sloc?: string
    materialNumberCp?: string
    materialNumberCk?: string
    price?: string
}
type ImportErrorRow = {
    line: number
    error: string
    data: ImportPreviewRow
}
type CsvMappingField = "sloc" | "materialNumberCp" | "materialNumberCk" | "price"

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : "Terjadi kesalahan yang tidak diketahui"
}

export function EvhsMasterPriceTable({ warehouses = [] }: { warehouses?: WarehouseOption[] }) {
    const queryClient = useQueryClient()
    const fileInputRef = useRef<HTMLInputElement>(null)

    // UI State
    const [searchQuery, setSearchQuery] = useState("")
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isImportOpen, setIsImportOpen] = useState(false)
    const [importStep, setImportStep] = useState<ImportStep>("idle")
    const [selectedIds, setSelectedIds] = useState<number[]>([])

    // Form State (Manual Add/Edit)
    const [formData, setFormData] = useState({
        materialNumberCp: "",
        materialNumberCk: "",
        warehouseId: "",
        price: ""
    })

    // Import State
    const [csvHeaders, setCsvHeaders] = useState<string[]>([])
    const [csvRows, setCsvRows] = useState<string[][]>([])
    const [mapping, setMapping] = useState<Record<string, string>>({
        sloc: "",
        materialNumberCp: "",
        materialNumberCk: "",
        price: ""
    })
    const [importProgress, setImportProgress] = useState(0)
    const [importResults, setImportResults] = useState<{
        success: number;
        failed: number;
        errors: ImportErrorRow[];
    }>({ success: 0, failed: 0, errors: [] })

    const { data: prices = [], isLoading } = useQuery<MasterPriceRow[]>({
        queryKey: ["evhs-master-prices"],
        queryFn: () => getEvhsMasterPrices()
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
        }
    })

    const deleteMutation = useMutation({
        mutationFn: deleteMasterPrice,
        onSuccess: () => {
            toast.success("Data berhasil dihapus")
            queryClient.invalidateQueries({ queryKey: ["evhs-master-prices"] })
        }
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
        }
    })

    const filteredPrices = prices.filter((p) =>
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
            warehouseId: parseInt(formData.warehouseId)
        })
    }

    const downloadTemplate = () => {
        const headers = ["sloc", "warehouse_name", "material_cp", "material_ck", "price"]
        const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" +
            "CP-01,Site Adaro,110149C112,900052960,142959000\n" +
            "CP-02,Site Kaltim,460A124801,900101284,550000"

        const encodedUri = encodeURI(csvContent)
        const link = document.createElement("a")
        link.setAttribute("href", encodedUri)
        link.setAttribute("download", "template_master_price_ck.csv")
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (event) => {
            const content = event.target?.result as string
            const lines = content.split("\n").map(l => l.trim()).filter(l => l !== "")
            if (lines.length < 2) {
                return toast.error("File CSV kosong atau tidak valid")
            }

            const headers = lines[0].split(",").map(h => h.trim())
            const rows = lines.slice(1).map(l => l.split(",").map(c => c.trim()))

            setCsvHeaders(headers)
            setCsvRows(rows)

            // Auto mapping logic
            const newMapping = { sloc: "", materialNumberCp: "", materialNumberCk: "", price: "" }
            headers.forEach(h => {
                const lower = h.toLowerCase()
                if (lower.includes("sloc")) newMapping.sloc = h
                if (lower.includes("cp")) newMapping.materialNumberCp = h
                if (lower.includes("ck")) newMapping.materialNumberCk = h
                if (lower.includes("price") || lower.includes("harga")) newMapping.price = h
            })
            setMapping(newMapping)
            setImportStep("mapping")
            setIsImportOpen(true)
        }
        reader.readAsText(file)
    }

    const startImport = async () => {
        if (!mapping.sloc || !mapping.materialNumberCp || !mapping.price) {
            return toast.error("Mohon lengkapi pemetaan kolom (Mapping)")
        }

        setImportStep("processing")
        setImportProgress(0)

        let successCount = 0
        let failedCount = 0
        const errorsList: ImportErrorRow[] = []

        for (let i = 0; i < csvRows.length; i++) {
            const row = csvRows[i]
            const rowData: Record<string, string | undefined> = {}
            csvHeaders.forEach((h, idx) => {
                rowData[h] = row[idx]
            })

            const mappedData = {
                sloc: rowData[mapping.sloc],
                materialNumberCp: rowData[mapping.materialNumberCp],
                materialNumberCk: rowData[mapping.materialNumberCk],
                price: rowData[mapping.price]
            }

            try {
                // Validation
                const warehouse = warehouses.find(w => w.sloc.toLowerCase() === mappedData.sloc?.toLowerCase())
                if (!warehouse) throw new Error("Sloc '" + (mappedData.sloc || "KOSONG") + "' tidak ditemukan")
                if (!mappedData.materialNumberCp) throw new Error("Material CP wajib diisi")
                if (!mappedData.price || isNaN(parseFloat(mappedData.price))) throw new Error("Harga '" + (mappedData.price || "KOSONG") + "' tidak valid")

                const result = await createOrUpdateMasterPrice({
                    materialNumberCp: mappedData.materialNumberCp,
                    materialNumberCk: mappedData.materialNumberCk,
                    warehouseId: warehouse.id,
                    price: mappedData.price
                })

                if (result.success) {
                    successCount++
                } else {
                    throw new Error(result.error)
                }
            } catch (err) {
                failedCount++
                errorsList.push({
                    line: i + 2,
                    error: getErrorMessage(err),
                    data: mappedData
                })
            }

            setImportProgress(Math.round(((i + 1) / csvRows.length) * 100))
            setImportResults({
                success: successCount,
                failed: failedCount,
                errors: errorsList
            })
        }

        setImportStep("result")
        queryClient.invalidateQueries({ queryKey: ["evhs-master-prices"] })
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-blue-50 p-4 rounded-lg border border-blue-100">
                <div className="space-y-1">
                    <h4 className="text-sm font-bold text-blue-900">Master Data Price PT. CK</h4>
                    <p className="text-xs text-blue-700">Kelola harga material khusus untuk PT. Cipta Kridatama per Sloc dan Warehouse.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="bg-white border-blue-200 text-blue-700 hover:bg-blue-100" onClick={downloadTemplate}>
                        <FileDown className="mr-2 h-4 w-4" /> Template CSV
                    </Button>
                    <div className="relative">
                        <input
                            type="file"
                            accept=".csv"
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            onClick={(e) => { (e.target as HTMLInputElement).value = "" }}
                        />
                        <Button
                            variant="outline"
                            size="sm"
                            className="bg-white border-blue-200 text-blue-700 hover:bg-blue-100"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <Upload className="mr-2 h-4 w-4" /> Import Data Price
                        </Button>
                    </div>
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setIsDialogOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" /> Tambah Harga
                    </Button>
                </div>
            </div>

            <div className="flex items-center justify-between gap-2">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Cari Material, Sloc, atau Warehouse..."
                        className="pl-8 text-sm"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                {selectedIds.length > 0 && (
                    <Button
                        variant="destructive"
                        size="sm"
                        className="bg-red-600 hover:bg-red-700 h-9"
                        onClick={() => {
                            if(confirm(`Hapus ${selectedIds.length} data master price yang terpilih?`)) {
                                bulkDeleteMutation.mutate(selectedIds)
                            }
                        }}
                        disabled={bulkDeleteMutation.isPending}
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {bulkDeleteMutation.isPending ? "Menghapus..." : `Hapus (${selectedIds.length})`}
                    </Button>
                )}
            </div>

            <div className="rounded-md border bg-card overflow-x-auto shadow-sm">
                <Table className="min-w-[1100px]">
                    <TableHeader className="bg-slate-50 uppercase text-[10px] tracking-wider font-bold">
                        <TableRow>
                            <TableHead className="w-[40px] px-2 text-center border-r">
                                <Checkbox
                                    checked={filteredPrices.length > 0 && selectedIds.length === filteredPrices.length}
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
                            <TableHead className="w-[150px] border-r">Warehouse Name</TableHead>
                            <TableHead className="border-r">Material CP</TableHead>
                            <TableHead className="border-r">Material CK</TableHead>
                            <TableHead className="border-r">Product Description</TableHead>
                            <TableHead className="text-right border-r">Price (IDR)</TableHead>
                            <TableHead className="w-[80px] text-center">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow><TableCell colSpan={6} className="text-center py-10">Memuat data...</TableCell></TableRow>
                        ) : filteredPrices.length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground italic">Belum ada data harga.</TableCell></TableRow>
                        ) : (
                            filteredPrices.map((p) => (
                                <TableRow key={p.id} className={cn("text-xs group hover:bg-blue-50/30 transition-colors", selectedIds.includes(p.id) && "bg-blue-50/50")}>
                                    <TableCell className="px-2 text-center border-r">
                                        <Checkbox
                                            checked={selectedIds.includes(p.id)}
                                            onCheckedChange={(checked) => {
                                                if (checked) {
                                                    setSelectedIds([...selectedIds, p.id])
                                                } else {
                                                    setSelectedIds(selectedIds.filter(id => id !== p.id))
                                                }
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell className="border-r font-bold text-blue-700">{p.warehouse?.sloc}</TableCell>
                                    <TableCell className="border-r text-slate-600 font-medium truncate max-w-[140px]" title={p.warehouse?.description}>
                                        {p.warehouse?.description || "-"}
                                    </TableCell>
                                    <TableCell className="font-mono font-medium border-r">{p.materialNumberCp}</TableCell>
                                    <TableCell className="text-slate-600 font-mono border-r">{p.materialNumberCk || "-"}</TableCell>
                                    <TableCell className="border-r text-slate-700 max-w-[260px] truncate" title={p.productDescription || "-"}>
                                        {p.productDescription || "-"}
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-bold text-slate-800 border-r">
                                        {Number(p.price).toLocaleString('id-ID', { minimumFractionDigits: 2 })}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full"
                                            onClick={() => { if(confirm("Hapus data harga ini?")) deleteMutation.mutate(p.id) }}
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
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Tambah / Update Harga Master</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                        <div className="grid gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="warehouse" className="text-xs font-bold uppercase tracking-wide">Warehouse / Site (Sloc) <span className="text-red-500">*</span></Label>
                                <select
                                    id="warehouse"
                                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:ring-1 focus:ring-blue-500"
                                    value={formData.warehouseId}
                                    onChange={(e) => setFormData({...formData, warehouseId: e.target.value})}
                                >
                                    <option value="">Pilih Warehouse...</option>
                                    {warehouses.map((w) => (
                                        <option key={w.id} value={w.id}>{w.sloc} - {w.description}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="matCp" className="text-xs font-bold uppercase tracking-wide">Material CP <span className="text-red-500">*</span></Label>
                                    <Input id="matCp" placeholder="110149C112" className="h-9 text-sm" value={formData.materialNumberCp} onChange={(e) => setFormData({...formData, materialNumberCp: e.target.value})} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="matCk" className="text-xs font-bold uppercase tracking-wide">Material CK</Label>
                                    <Input id="matCk" placeholder="900052960" className="h-9 text-sm" value={formData.materialNumberCk} onChange={(e) => setFormData({...formData, materialNumberCk: e.target.value})} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="price" className="text-xs font-bold uppercase tracking-wide">Harga Satuan (IDR) <span className="text-red-500">*</span></Label>
                                <Input id="price" type="number" step="0.01" className="h-9 text-sm font-mono font-bold" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} />
                            </div>
                        </div>
                        <DialogFooter className="gap-2 sm:gap-0 mt-4">
                            <Button type="button" variant="outline" size="sm" onClick={() => setIsDialogOpen(false)}>Batal</Button>
                            <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" disabled={mutation.isPending}>
                                {mutation.isPending ? "Menyimpan..." : "Simpan Data Harga"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Dialog Advanced Import */}
            <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
                <DialogContent className={cn("transition-all duration-300", importStep === "result" ? "sm:max-w-2xl" : "sm:max-w-md")}>
                    <DialogHeader>
                        <DialogTitle>Import Master Price</DialogTitle>
                        <DialogDescription>
                            {importStep === "mapping" && "Petakan kolom CSV bapak ke dalam sistem."}
                            {importStep === "processing" && "Sedang memproses data harga..."}
                            {importStep === "result" && "Proses import selesai."}
                        </DialogDescription>
                    </DialogHeader>

                    {importStep === "mapping" && (
                        <div className="space-y-4 py-4">
                            <div className="grid gap-3">
                                {(["sloc", "materialNumberCp", "materialNumberCk", "price"] as CsvMappingField[]).map((field) => (
                                    <div key={field} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-2 sm:gap-4">
                                        <Label className="text-[10px] font-bold uppercase">
                                            {field === "materialNumberCp" ? "Material CP" : field === "materialNumberCk" ? "Material CK" : field}
                                            {field !== "materialNumberCk" && " (Wajib)"}
                                        </Label>
                                        <select
                                            className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-[10px] shadow-sm"
                                            value={mapping[field]}
                                            onChange={(e) => setMapping({...mapping, [field]: e.target.value})}
                                        >
                                            <option value="">Pilih Kolom...</option>
                                            {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                        </select>
                                    </div>
                                ))}
                            </div>
                            <DialogFooter>
                                <Button variant="outline" size="sm" onClick={() => setIsImportOpen(false)}>Batal</Button>
                                <Button size="sm" onClick={startImport} className="bg-blue-600 hover:bg-blue-700 text-white">Mulai Import</Button>
                            </DialogFooter>
                        </div>
                    )}

                    {importStep === "processing" && (
                        <div className="space-y-6 py-10 text-center">
                            <Loader2 className="h-10 w-10 text-blue-600 animate-spin mx-auto" />
                            <div className="space-y-2">
                                <p className="text-sm font-bold">Memproses {importResults.success + importResults.failed} / {csvRows.length}</p>
                                <Progress value={importProgress} className="h-2" />
                            </div>
                        </div>
                    )}

                    {importStep === "result" && (
                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="bg-green-50 p-4 rounded-lg border border-green-100 text-center">
                                    <p className="text-2xl font-bold text-green-700">{importResults.success}</p>
                                    <p className="text-[10px] text-green-600 uppercase font-bold">Berhasil</p>
                                </div>
                                <div className="bg-red-50 p-4 rounded-lg border border-red-100 text-center">
                                    <p className="text-2xl font-bold text-red-700">{importResults.failed}</p>
                                    <p className="text-[10px] text-red-600 uppercase font-bold">Gagal</p>
                                </div>
                            </div>
                            {importResults.errors.length > 0 && (
                                <div className="space-y-2 max-h-[150px] overflow-auto border rounded p-2 bg-slate-50">
                                    {importResults.errors.map((err, idx) => (
                                        <div key={idx} className="text-[10px] text-red-600 flex gap-2">
                                            <span className="font-bold">Baris {err.line}:</span>
                                            <span>{err.error}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <Button size="sm" className="w-full" onClick={() => setIsImportOpen(false)}>Tutup</Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
