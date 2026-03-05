"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { createSettlement, uploadSettlementReceipt } from "@/app/actions/cost-settlement"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

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
            receiptDate: "",
            files: [],
        },
    ])
    const [signatories, setSignatories] = useState<SignatoryDraft[]>([
        {
            signatoryName: "",
            signatoryPosition: "",
            signatoryRole: "Dibuat oleh",
        },
    ])

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
                receiptDate: "",
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
            if (settlementType === "trip" && !fleetTripId) {
                toast.error("Pilih Fleet Trip terlebih dahulu")
                return
            }

            if (settlementType === "delivery" && !deliveryId) {
                toast.error("Pilih Delivery terlebih dahulu")
                return
            }

            if (items.some((item) => !item.description.trim())) {
                toast.error("Deskripsi item biaya wajib diisi")
                return
            }

            if (signatories.some((signatory) => !signatory.signatoryName.trim() || !signatory.signatoryPosition.trim() || !signatory.signatoryRole.trim())) {
                toast.error("Semua field penandatangan wajib diisi")
                return
            }

            const payload = {
                settlementType,
                fleetTripId: settlementType === "trip" ? fleetTripId : null,
                deliveryId: settlementType === "delivery" ? deliveryId : null,
                settlementDate,
                remarks,
                items: items.map((item, index) => ({
                    costCategory: item.costCategory,
                    description: item.description,
                    amount: Number(item.amount || 0),
                    vendorName: item.vendorName || null,
                    receiptDate: item.receiptDate || null,
                    sortOrder: index,
                })),
                signatories: signatories.map((item, index) => ({
                    signatoryName: item.signatoryName,
                    signatoryPosition: item.signatoryPosition,
                    signatoryRole: item.signatoryRole,
                    sortOrder: index,
                })),
            }

            try {
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
                const message = error instanceof Error ? error.message : "Gagal membuat settlement"
                toast.error(message)
            }
        })
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Sumber Settlement</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label>Tipe</Label>
                        <select
                            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                            value={settlementType}
                            onChange={(event) => setSettlementType(event.target.value as "trip" | "delivery")}
                        >
                            <option value="trip">Per Fleet Trip</option>
                            <option value="delivery">Per Delivery</option>
                        </select>
                    </div>

                    {settlementType === "trip" ? (
                        <div className="space-y-2">
                            <Label>Fleet Trip</Label>
                            <select
                                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                                value={fleetTripId ?? ""}
                                onChange={(event) => setFleetTripId(Number(event.target.value) || null)}
                            >
                                <option value="">Pilih Fleet Trip</option>
                                {fleetTrips.map((trip) => (
                                    <option key={trip.id} value={trip.id}>
                                        {trip.tripNumber} - {trip.driverLabel}
                                    </option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <Label>Delivery</Label>
                            <select
                                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                                value={deliveryId ?? ""}
                                onChange={(event) => setDeliveryId(Number(event.target.value) || null)}
                            >
                                <option value="">Pilih Delivery</option>
                                {deliveries.map((delivery) => (
                                    <option key={delivery.id} value={delivery.id}>
                                        {delivery.deliveryNumber ?? `Delivery ${delivery.id}`} - {delivery.customerName}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label>Tanggal Settlement</Label>
                        <Input type="date" value={settlementDate} onChange={(event) => setSettlementDate(event.target.value)} />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                        <Label>Catatan</Label>
                        <Textarea
                            value={remarks}
                            onChange={(event) => setRemarks(event.target.value)}
                            placeholder="Catatan tambahan untuk settlement"
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Ringkasan Nominal</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">Uang Muka (Sumber)</p>
                        <p className="mt-1 text-base font-semibold">Rp {advanceAmount.toLocaleString("id-ID")}</p>
                    </div>
                    <div className="rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">Total Detail Aktual</p>
                        <p className="mt-1 text-base font-semibold">Rp {totalActual.toLocaleString("id-ID")}</p>
                    </div>
                    <div className="rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">Selisih</p>
                        <p className={`mt-1 text-base font-semibold ${varianceAmount >= 0 ? "text-amber-600" : "text-emerald-600"}`}>
                            Rp {varianceAmount.toLocaleString("id-ID")}
                        </p>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Item Biaya Aktual</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {items.map((item, index) => (
                        <div key={index} className="grid gap-3 rounded-md border p-3 md:grid-cols-5">
                            <div className="space-y-2">
                                <Label>Kategori</Label>
                                <select
                                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                                    value={item.costCategory}
                                    onChange={(event) => setItems((prev) => prev.map((row, rowIdx) => rowIdx === index
                                        ? { ...row, costCategory: event.target.value as ItemDraft["costCategory"] }
                                        : row))}
                                >
                                    {categoryOptions.map((option) => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2 md:col-span-2">
                                <Label>Deskripsi</Label>
                                <Input
                                    value={item.description}
                                    onChange={(event) => setItems((prev) => prev.map((row, rowIdx) => rowIdx === index
                                        ? { ...row, description: event.target.value }
                                        : row))}
                                    placeholder="Contoh: Tol Cikampek-Jakarta"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Jumlah</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    value={item.amount}
                                    onChange={(event) => setItems((prev) => prev.map((row, rowIdx) => rowIdx === index
                                        ? { ...row, amount: Number(event.target.value || 0) }
                                        : row))}
                                />
                            </div>

                            <div className="flex items-end justify-end">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => removeItem(index)}
                                    disabled={items.length === 1}
                                >
                                    <Trash2 className="mr-2 size-4" /> Hapus
                                </Button>
                            </div>

                            <div className="space-y-2 md:col-span-2">
                                <Label>Vendor</Label>
                                <Input
                                    value={item.vendorName}
                                    onChange={(event) => setItems((prev) => prev.map((row, rowIdx) => rowIdx === index
                                        ? { ...row, vendorName: event.target.value }
                                        : row))}
                                    placeholder="Nama vendor / toko"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Tanggal Nota</Label>
                                <Input
                                    type="date"
                                    value={item.receiptDate}
                                    onChange={(event) => setItems((prev) => prev.map((row, rowIdx) => rowIdx === index
                                        ? { ...row, receiptDate: event.target.value }
                                        : row))}
                                />
                            </div>

                            <div className="space-y-2 md:col-span-2">
                                <Label>Upload Nota</Label>
                                <Input
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
                                <p className="text-xs text-muted-foreground">
                                    {item.files.length > 0 ? `${item.files.length} file dipilih` : "Belum ada file dipilih"}
                                </p>
                            </div>
                        </div>
                    ))}

                    <div className="flex items-center justify-between gap-3">
                        <Button type="button" variant="outline" onClick={addItem}>
                            <Plus className="mr-2 size-4" /> Tambah Item
                        </Button>
                        <p className="text-sm text-muted-foreground">Total Aktual: <span className="font-semibold">Rp {totalActual.toLocaleString("id-ID")}</span></p>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Penandatangan</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {signatories.map((signatory, index) => (
                        <div key={index} className="grid gap-3 rounded-md border p-3 md:grid-cols-4">
                            <div className="space-y-2">
                                <Label>Nama</Label>
                                <Input
                                    value={signatory.signatoryName}
                                    onChange={(event) => setSignatories((prev) => prev.map((row, rowIdx) => rowIdx === index
                                        ? { ...row, signatoryName: event.target.value }
                                        : row))}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Jabatan</Label>
                                <Input
                                    value={signatory.signatoryPosition}
                                    onChange={(event) => setSignatories((prev) => prev.map((row, rowIdx) => rowIdx === index
                                        ? { ...row, signatoryPosition: event.target.value }
                                        : row))}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Peran</Label>
                                <Input
                                    value={signatory.signatoryRole}
                                    onChange={(event) => setSignatories((prev) => prev.map((row, rowIdx) => rowIdx === index
                                        ? { ...row, signatoryRole: event.target.value }
                                        : row))}
                                />
                            </div>

                            <div className="flex items-end justify-end">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => removeSignatory(index)}
                                    disabled={signatories.length === 1}
                                >
                                    <Trash2 className="mr-2 size-4" /> Hapus
                                </Button>
                            </div>
                        </div>
                    ))}

                    <Button type="button" variant="outline" onClick={addSignatory}>
                        <Plus className="mr-2 size-4" /> Tambah Penandatangan
                    </Button>
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button type="button" onClick={onSubmit} disabled={isPending}>
                    {isPending ? "Menyimpan..." : "Simpan Settlement"}
                </Button>
            </div>
        </div>
    )
}
