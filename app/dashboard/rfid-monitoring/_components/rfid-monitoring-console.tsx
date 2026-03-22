"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
    Activity,
    AlertTriangle,
    Check,
    ChevronsUpDown,
    Eraser,
    Pencil,
    RadioTower,
    Save,
    Tags,
    Trash2,
    Waypoints,
    Wrench,
} from "lucide-react"
import { toast } from "sonner"

import {
    deleteRfidScanEvent,
    getRfidMonitoringSummary,
    manageRfidTagBinding,
    resetRfidTagViaReader,
    saveRfidTagMonitoringData,
} from "@/app/actions/rfid"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const statCards = [
    { key: "activePilotWarehouses", label: "Pilot Warehouse", icon: RadioTower },
    { key: "trackedUnits", label: "Tracked Units", icon: Waypoints },
    { key: "activeTags", label: "Active Tags", icon: Tags },
    { key: "openExceptions", label: "Open Exceptions", icon: AlertTriangle },
    { key: "openScanSessions", label: "Open Scan Sessions", icon: Activity },
    { key: "pendingWriteSessions", label: "Pending Write Sessions", icon: Wrench },
] as const

const tagStatusOptions = [
    "blank",
    "active",
    "damaged",
    "lost",
    "retired",
    "locked",
] as const

type MonitoringSummary = Awaited<ReturnType<typeof getRfidMonitoringSummary>>
type MonitoringWarehouse = {
    id: number
    sloc: string
    description: string | null
    type: string | null
}
type MonitoringProduct = {
    id: number
    category: string
    materialNumber: string
    materialDescription: string | null
    defaultTrackingMode: string
    serialRequired: boolean
    rfidCapable: boolean
}

type SearchableOption = {
    value: string
    label: string
    keywords: string
    description?: string
}

type TagFormState = {
    rfidTagId: number | null
    warehouseId: string
    productId: string
    deviceId: string
    epc: string
    tid: string
    tagSerial: string
    tagType: string
    status: (typeof tagStatusOptions)[number]
    isReusable: boolean
    materialNumber: string
    serialNumber: string
    notes: string
}

const formatDateTime = (value: Date | string | null | undefined) => {
    if (!value) {
        return "-"
    }

    return new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(value))
}

const formatEnumLabel = (value: string | null | undefined) => {
    if (!value) {
        return "-"
    }

    return value.replaceAll("_", " ")
}

const buildDefaultForm = (warehouses: MonitoringWarehouse[]): TagFormState => ({
    rfidTagId: null,
    warehouseId: warehouses[0]?.id ? String(warehouses[0].id) : "",
    productId: "",
    deviceId: "",
    epc: "",
    tid: "",
    tagSerial: "",
    tagType: "label",
    status: "active",
    isReusable: false,
    materialNumber: "",
    serialNumber: "",
    notes: "",
})

type SearchableSelectProps = {
    value: string
    options: SearchableOption[]
    placeholder: string
    searchPlaceholder: string
    emptyMessage: string
    onChange: (value: string) => void
    allowClear?: boolean
}

function SearchableSelect({
    value,
    options,
    placeholder,
    searchPlaceholder,
    emptyMessage,
    onChange,
    allowClear = false,
}: SearchableSelectProps) {
    const [open, setOpen] = useState(false)
    const selectedOption = options.find((option) => option.value === value)

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
                    <span className={cn("truncate text-left", !selectedOption && "text-muted-foreground")}>
                        {selectedOption ? selectedOption.label : placeholder}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[420px] max-w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                    <CommandInput placeholder={searchPlaceholder} />
                    <CommandList>
                        <CommandEmpty>{emptyMessage}</CommandEmpty>
                        <CommandGroup className="max-h-[320px] overflow-auto">
                            {allowClear ? (
                                <CommandItem
                                    value="kosongkan pilihan"
                                    onSelect={() => {
                                        onChange("")
                                        setOpen(false)
                                    }}
                                >
                                    <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                                        <span>Kosongkan pilihan</span>
                                        {!selectedOption ? <Check className="h-4 w-4 text-primary" /> : null}
                                    </div>
                                </CommandItem>
                            ) : null}
                            {options.map((option) => (
                                <CommandItem
                                    key={option.value}
                                    value={option.keywords}
                                    onSelect={() => {
                                        onChange(option.value)
                                        setOpen(false)
                                    }}
                                >
                                    <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <div className="truncate">{option.label}</div>
                                            {option.description ? (
                                                <div className="truncate text-xs text-muted-foreground">
                                                    {option.description}
                                                </div>
                                            ) : null}
                                        </div>
                                        <Check
                                            className={cn(
                                                "mt-0.5 h-4 w-4 shrink-0",
                                                value === option.value ? "opacity-100 text-primary" : "opacity-0",
                                            )}
                                        />
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

type RfidMonitoringConsoleProps = {
    summary: MonitoringSummary
    warehouses: MonitoringWarehouse[]
    products: MonitoringProduct[]
}

export function RfidMonitoringConsole({ summary, warehouses, products }: RfidMonitoringConsoleProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const uniqueWarehouses = useMemo<MonitoringWarehouse[]>(() => {
        const bySloc = new Map<string, MonitoringWarehouse>()

        for (const warehouse of warehouses) {
            const key = warehouse.sloc.trim().toUpperCase()
            if (!key || bySloc.has(key)) {
                continue
            }

            bySloc.set(key, warehouse)
        }

        return Array.from(bySloc.values())
    }, [warehouses])

    const uniqueProducts = useMemo<MonitoringProduct[]>(() => {
        const byMaterialNumber = new Map<string, MonitoringProduct>()

        for (const product of products) {
            const key = product.materialNumber.trim().toUpperCase()
            if (!key) {
                continue
            }

            const existing = byMaterialNumber.get(key)
            if (!existing) {
                byMaterialNumber.set(key, product)
                continue
            }

            const existingScore = Number(Boolean(existing.materialDescription)) + Number(existing.rfidCapable)
            const nextScore = Number(Boolean(product.materialDescription)) + Number(product.rfidCapable)

            if (nextScore > existingScore) {
                byMaterialNumber.set(key, product)
            }
        }

        return Array.from(byMaterialNumber.values())
    }, [products])

    const warehouseOptions = useMemo<SearchableOption[]>(
        () =>
            uniqueWarehouses.map((warehouse) => ({
                value: String(warehouse.id),
                label: `${warehouse.sloc} - ${warehouse.description || "Tanpa deskripsi"}`,
                keywords: `${warehouse.sloc} ${warehouse.description || ""} ${warehouse.type || ""}`.trim(),
                description: warehouse.type ? `Tipe ${warehouse.type}` : undefined,
            })),
        [uniqueWarehouses],
    )

    const productOptions = useMemo<SearchableOption[]>(
        () =>
            uniqueProducts.map((product) => ({
                value: String(product.id),
                label: `${product.materialNumber} - ${product.materialDescription || "Tanpa deskripsi"}`,
                keywords: `${product.materialNumber} ${product.materialDescription || ""} ${product.category || ""}`.trim(),
                description: [
                    product.category?.trim() || null,
                    product.rfidCapable ? "RFID Ready" : null,
                    product.serialRequired ? "Serial wajib" : null,
                ].filter(Boolean).join(" · "),
            })),
        [uniqueProducts],
    )

    const [form, setForm] = useState<TagFormState>(() => buildDefaultForm(uniqueWarehouses))

    const selectedProduct = useMemo(
        () =>
            uniqueProducts.find((product) => String(product.id) === form.productId) ??
            (form.materialNumber
                ? uniqueProducts.find((product) => product.materialNumber === form.materialNumber)
                : undefined),
        [form.materialNumber, form.productId, uniqueProducts],
    )

    useEffect(() => {
        setForm((current) => {
            if (current.rfidTagId || current.epc || current.warehouseId) {
                return current
            }

            return buildDefaultForm(uniqueWarehouses)
        })
    }, [uniqueWarehouses])

    const availableWriterDevices = useMemo(() => {
        if (!form.warehouseId) {
            return summary.writerDevices
        }

        return summary.writerDevices.filter((device) =>
            !device.warehouseId || String(device.warehouseId) === form.warehouseId,
        )
    }, [form.warehouseId, summary.writerDevices])

    useEffect(() => {
        if (!form.deviceId) {
            return
        }

        const deviceStillAvailable = availableWriterDevices.some((device) => String(device.id) === form.deviceId)
        if (!deviceStillAvailable) {
            setForm((current) => ({
                ...current,
                deviceId: "",
            }))
        }
    }, [availableWriterDevices, form.deviceId])

    const resetForm = () => {
        setForm(buildDefaultForm(uniqueWarehouses))
    }

    const loadTagIntoForm = (tag: MonitoringSummary["recentTags"][number]) => {
        const matchedProduct = tag.memoryMaterialNumber
            ? uniqueProducts.find((product) => product.materialNumber === tag.memoryMaterialNumber)
            : undefined

        setForm((current) => ({
            ...current,
            rfidTagId: tag.id,
            warehouseId: tag.lastSeenWarehouseId ? String(tag.lastSeenWarehouseId) : current.warehouseId,
            productId: matchedProduct ? String(matchedProduct.id) : "",
            deviceId: "",
            epc: tag.epc,
            tid: tag.tid ?? "",
            tagSerial: tag.tagSerial ?? "",
            tagType: tag.tagType || "label",
            status: tag.status,
            isReusable: tag.isReusable,
            materialNumber: tag.memoryMaterialNumber ?? "",
            serialNumber: tag.memorySerialNumber ?? "",
            notes: tag.notes ?? "",
        }))
    }

    const handleSaveTag = () => {
        if (!form.warehouseId) {
            toast.error("Pilih warehouse terlebih dahulu")
            return
        }

        if (!form.epc.trim()) {
            toast.error("EPC wajib diisi")
            return
        }

        startTransition(async () => {
            const effectiveMaterialNumber = selectedProduct?.materialNumber ?? form.materialNumber ?? null
            const result = await saveRfidTagMonitoringData({
                rfidTagId: form.rfidTagId,
                warehouseId: Number(form.warehouseId),
                deviceId: form.deviceId ? Number(form.deviceId) : null,
                epc: form.epc,
                tid: form.tid || null,
                tagSerial: form.tagSerial || null,
                tagType: form.tagType,
                status: form.status,
                isReusable: form.isReusable,
                materialNumber: effectiveMaterialNumber,
                serialNumber: form.serialNumber || null,
                notes: form.notes || null,
            })

            if (!result.success) {
                toast.error(result.error || "Gagal menyimpan data tag RFID")
                return
            }

            toast.success(
                result.operationType === "register"
                    ? `Tag ${result.epc} berhasil didaftarkan`
                    : `Tag ${result.epc} berhasil diperbarui`,
            )
            resetForm()
            router.refresh()
        })
    }

    const handleResetTag = (tagId: number, warehouseId?: number | null) => {
        const effectiveWarehouseId = warehouseId ?? (form.warehouseId ? Number(form.warehouseId) : null)
        if (!effectiveWarehouseId) {
            toast.error("Warehouse tag belum diketahui. Muat tag ke form atau set warehouse dulu.")
            return
        }

        const confirmed = window.confirm("Kosongkan data tag ini dan lepaskan binding aktifnya?")
        if (!confirmed) {
            return
        }

        startTransition(async () => {
            const result = await resetRfidTagViaReader({
                rfidTagId: tagId,
                warehouseId: effectiveWarehouseId,
                deviceId: form.deviceId ? Number(form.deviceId) : null,
                notes: form.notes || "Tag dikosongkan dari RFID Monitoring",
            })

            if (!result.success) {
                toast.error(result.error || "Gagal mengosongkan data tag")
                return
            }

            toast.success(`Tag ${result.epc} berhasil dikosongkan. Unit terdampak: ${result.affectedUnits}`)
            if (form.rfidTagId === tagId) {
                resetForm()
            }
            router.refresh()
        })
    }

    const handleBindingOperation = (operation: "bind" | "replace" | "unbind") => {
        if (!form.rfidTagId) {
            toast.error("Simpan atau load tag dulu sebelum melakukan binding")
            return
        }

        if (!form.warehouseId) {
            toast.error("Pilih warehouse terlebih dahulu")
            return
        }

        if (operation !== "unbind" && !form.productId) {
            toast.error("Pilih product / material dulu")
            return
        }

        if (operation !== "unbind" && !form.serialNumber.trim()) {
            toast.error("Serial number / unit ID wajib diisi")
            return
        }

        const confirmed = window.confirm(
            operation === "replace"
                ? "Ganti tag aktif di unit ini dengan tag yang sedang dipilih?"
                : operation === "unbind"
                    ? "Lepas binding aktif tag ini dari inventory unit?"
                    : "Bind tag ini ke inventory unit berdasarkan warehouse, product, dan serial?",
        )

        if (!confirmed) {
            return
        }

        startTransition(async () => {
            const result = await manageRfidTagBinding({
                operation,
                rfidTagId: form.rfidTagId,
                warehouseId: Number(form.warehouseId),
                productId: operation === "unbind" ? null : Number(form.productId),
                serialNumber: operation === "unbind" ? null : form.serialNumber,
                deviceId: form.deviceId ? Number(form.deviceId) : null,
                notes: form.notes || null,
            })

            if (!result.success) {
                toast.error(result.error || "Operasi binding tag gagal")
                return
            }

            if (operation === "unbind") {
                toast.success(`Binding tag ${result.epc} berhasil dilepas dari unit ${result.serialNumber || "-"}`)
            } else if (operation === "replace") {
                toast.success(
                    `Tag ${result.epc} berhasil menggantikan tag lama pada unit ${result.serialNumber || "-"}`,
                )
            } else {
                toast.success(`Tag ${result.epc} berhasil di-bind ke unit ${result.serialNumber || "-"}`)
            }

            router.refresh()
        })
    }

    const handleDeleteScan = (scanEventId: number, epc: string) => {
        const confirmed = window.confirm(`Hapus scan event untuk EPC ${epc}?`)
        if (!confirmed) {
            return
        }

        startTransition(async () => {
            const result = await deleteRfidScanEvent({ scanEventId })

            if (!result.success) {
                toast.error(result.error || "Gagal menghapus scan RFID")
                return
            }

            toast.success(`Scan ${result.epc} berhasil dihapus dari monitoring`)
            router.refresh()
        })
    }

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            <div className="space-y-1">
                <h1 className="text-2xl font-bold tracking-tight">RFID Monitoring</h1>
                <p className="text-sm text-muted-foreground">
                    Pantau pilot RFID, input data tag, kosongkan tag dengan reader, dan bersihkan scan yang tidak valid dari web.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {statCards.map((stat) => {
                    const Icon = stat.icon
                    const value = summary.totals[stat.key]

                    return (
                        <Card key={stat.key}>
                            <CardContent className="flex items-center justify-between p-6">
                                <div className="space-y-1">
                                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                                    <p className="text-3xl font-bold">{value}</p>
                                </div>
                                <div className="rounded-full bg-primary/10 p-3 text-primary">
                                    <Icon className="h-5 w-5" />
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.25fr,0.75fr]">
                <Card>
                    <CardHeader>
                        <CardTitle>Tag Operations</CardTitle>
                        <CardDescription>
                            Gunakan area ini untuk input atau update data EPC, pilih warehouse dan product dari master data, lalu kosongkan tag melalui desktop RFID reader.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Warehouse</Label>
                                <SearchableSelect
                                    value={form.warehouseId}
                                    options={warehouseOptions}
                                    placeholder="Pilih warehouse"
                                    searchPlaceholder="Cari sloc atau nama warehouse..."
                                    emptyMessage="Warehouse tidak ditemukan"
                                    onChange={(value) => setForm((current) => ({ ...current, warehouseId: value }))}
                                />
                                {uniqueWarehouses.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">
                                        Daftar ini mengambil data dari master di halaman Warehouse. Kalau masih kosong, berarti user ini memang belum mendapat daftar warehouse yang bisa dilihat.
                                    </p>
                                ) : null}
                            </div>

                            <div className="space-y-2">
                                <Label>RFID Reader / Encoder</Label>
                                <Select
                                    value={form.deviceId || "none"}
                                    onValueChange={(value) => setForm((current) => ({ ...current, deviceId: value === "none" ? "" : value }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Pilih reader" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Tanpa device spesifik</SelectItem>
                                        {availableWriterDevices.map((device) => (
                                            <SelectItem key={device.id} value={String(device.id)}>
                                                {device.deviceName}
                                                {device.warehouse ? ` - ${device.warehouse.sloc}` : ""}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            <div className="space-y-2">
                                <Label>EPC</Label>
                                <Input
                                    value={form.epc}
                                    onChange={(event) => setForm((current) => ({ ...current, epc: event.target.value.toUpperCase() }))}
                                    placeholder="E280-..."
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>TID</Label>
                                <Input
                                    value={form.tid}
                                    onChange={(event) => setForm((current) => ({ ...current, tid: event.target.value.toUpperCase() }))}
                                    placeholder="Opsional"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Tag Serial</Label>
                                <Input
                                    value={form.tagSerial}
                                    onChange={(event) => setForm((current) => ({ ...current, tagSerial: event.target.value }))}
                                    placeholder="Serial fisik tag"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Tag Type</Label>
                                <Input
                                    value={form.tagType}
                                    onChange={(event) => setForm((current) => ({ ...current, tagType: event.target.value }))}
                                    placeholder="label / tire_patch / pallet"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Status Tag</Label>
                                <Select
                                    value={form.status}
                                    onValueChange={(value: TagFormState["status"]) => setForm((current) => ({ ...current, status: value }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Pilih status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {tagStatusOptions.map((status) => (
                                            <SelectItem key={status} value={status}>
                                                {formatEnumLabel(status)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Reusable</Label>
                                <div className="flex h-10 items-center rounded-md border px-3">
                                    <Switch
                                        checked={form.isReusable}
                                        onCheckedChange={(checked) => setForm((current) => ({ ...current, isReusable: checked }))}
                                    />
                                    <span className="ml-3 text-sm text-muted-foreground">
                                        {form.isReusable ? "Tag bisa dipakai ulang" : "Tag sekali pakai / khusus"}
                                    </span>
                                </div>
                            </div>
                            <div className="space-y-2 md:col-span-2 xl:col-span-2">
                                <Label>Product / Material</Label>
                                <SearchableSelect
                                    value={form.productId}
                                    options={productOptions}
                                    placeholder="Pilih product dari master"
                                    searchPlaceholder="Cari material number atau deskripsi..."
                                    emptyMessage="Product tidak ditemukan"
                                    allowClear
                                    onChange={(value) => {
                                        const selectedOption = uniqueProducts.find(
                                            (product) => String(product.id) === value,
                                        )

                                        setForm((current) => ({
                                            ...current,
                                            productId: value,
                                            materialNumber: selectedOption?.materialNumber ?? "",
                                        }))
                                    }}
                                />
                                {uniqueProducts.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">
                                        Daftar ini mengambil data dari master di halaman Product. Kalau masih kosong, berarti data product memang belum tersedia di master.
                                    </p>
                                ) : null}
                                {selectedProduct ? (
                                    <div className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                                        <span className="font-medium text-foreground">
                                            {selectedProduct.materialNumber}
                                        </span>
                                        {" · "}
                                        {selectedProduct.materialDescription || "Tanpa deskripsi"}
                                        {selectedProduct.category ? ` · ${selectedProduct.category}` : ""}
                                        {selectedProduct.rfidCapable ? " · RFID Ready" : ""}
                                        {selectedProduct.serialRequired ? " · Serial wajib" : ""}
                                    </div>
                                ) : form.materialNumber ? (
                                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                                        Material tersimpan di tag: <span className="font-medium">{form.materialNumber}</span>.
                                        Product ini belum match ke master product, jadi silakan pilih product yang benar jika perlu.
                                    </div>
                                ) : null}
                            </div>
                            <div className="space-y-2">
                                <Label>Serial Number</Label>
                                <Input
                                    value={form.serialNumber}
                                    onChange={(event) => setForm((current) => ({ ...current, serialNumber: event.target.value.toUpperCase() }))}
                                    placeholder="Serial unit / tire"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Catatan</Label>
                            <Textarea
                                value={form.notes}
                                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                                placeholder="Catatan operasi reader, alasan reset, atau info lapangan"
                                rows={3}
                            />
                        </div>

                        <div className="space-y-3 rounded-lg border border-dashed p-4">
                            <div className="space-y-1">
                                <h3 className="text-sm font-semibold">Binding ke Inventory Unit</h3>
                                <p className="text-xs text-muted-foreground">
                                    Gunakan tag yang sudah tersimpan atau di-load dari daftar Recent Tags. Product, warehouse, dan serial number pada form ini akan dipakai untuk bind, replace, atau unbind tag ke unit inventory.
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-xs">
                                <Badge variant={form.rfidTagId ? "default" : "outline"}>
                                    {form.rfidTagId ? `Tag siap: ${form.epc}` : "Simpan / load tag dulu"}
                                </Badge>
                                {form.productId && selectedProduct ? (
                                    <Badge variant="secondary">
                                        {selectedProduct.materialNumber}
                                    </Badge>
                                ) : null}
                                {form.serialNumber ? (
                                    <Badge variant="outline">
                                        Serial: {form.serialNumber}
                                    </Badge>
                                ) : null}
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    disabled={isPending || !form.rfidTagId}
                                    onClick={() => handleBindingOperation("bind")}
                                >
                                    Bind / Create Unit
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={isPending || !form.rfidTagId}
                                    onClick={() => handleBindingOperation("replace")}
                                >
                                    Replace Active Tag
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    disabled={isPending || !form.rfidTagId}
                                    onClick={() => handleBindingOperation("unbind")}
                                >
                                    Lepas Binding
                                </Button>
                            </div>

                            <div className="text-xs text-muted-foreground">
                                `Bind / Create Unit` akan memakai serial sebagai identitas unit. Jika serial belum ada, sistem akan membuat inventory unit baru. `Replace` dipakai jika unit tersebut sudah punya tag aktif. `Unbind` hanya melepas relasi database; reset isi tag tetap dilakukan lewat tombol reset/tag reader.
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <Button onClick={handleSaveTag} disabled={isPending}>
                                <Save className="mr-2 h-4 w-4" />
                                {form.rfidTagId ? "Update Tag Data" : "Input Tag Data"}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                disabled={isPending || !form.rfidTagId}
                                onClick={() => form.rfidTagId && handleResetTag(form.rfidTagId)}
                            >
                                <Eraser className="mr-2 h-4 w-4" />
                                Kosongkan Tag via Reader
                            </Button>
                            <Button type="button" variant="ghost" disabled={isPending} onClick={resetForm}>
                                Reset Form
                            </Button>
                            {form.rfidTagId ? (
                                <Badge variant="outline" className="text-xs">
                                    Editing tag #{form.rfidTagId}
                                </Badge>
                            ) : null}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Recent Tags</CardTitle>
                        <CardDescription>
                            Muat tag yang sudah tercatat ke form untuk update, verifikasi, atau reset data via reader.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {summary.recentTags.length === 0 ? (
                            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                                Belum ada tag yang tercatat di monitoring.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {summary.recentTags.map((tag) => (
                                    <div key={tag.id} className="rounded-lg border p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="space-y-2">
                                                <div className="font-mono text-sm font-semibold">{tag.epc}</div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <Badge variant="outline" className="capitalize">
                                                        {formatEnumLabel(tag.status)}
                                                    </Badge>
                                                    {tag.isReusable && (
                                                        <Badge variant="secondary">Reusable</Badge>
                                                    )}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    Material: {tag.memoryMaterialNumber || "-"} · Serial: {tag.memorySerialNumber || "-"}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    Last seen: {tag.lastSeenWarehouse?.sloc || "N/A"} · {formatDateTime(tag.lastSeenAt)}
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={isPending}
                                                    onClick={() => loadTagIntoForm(tag)}
                                                >
                                                    <Pencil className="mr-2 h-3.5 w-3.5" />
                                                    Load
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    disabled={isPending}
                                                    onClick={() => handleResetTag(tag.id, tag.lastSeenWarehouseId)}
                                                >
                                                    <Eraser className="mr-2 h-3.5 w-3.5" />
                                                    Blankkan
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Recent Write Sessions</CardTitle>
                        <CardDescription>
                            Riwayat register, verify, dan reset tag dari desktop encoder atau reader yang dipilih operator.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-lg border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Operation</TableHead>
                                        <TableHead>Tag / Material</TableHead>
                                        <TableHead>Device</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {summary.recentWriteSessions.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-24 text-center text-sm text-muted-foreground">
                                                Belum ada write session.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        summary.recentWriteSessions.map((writeSession) => (
                                            <TableRow key={writeSession.id}>
                                                <TableCell className="capitalize">{formatEnumLabel(writeSession.operationType)}</TableCell>
                                                <TableCell className="text-xs text-muted-foreground">
                                                    <div className="font-mono text-foreground">{writeSession.rfidTag?.epc || "-"}</div>
                                                    <div>{writeSession.materialNumber || writeSession.inventoryUnit?.product?.materialNumber || "-"}</div>
                                                </TableCell>
                                                <TableCell>{writeSession.device?.deviceName || "Manual / Web"}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="capitalize">
                                                        {formatEnumLabel(writeSession.status)}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Recent Scan Events</CardTitle>
                        <CardDescription>
                            Hapus scan yang salah baca, duplikat, atau tidak valid supaya monitoring warehouse tetap bersih.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-lg border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>EPC</TableHead>
                                        <TableHead>Session / Result</TableHead>
                                        <TableHead>Warehouse</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {summary.recentScanEvents.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-24 text-center text-sm text-muted-foreground">
                                                Belum ada scan event.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        summary.recentScanEvents.map((scanEvent) => (
                                            <TableRow key={scanEvent.id}>
                                                <TableCell className="text-xs">
                                                    <div className="font-mono text-foreground">{scanEvent.epc}</div>
                                                    <div className="text-muted-foreground">{formatDateTime(scanEvent.lastSeenAt)}</div>
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground">
                                                    <div className="text-foreground">{scanEvent.session?.sessionCode || "-"}</div>
                                                    <div>{formatEnumLabel(scanEvent.scanResult)}</div>
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground">
                                                    {scanEvent.warehouse?.sloc || "N/A"}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        disabled={isPending}
                                                        onClick={() => handleDeleteScan(scanEvent.id, scanEvent.epc)}
                                                    >
                                                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                                                        Hapus Scan
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Separator />

            <div className="grid gap-6 xl:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Recent Exceptions</CardTitle>
                        <CardDescription>
                            Daftar exception terbuka yang perlu dicek supervisor atau admin warehouse.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-lg border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Severity</TableHead>
                                        <TableHead>Warehouse</TableHead>
                                        <TableHead>Product / Tag</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {summary.recentExceptions.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-24 text-center text-sm text-muted-foreground">
                                                Belum ada exception terbuka.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        summary.recentExceptions.map((exception) => (
                                            <TableRow key={exception.id}>
                                                <TableCell className="font-medium">{exception.exceptionType}</TableCell>
                                                <TableCell className="capitalize">{exception.severity}</TableCell>
                                                <TableCell>{exception.warehouse?.sloc || "N/A"}</TableCell>
                                                <TableCell className="text-xs text-muted-foreground">
                                                    {exception.product?.materialNumber || exception.rfidTag?.epc || "N/A"}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Recent Scan Sessions</CardTitle>
                        <CardDescription>
                            Aktivitas scan terbaru dari handheld reader, desktop encoder, dan device RFID lain.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-lg border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Session</TableHead>
                                        <TableHead>Operation</TableHead>
                                        <TableHead>Warehouse</TableHead>
                                        <TableHead>Device</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {summary.recentSessions.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-24 text-center text-sm text-muted-foreground">
                                                Belum ada scan session.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        summary.recentSessions.map((session) => (
                                            <TableRow key={session.id}>
                                                <TableCell className="font-medium">{session.sessionCode}</TableCell>
                                                <TableCell className="capitalize">{formatEnumLabel(session.operationType)}</TableCell>
                                                <TableCell>{session.warehouse?.sloc || "N/A"}</TableCell>
                                                <TableCell>{session.device?.deviceName || "Unknown Device"}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
