"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2, FileText, UploadCloud, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { createSettlement, uploadSettlementReceipt } from "@/app/actions/cost-settlement"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"

type FleetTripOption = {
    id: number
    tripNumber: string
    driverLabel: string
    advanceAmount: number
}

type DeliveryOption = {
    id: number
    deliveryNumber: string | null
    customerName: string
    advanceAmount: number
}

type ItemDraft = {
    costCategory: "gasoline" | "toll" | "parking" | "meals" | "maintenance" | "others"
    description: string
    amount: number
    vendorName: string
    receiptDate: string
    files: File[]
}

type SignatoryDraft = {
    signatoryName: string
    signatoryPosition: string
    signatoryRole: string
}

const categoryOptions: ItemDraft["costCategory"][] = ["gasoline", "toll", "parking", "meals", "maintenance", "others"]
const categoryLabels: Record<ItemDraft["costCategory"], string> = {
    gasoline: "BBM",
    toll: "Tol",
    parking: "Parkir / Retribusi",
    meals: "Uang Makan",
    maintenance: "Perbaikan",
    others: "Lain-lain",
}

export function SettlementCreateForm({
    fleetTrips,
    deliveries,
}: {
    fleetTrips: FleetTripOption[]
    deliveries: DeliveryOption[]
}) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [settlementType, setSettlementType] = useState<"trip" | "delivery">("trip")
    const [fleetTripId, setFleetTripId] = useState<number | null>(fleetTrips[0]?.id ?? null)
    const [deliveryId, setDeliveryId] = useState<number | null>(deliveries[0]?.id ?? null)
    const [settlementDate, setSettlementDate] = useState<string>(new Date().toISOString().slice(0, 10))
    const [remarks, setRemarks] = useState("")
    const [items, setItems] = useState<ItemDraft[]>([
        {
            costCategory: "gasoline",
            description: "",
            amount: 0,
            vendorName: "",
            receiptDate: new Date().toISOString().slice(0, 10),
            files: [],
        },
    ])
    const [signatories, setSignatories] = useState<SignatoryDraft[]>([])

    const totalActual = useMemo(
        () => items.reduce((sum, item) => sum + Number(item.amount || 0), 0),
        [items],
    )

    const advanceAmount = useMemo(() => {
        if (settlementType === "trip") {
            return fleetTrips.find((trip) => trip.id === fleetTripId)?.advanceAmount ?? 0
        }
        return deliveries.find((delivery) => delivery.id === deliveryId)?.advanceAmount ?? 0
    }, [settlementType, fleetTripId, deliveryId, fleetTrips, deliveries])

    const varianceAmount = totalActual - advanceAmount

    const addItem = () => {
        setItems((prev) => [
            ...prev,
            {
                costCategory: "others",
                description: "",
                amount: 0,
                vendorName: "",
                receiptDate: new Date().toISOString().slice(0, 10),
                files: [],
            },
        ])
    }

    const removeItem = (index: number) => {
        setItems((prev) => prev.filter((_, idx) => idx !== index))
    }

    const addSignatory = () => {
        setSignatories((prev) => [
            ...prev,
            {
                signatoryName: "",
                signatoryPosition: "",
                signatoryRole: "Diperiksa oleh",
            },
        ])
    }

    const removeSignatory = (index: number) => {
        setSignatories((prev) => prev.filter((_, idx) => idx !== index))
    }

    const onSubmit = () => {
        startTransition(async () => {
            try {
                // Validasi Inti: Tanggal nota wajib diisi
                const itemsWithoutDate = items.filter((item) => !item.receiptDate || item.receiptDate.trim() === "")
                if (itemsWithoutDate.length > 0) {
                    toast.error("Tanggal nota pada semua item biaya wajib diisi.")
                    return
                }

                // Validasi Inti: Jumlah wajib diisi dan rebih dari 0
                const itemsWithInvalidAmount = items.filter((item) => {
                    const amount = Number(item.amount || 0)
                    return amount <= 0
                })

                if (itemsWithInvalidAmount.length > 0) {
                    toast.error("Jumlah (Amount) pada item biaya wajib diisi dan harus lebih dari 0.")
                    return
                }

                // Filter signatories (abaikan yang kosong total)
                const validSignatories = signatories
                    .filter((sig) => {
                        const hasName = sig.signatoryName && sig.signatoryName.trim() !== ""
                        const hasPosition = sig.signatoryPosition && sig.signatoryPosition.trim() !== ""
                        const hasRole = sig.signatoryRole && sig.signatoryRole.trim() !== ""
                        return hasName || hasPosition || hasRole
                    })
                    .map((item, index) => ({
                        signatoryName: item.signatoryName?.trim() || "",
                        signatoryPosition: item.signatoryPosition?.trim() || "",
                        signatoryRole: item.signatoryRole?.trim() || "",
                        sortOrder: index,
                    }))

                const payload = {
                    settlementType,
                    fleetTripId: settlementType === "trip" ? fleetTripId : null,
                    deliveryId: settlementType === "delivery" ? deliveryId : null,
                    settlementDate,
                    remarks: remarks?.trim() || null,
                    items: items.map((item, index) => ({
                        costCategory: item.costCategory,
                        description: item.description?.trim() || "",
                        amount: Number(item.amount),
                        vendorName: item.vendorName?.trim() || null,
                        receiptDate: item.receiptDate,
                        sortOrder: index,
                    })),
                    signatories: validSignatories,
                }

                const result = await createSettlement(payload)

                if (!result.success) {
                    toast.error(result.error || "Gagal membuat settlement")
                    return
                }

                const itemIdsBySortOrder = result.itemIdsBySortOrder || []
                let uploadedCount = 0
                for (let index = 0; index < items.length; index += 1) {
                    const settlementItemId = itemIdsBySortOrder[index]
                    const files = items[index]?.files || []

                    if (!settlementItemId || files.length === 0) {
                        continue
                    }

                    for (const file of files) {
                        const formData = new FormData()
                        formData.set("settlementItemId", String(settlementItemId))
                        formData.set("file", file)
                        const uploadResult = await uploadSettlementReceipt(formData)
                        if (uploadResult.success) {
                            uploadedCount += 1
                        }
                    }
                }

                toast.success("Settlement berhasil dibuat")
                if (uploadedCount > 0) {
                    toast.success(`${uploadedCount} file nota berhasil diupload`)
                }

                router.push(`/dashboard/cost-settlements/${result.id}`)
            } catch (error) {
                const message = error instanceof Error ? error.message : "Gagal menyimpan settlement."
                toast.error(message)
            }
        })
    }

    return (
        <div className="flex flex-col xl:flex-row gap-6 items-start pb-10">
            {/* LEFT COLUMN: Main Editing area */}
            <div className="w-full xl:w-2/3 space-y-6">

                {/* ITEMS SECTION */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-xl font-bold tracking-tight">Daftar Biaya</h2>
                            <p className="text-sm text-muted-foreground">Detail tiap nota dan pengeluaran.</p>
                        </div>
                        <Button type="button" size="sm" onClick={addItem} className="h-8 shadow-sm">
                            <Plus className="mr-2 size-4" /> Tambah Item
                        </Button>
                    </div>

                    <div className="space-y-4">
                        {items.map((item, index) => (
                            <Card key={index} className="overflow-hidden border-muted-foreground/20 shadow-sm relative group">
                                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        size="icon"
                                        className="h-8 w-8 shadow-sm"
                                        onClick={() => removeItem(index)}
                                        disabled={items.length === 1}
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                </div>
                                <CardHeader className="bg-muted/30 pb-3 pt-3 border-b">
                                    <div className="flex items-center gap-2">
                                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                                            {index + 1}
                                        </div>
                                        <CardTitle className="text-sm font-semibold">Item Pengeluaran</CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                    <div className="space-y-1.5 min-w-0">
                                        <Label className="text-xs">Kategori</Label>
                                        <select
                                            className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                            value={item.costCategory}
                                            onChange={(event) => setItems((prev) => prev.map((row, rowIdx) => rowIdx === index
                                                ? { ...row, costCategory: event.target.value as ItemDraft["costCategory"] }
                                                : row))}
                                        >
                                            {categoryOptions.map((option) => (
                                                <option key={option} value={option}>{categoryLabels[option]}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-1.5 sm:col-span-2">
                                        <Label className="text-xs">Deskripsi <span className="text-muted-foreground font-normal">(Opsional)</span></Label>
                                        <Input
                                            className="h-9"
                                            value={item.description}
                                            onChange={(event) => setItems((prev) => prev.map((row, rowIdx) => rowIdx === index
                                                ? { ...row, description: event.target.value }
                                                : row))}
                                            placeholder="Cth: Tol JKT-BKS"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label className="text-xs">
                                            Tanggal Nota <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            className="h-9"
                                            type="date"
                                            value={item.receiptDate}
                                            onChange={(event) => setItems((prev) => prev.map((row, rowIdx) => rowIdx === index
                                                ? { ...row, receiptDate: event.target.value }
                                                : row))}
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-primary font-semibold">
                                            Jumlah (Rp) <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            className="h-9 border-primary/50 focus-visible:ring-primary shadow-sm"
                                            type="number"
                                            min={0}
                                            value={item.amount || ""}
                                            onChange={(event) => setItems((prev) => prev.map((row, rowIdx) => rowIdx === index
                                                ? { ...row, amount: Number(event.target.value || 0) }
                                                : row))}
                                            placeholder="0"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Vendor/Toko <span className="text-muted-foreground font-normal">(Opsional)</span></Label>
                                        <Input
                                            className="h-9"
                                            value={item.vendorName}
                                            onChange={(event) => setItems((prev) => prev.map((row, rowIdx) => rowIdx === index
                                                ? { ...row, vendorName: event.target.value }
                                                : row))}
                                            placeholder="Nama toko"
                                        />
                                    </div>

                                    <div className="space-y-1.5 sm:col-span-2 lg:col-span-3 pt-2">
                                        <Label className="flex items-center gap-2 cursor-pointer w-fit text-xs hover:text-primary transition-colors border px-3 py-1.5 rounded-md shadow-sm bg-muted/20">
                                            <UploadCloud className="size-4" />
                                            <span>Upload Gambar Nota & PDF <span className="text-muted-foreground font-normal">(Opsional)</span></span>
                                            <Input
                                                className="hidden"
                                                type="file"
                                                accept="image/*,.pdf"
                                                multiple
                                                onChange={(event) => {
                                                    const files = Array.from(event.target.files || [])
                                                    setItems((prev) => prev.map((row, rowIdx) => rowIdx === index
                                                        ? { ...row, files }
                                                        : row))
                                                }}
                                            />
                                        </Label>
                                        {item.files.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {item.files.map((f, i) => (
                                                    <div key={i} className="text-[10px] bg-secondary px-2 py-1 rounded border overflow-hidden max-w-[150px] truncate">
                                                        {f.name}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>

                {/* SIGNATORIES SECTION */}
                <div className="pt-4 mt-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-lg font-bold tracking-tight">Penandatangan <span className="text-muted-foreground font-normal text-sm ml-2">(Opsional)</span></h2>
                            <p className="text-sm text-muted-foreground">Orang yang terlibat dalam pengesahan form.</p>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={addSignatory} className="h-8 shadow-sm">
                            <Plus className="mr-2 size-4" /> Tambah Orang
                        </Button>
                    </div>

                    {signatories.length === 0 ? (
                        <div className="text-center py-6 border rounded-md border-dashed bg-muted/20 text-muted-foreground text-sm">
                            Tidak ada penandatangan yang ditambahkan (Opsional).
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2">
                            {signatories.map((signatory, index) => (
                                <Card key={index} className="shadow-none border-dashed">
                                    <div className="p-3 border-b bg-muted/30 flex justify-between items-center group">
                                        <span className="text-xs font-medium">Penandatangan #{index + 1}</span>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-muted-foreground hover:text-destructive opacity-50 group-hover:opacity-100 transition-opacity"
                                            onClick={() => removeSignatory(index)}
                                        >
                                            <Trash2 className="size-3" />
                                        </Button>
                                    </div>
                                    <CardContent className="p-4 space-y-3">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs">Nama</Label>
                                            <Input
                                                className="h-8 text-sm"
                                                value={signatory.signatoryName}
                                                onChange={(event) => setSignatories((prev) => prev.map((row, rowIdx) => rowIdx === index
                                                    ? { ...row, signatoryName: event.target.value }
                                                    : row))}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1.5">
                                                <Label className="text-xs">Jabatan</Label>
                                                <Input
                                                    className="h-8 text-sm"
                                                    value={signatory.signatoryPosition}
                                                    onChange={(event) => setSignatories((prev) => prev.map((row, rowIdx) => rowIdx === index
                                                        ? { ...row, signatoryPosition: event.target.value }
                                                        : row))}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-xs">Peran</Label>
                                                <Input
                                                    className="h-8 text-sm"
                                                    value={signatory.signatoryRole}
                                                    onChange={(event) => setSignatories((prev) => prev.map((row, rowIdx) => rowIdx === index
                                                        ? { ...row, signatoryRole: event.target.value }
                                                        : row))}
                                                />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>

            </div>

            {/* RIGHT COLUMN: Settings & Action Sticky */}
            <div className="w-full xl:w-1/3 xl:sticky xl:top-6 space-y-6">

                <Card className="border-primary/20 shadow-md">
                    <CardHeader className="bg-primary/5 pb-4 border-b border-primary/10">
                        <CardTitle className="flex items-center gap-2 text-primary">
                            <FileText className="size-5" />
                            Informasi Settlement
                        </CardTitle>
                        <CardDescription>
                            Atur detail dasar laporan Anda.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        <div className="space-y-2">
                            <Label>Tanggal Settlement <span className="text-red-500">*</span></Label>
                            <Input type="date" value={settlementDate} onChange={(event) => setSettlementDate(event.target.value)} />
                        </div>

                        <Separator />

                        <div className="space-y-2">
                            <Label>Sumber Dana</Label>
                            <select
                                className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                                value={settlementType}
                                onChange={(event) => setSettlementType(event.target.value as "trip" | "delivery")}
                            >
                                <option value="trip">Per Fleet Trip</option>
                                <option value="delivery">Per Delivery</option>
                            </select>
                        </div>

                        {settlementType === "trip" ? (
                            <div className="space-y-2">
                                <Label className="text-xs">Referensi Trip <span className="text-muted-foreground font-normal">(Opsional)</span></Label>
                                <select
                                    className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                                    value={fleetTripId ?? ""}
                                    onChange={(event) => setFleetTripId(Number(event.target.value) || null)}
                                >
                                    <option value="">-- Tanpa Referensi (Mandiri) --</option>
                                    {fleetTrips.map((trip) => (
                                        <option key={trip.id} value={trip.id}>
                                            {trip.tripNumber} - {trip.driverLabel}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <Label className="text-xs">Referensi Delivery <span className="text-muted-foreground font-normal">(Opsional)</span></Label>
                                <select
                                    className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                                    value={deliveryId ?? ""}
                                    onChange={(event) => setDeliveryId(Number(event.target.value) || null)}
                                >
                                    <option value="">-- Tanpa Referensi (Mandiri) --</option>
                                    {deliveries.map((delivery) => (
                                        <option key={delivery.id} value={delivery.id}>
                                            {delivery.deliveryNumber ?? `Delivery ${delivery.id}`} - {delivery.customerName}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>Catatan Tambahan <span className="text-muted-foreground font-normal">(Opsional)</span></Label>
                            <Textarea
                                className="resize-none min-h-[80px] text-sm"
                                value={remarks}
                                onChange={(event) => setRemarks(event.target.value)}
                                placeholder="Gunakan jika perlu menjelaskan sesuatu..."
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-muted/10">
                    <CardHeader className="pb-3 border-b">
                        <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Ringkasan Total</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Uang Muka <span className="text-[10px] bg-primary/10 text-primary px-1 rounded ml-1">Sumber</span></span>
                            <span className="font-semibold font-mono tracking-tight">Rp {advanceAmount.toLocaleString("id-ID")}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Aktual Keluar</span>
                            <span className="font-semibold text-primary font-mono tracking-tight">Rp {totalActual.toLocaleString("id-ID")}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between items-center">
                            <span className="font-medium text-sm">Kekurangan / Kelebihan</span>
                            <span className={`text-lg font-bold font-mono tracking-tight ${varianceAmount >= 0 ? "text-amber-600" : "text-emerald-600"}`}>
                                Rp {varianceAmount.toLocaleString("id-ID")}
                            </span>
                        </div>
                    </CardContent>
                    <CardFooter className="flex-col gap-3 pb-6 pt-0">
                        <Alert className="py-2 px-3 bg-card border shadow-sm">
                            <AlertCircle className="h-4 w-4 text-primary" />
                            <AlertDescription className="text-xs ml-2 text-muted-foreground leading-tight">
                                Sistem hanya mewajibkan <strong>Jumlah</strong> & <strong>Tanggal Nota</strong> untuk diverifikasi akunting.
                            </AlertDescription>
                        </Alert>
                        <Button
                            type="button"
                            className="w-full text-base py-6 shadow-md shadow-primary/20 mt-1 font-semibold"
                            size="lg"
                            onClick={onSubmit}
                            disabled={isPending}
                        >
                            {isPending ? "Sedang Memproses..." : "Kirim Settlement"}
                        </Button>
                    </CardFooter>
                </Card>

            </div>
        </div>
    )
}
