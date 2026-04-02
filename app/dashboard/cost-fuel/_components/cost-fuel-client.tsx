"use client"

import type { Dispatch, SetStateAction } from "react"
import { useEffect, useMemo, useState } from "react"
import { Check, ChevronsUpDown, FileText, Fuel, Printer } from "lucide-react"

import type { CostFuelMasterData } from "@/app/actions/cost-fuel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type TabKey = "delivery" | "operasional"

type CostFuelFormState = {
    requestDate: string
    fuelType: string
    driverName: string
    vehicleNumber: string
    kmIsi: string
    requestLiter: string
    indicatorBefore: string
    indicatorAfter: string
    notes: string
    handoverBy: string
    approvedBy: string
    selectedDeliveryIds: number[]
}

type CostFuelHistoryItem = {
    id: string
    tab: TabKey
    createdAt: string
    requestDate: string
    fuelType: string
    driverName: string
    vehicleNumber: string
    requestLiter: string
    indicatorBefore: string
    indicatorAfter: string
    differenceKm: number
    notes: string
    handoverBy: string
    approvedBy: string
    selectedDeliveryNumbers: string[]
}

type Props = {
    masterData: CostFuelMasterData
}

const HISTORY_STORAGE_KEY = "cost-fuel-history-v1"

const todayValue = () => new Date().toISOString().slice(0, 10)

const createInitialFormState = (): CostFuelFormState => ({
    requestDate: todayValue(),
    fuelType: "Solar",
    driverName: "",
    vehicleNumber: "",
    kmIsi: "",
    requestLiter: "",
    indicatorBefore: "",
    indicatorAfter: "",
    notes: "",
    handoverBy: "",
    approvedBy: "",
    selectedDeliveryIds: [],
})

const formatDate = (value?: string | null) => {
    if (!value) return "-"
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "-"
    return date.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
    })
}

const toNumber = (value: string) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
}

const escapeHtml = (value: string) =>
    value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;")

const buildPrintHtml = (params: {
    tab: TabKey
    form: CostFuelFormState
    selectedDeliveries: CostFuelMasterData["deliveries"]
    differenceKm: number
}) => {
    const { tab, form, selectedDeliveries, differenceKm } = params
    const docNo = `CF-${tab === "delivery" ? "DLV" : "OPS"}-${form.requestDate.replaceAll("-", "")}`
    const deliveryChecklist = selectedDeliveries.length
        ? selectedDeliveries.map((item) => `
            <div class="check-row">
                <span class="box checked">✓</span>
                <span>${escapeHtml(item.deliveryNumber)} - ${escapeHtml(item.customerName)}</span>
            </div>
        `).join("")
        : '<div class="check-row"><span class="box"></span><span>Tidak ada delivery dipilih</span></div>'

    return `
        <!DOCTYPE html>
        <html lang="id">
        <head>
            <meta charset="UTF-8" />
            <title>Cost Fuel ${docNo}</title>
            <style>
                @page { size: A4 portrait; margin: 14mm; }
                * { box-sizing: border-box; }
                body {
                    margin: 0;
                    font-family: Arial, sans-serif;
                    color: #111827;
                    background: #ffffff;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                .sheet {
                    width: 100%;
                    max-width: 210mm;
                    margin: 0 auto;
                    border: 1px solid #111827;
                }
                .header {
                    border-bottom: 1px solid #111827;
                    padding: 16px 18px;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 12px;
                }
                .header-left {
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                }
                .logo {
                    width: 52px;
                    height: 52px;
                    object-fit: contain;
                    flex-shrink: 0;
                }
                .title {
                    font-size: 18px;
                    font-weight: 700;
                    margin: 0 0 4px;
                }
                .subtitle {
                    font-size: 12px;
                    margin: 0;
                    color: #4b5563;
                }
                .doc-meta {
                    text-align: right;
                    font-size: 12px;
                    line-height: 1.6;
                }
                .section {
                    padding: 16px 18px;
                    border-bottom: 1px solid #111827;
                }
                .section-title {
                    font-size: 12px;
                    font-weight: 700;
                    margin: 0 0 10px;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                }
                .grid {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 10px 18px;
                }
                .field {
                    display: grid;
                    grid-template-columns: 160px 12px 1fr;
                    font-size: 13px;
                    line-height: 1.6;
                }
                .field.full {
                    grid-column: 1 / -1;
                }
                .value {
                    font-weight: 700;
                    min-height: 20px;
                    border-bottom: 1px dotted #9ca3af;
                }
                .checklist {
                    display: grid;
                    gap: 8px;
                    font-size: 13px;
                }
                .check-row {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .box {
                    width: 16px;
                    height: 16px;
                    border: 1px solid #111827;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 11px;
                    font-weight: 700;
                }
                .checked {
                    background: #111827;
                    color: white;
                }
                .notes {
                    min-height: 84px;
                    padding: 10px;
                    border: 1px solid #111827;
                    white-space: pre-wrap;
                    font-size: 13px;
                    line-height: 1.5;
                }
                .signatures {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 18px;
                    padding: 20px 18px 24px;
                }
                .sig-box {
                    text-align: center;
                    min-height: 120px;
                    display: flex;
                    flex-direction: column;
                    justify-content: flex-end;
                    font-size: 13px;
                }
                .sig-role {
                    margin-bottom: 70px;
                    font-weight: 700;
                }
                .sig-name {
                    border-top: 1px solid #111827;
                    padding-top: 8px;
                    font-weight: 700;
                }
            </style>
        </head>
        <body>
            <div class="sheet">
                <div class="header">
                    <div class="header-left">
                        <img src="/brand/Chitra-Paratama.png" alt="Chitra Paratama" class="logo" />
                        <div>
                            <h1 class="title">FORM COST FUEL</h1>
                            <p class="subtitle">${tab === "delivery" ? "Fuel Delivery Anda" : "Fuel Operasional"}</p>
                        </div>
                    </div>
                    <div class="doc-meta">
                        <div><strong>No Dokumen:</strong> ${escapeHtml(docNo)}</div>
                        <div><strong>Tanggal:</strong> ${escapeHtml(formatDate(form.requestDate))}</div>
                    </div>
                </div>

                <div class="section">
                    <h2 class="section-title">Informasi Penggunaan Bahan Bakar</h2>
                    <div class="grid">
                        <div class="field"><span>Nama Driver</span><span>:</span><span class="value">${escapeHtml(form.driverName || "-")}</span></div>
                        <div class="field"><span>Vehicle</span><span>:</span><span class="value">${escapeHtml(form.vehicleNumber || "-")}</span></div>
                        <div class="field"><span>Jenis Bahan Bakar</span><span>:</span><span class="value">${escapeHtml(form.fuelType || "Solar")}</span></div>
                        <div class="field"><span>KM Isi</span><span>:</span><span class="value">${escapeHtml(form.kmIsi || "-")}</span></div>
                        <div class="field"><span>Jumlah Permintaan</span><span>:</span><span class="value">${escapeHtml(form.requestLiter || "-")} Liter</span></div>
                        <div class="field"><span>Pembacaan Sebelum Isi</span><span>:</span><span class="value">${escapeHtml(form.indicatorBefore || "-")} KM</span></div>
                        <div class="field"><span>Pembacaan Sesudah Isi</span><span>:</span><span class="value">${escapeHtml(form.indicatorAfter || "-")} KM</span></div>
                        <div class="field"><span>Selisih Indicator</span><span>:</span><span class="value">${differenceKm.toLocaleString("id-ID")} KM</span></div>
                        <div class="field full"><span>Keterangan</span><span>:</span><span class="value">${escapeHtml(form.notes || "-")}</span></div>
                    </div>
                </div>

                <div class="section">
                    <h2 class="section-title">Checklist Nomor Delivery</h2>
                    <div class="checklist">
                        ${deliveryChecklist}
                    </div>
                </div>

                <div class="section">
                    <h2 class="section-title">Catatan</h2>
                    <div class="notes">${escapeHtml(form.notes || "-")}</div>
                </div>

                <div class="signatures">
                    <div class="sig-box">
                        <div class="sig-role">User</div>
                        <div class="sig-name">${escapeHtml(form.driverName || "-")}</div>
                    </div>
                    <div class="sig-box">
                        <div class="sig-role">Diserahkan Oleh</div>
                        <div class="sig-name">${escapeHtml(form.handoverBy || "-")}</div>
                    </div>
                    <div class="sig-box">
                        <div class="sig-role">Approval Oleh</div>
                        <div class="sig-name">${escapeHtml(form.approvedBy || "-")}</div>
                    </div>
                </div>
            </div>
            <script>
                window.onload = () => {
                    window.print();
                    window.onafterprint = () => window.close();
                };
            </script>
        </body>
        </html>
    `
}

function CostFuelForm({
    tab,
    form,
    onChange,
    onSaveHistory,
    deliveryOptions,
    driverOptions,
    vehicleOptions,
}: {
    tab: TabKey
    form: CostFuelFormState
    onChange: Dispatch<SetStateAction<CostFuelFormState>>
    onSaveHistory: (tab: TabKey, form: CostFuelFormState) => void
    deliveryOptions: CostFuelMasterData["deliveries"]
    driverOptions: string[]
    vehicleOptions: string[]
}) {
    const selectedDeliveries = useMemo(
        () => deliveryOptions.filter((item) => form.selectedDeliveryIds.includes(item.id)),
        [deliveryOptions, form.selectedDeliveryIds],
    )
    const [deliveryPickerOpen, setDeliveryPickerOpen] = useState(false)

    const differenceKm = Math.max(0, toNumber(form.indicatorAfter) - toNumber(form.indicatorBefore))
    const totalLiter = toNumber(form.requestLiter)

    useEffect(() => {
        if (tab !== "delivery") {
            return
        }

        if (selectedDeliveries.length === 0) {
            onChange((prev) => ({
                ...prev,
                driverName: "",
                vehicleNumber: "",
            }))
            return
        }

        const primary = selectedDeliveries[0]
        onChange((prev) => ({
            ...prev,
            driverName: primary.driverName,
            vehicleNumber: primary.vehicleNumber,
        }))
    }, [onChange, selectedDeliveries, tab])

    const handleFieldChange = (field: keyof CostFuelFormState, value: string) => {
        onChange((prev) => ({
            ...prev,
            [field]: value,
        }))
    }

    const handleDeliveryToggle = (deliveryId: number, checked: boolean) => {
        onChange((prev) => ({
            ...prev,
            selectedDeliveryIds: checked
                ? [...prev.selectedDeliveryIds, deliveryId]
                : prev.selectedDeliveryIds.filter((id) => id !== deliveryId),
        }))
    }

    const handlePrint = () => {
        onSaveHistory(tab, form)

        const printWindow = window.open("", "_blank")
        if (!printWindow) {
            return
        }

        printWindow.document.write(buildPrintHtml({
            tab,
            form,
            selectedDeliveries,
            differenceKm,
        }))
        printWindow.document.close()
    }

    return (
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <Card className="border-border/60 shadow-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Fuel className="h-4 w-4 text-primary" />
                        Form Penggunaan Bahan Bakar
                    </CardTitle>
                    <CardDescription>
                        {tab === "delivery"
                            ? "Pilih delivery yang terkait, lalu data driver dan kendaraan akan mengikuti data delivery."
                            : "Isi data operasional untuk kendaraan yang tidak sedang direferensikan ke delivery tertentu."}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor={`${tab}-date`}>Tanggal</Label>
                            <Input
                                id={`${tab}-date`}
                                type="date"
                                value={form.requestDate}
                                onChange={(event) => handleFieldChange("requestDate", event.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={`${tab}-fuel`}>Jenis Bahan Bakar</Label>
                            <Input
                                id={`${tab}-fuel`}
                                value={form.fuelType}
                                onChange={(event) => handleFieldChange("fuelType", event.target.value)}
                            />
                        </div>
                    </div>

                    {tab === "delivery" && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between gap-3">
                                <Label className="text-sm font-semibold">Nomor Delivery</Label>
                                <Badge variant="secondary">{selectedDeliveries.length} dipilih</Badge>
                            </div>
                            <Popover open={deliveryPickerOpen} onOpenChange={setDeliveryPickerOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={deliveryPickerOpen}
                                        className="h-11 w-full justify-between px-3 font-normal"
                                    >
                                        <span className="truncate text-left">
                                            {selectedDeliveries.length > 0
                                                ? selectedDeliveries.map((item) => item.deliveryNumber).join(", ")
                                                : "Cari dan pilih nomor delivery"}
                                        </span>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder="Cari delivery, customer, driver, vehicle..." />
                                        <CommandList>
                                            <CommandEmpty>Tidak ada delivery yang cocok.</CommandEmpty>
                                            <CommandGroup>
                                                {deliveryOptions.map((delivery) => {
                                                    const checked = form.selectedDeliveryIds.includes(delivery.id)
                                                    return (
                                                        <CommandItem
                                                            key={delivery.id}
                                                            value={`${delivery.deliveryNumber} ${delivery.customerName} ${delivery.driverName} ${delivery.vehicleNumber} ${delivery.destination}`}
                                                            onSelect={() => handleDeliveryToggle(delivery.id, !checked)}
                                                            className="items-start gap-3 py-3"
                                                        >
                                                            <div
                                                                className={cn(
                                                                    "mt-0.5 flex h-4 w-4 items-center justify-center rounded-sm border",
                                                                    checked ? "border-primary bg-primary text-primary-foreground" : "border-input",
                                                                )}
                                                            >
                                                                <Check className={cn("h-3 w-3", checked ? "opacity-100" : "opacity-0")} />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="font-medium">{delivery.deliveryNumber}</div>
                                                                <div className="text-xs text-muted-foreground">{delivery.customerName}</div>
                                                                <div className="text-xs text-muted-foreground">
                                                                    {delivery.driverName} • {delivery.vehicleNumber}
                                                                </div>
                                                            </div>
                                                        </CommandItem>
                                                    )
                                                })}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>

                            {selectedDeliveries.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {selectedDeliveries.map((delivery) => (
                                        <Badge key={delivery.id} variant="outline" className="gap-2 rounded-full px-3 py-1">
                                            <span>{delivery.deliveryNumber}</span>
                                            <button
                                                type="button"
                                                onClick={() => handleDeliveryToggle(delivery.id, false)}
                                                className="text-muted-foreground transition hover:text-foreground"
                                                aria-label={`Hapus ${delivery.deliveryNumber}`}
                                            >
                                                ×
                                            </button>
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Nama Driver</Label>
                            {tab === "delivery" ? (
                                <Input value={form.driverName} readOnly placeholder="Mengikuti delivery yang dipilih" />
                            ) : (
                                <Select value={form.driverName || undefined} onValueChange={(value) => handleFieldChange("driverName", value)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Pilih driver" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {driverOptions.map((driver) => (
                                            <SelectItem key={driver} value={driver}>
                                                {driver}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label>Vehicle</Label>
                            {tab === "delivery" ? (
                                <Input value={form.vehicleNumber} readOnly placeholder="Mengikuti delivery yang dipilih" />
                            ) : (
                                <Select value={form.vehicleNumber || undefined} onValueChange={(value) => handleFieldChange("vehicleNumber", value)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Pilih vehicle" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {vehicleOptions.map((vehicle) => (
                                            <SelectItem key={vehicle} value={vehicle}>
                                                {vehicle}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={`${tab}-km-isi`}>KM Isi</Label>
                            <Input
                                id={`${tab}-km-isi`}
                                type="number"
                                min="0"
                                value={form.kmIsi}
                                onChange={(event) => handleFieldChange("kmIsi", event.target.value)}
                                placeholder="Contoh: 125000"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={`${tab}-liter`}>Jumlah Permintaan</Label>
                            <Input
                                id={`${tab}-liter`}
                                type="number"
                                min="0"
                                step="0.01"
                                value={form.requestLiter}
                                onChange={(event) => handleFieldChange("requestLiter", event.target.value)}
                                placeholder="Liter"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={`${tab}-before`}>Pembacaan Indicator Sebelum Pengisian</Label>
                            <Input
                                id={`${tab}-before`}
                                type="number"
                                min="0"
                                value={form.indicatorBefore}
                                onChange={(event) => handleFieldChange("indicatorBefore", event.target.value)}
                                placeholder="KM sebelum"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={`${tab}-after`}>Pembacaan Indicator Sesudah Pengisian</Label>
                            <Input
                                id={`${tab}-after`}
                                type="number"
                                min="0"
                                value={form.indicatorAfter}
                                onChange={(event) => handleFieldChange("indicatorAfter", event.target.value)}
                                placeholder="KM sesudah"
                            />
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor={`${tab}-handover`}>Diserahkan Oleh</Label>
                            <Input
                                id={`${tab}-handover`}
                                value={form.handoverBy}
                                onChange={(event) => handleFieldChange("handoverBy", event.target.value)}
                                placeholder="Nama penyerah"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={`${tab}-approval`}>Approval Oleh</Label>
                            <Input
                                id={`${tab}-approval`}
                                value={form.approvedBy}
                                onChange={(event) => handleFieldChange("approvedBy", event.target.value)}
                                placeholder="Nama approver"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor={`${tab}-notes`}>Keterangan</Label>
                        <Textarea
                            id={`${tab}-notes`}
                            value={form.notes}
                            onChange={(event) => handleFieldChange("notes", event.target.value)}
                            placeholder="Tambahkan catatan penggunaan bahan bakar atau detail operasional."
                            className="min-h-28"
                        />
                    </div>
                </CardContent>
            </Card>

            <div className="space-y-6">
                <Card className="border-border/60 shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <FileText className="h-4 w-4 text-primary" />
                            Ringkasan Dokumen
                        </CardTitle>
                        <CardDescription>Preview singkat sebelum dicetak.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="rounded-xl border bg-muted/20 p-4">
                            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Mode</div>
                            <div className="mt-1 text-lg font-semibold">
                                {tab === "delivery" ? "Fuel Delivery Anda" : "Fuel Operasional"}
                            </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                            <div className="rounded-xl border p-4">
                                <div className="text-xs text-muted-foreground">Nama Driver</div>
                                <div className="mt-1 font-semibold">{form.driverName || "-"}</div>
                            </div>
                            <div className="rounded-xl border p-4">
                                <div className="text-xs text-muted-foreground">Vehicle</div>
                                <div className="mt-1 font-semibold">{form.vehicleNumber || "-"}</div>
                            </div>
                            <div className="rounded-xl border p-4">
                                <div className="text-xs text-muted-foreground">Jumlah Permintaan</div>
                                <div className="mt-1 font-semibold">{totalLiter.toLocaleString("id-ID")} Liter</div>
                            </div>
                            <div className="rounded-xl border p-4">
                                <div className="text-xs text-muted-foreground">Selisih Indicator</div>
                                <div className="mt-1 font-semibold">{differenceKm.toLocaleString("id-ID")} KM</div>
                            </div>
                        </div>

                        <div className="rounded-xl border p-4">
                            <div className="mb-2 text-xs text-muted-foreground">Checklist Delivery</div>
                            <div className="flex flex-wrap gap-2">
                                {tab === "operasional" ? (
                                    <span className="text-sm text-muted-foreground">Tab operasional tidak memakai referensi delivery.</span>
                                ) : selectedDeliveries.length > 0 ? selectedDeliveries.map((delivery) => (
                                    <Badge key={delivery.id} variant="secondary">
                                        {delivery.deliveryNumber}
                                    </Badge>
                                )) : <span className="text-sm text-muted-foreground">Belum ada delivery dipilih.</span>}
                            </div>
                        </div>

                        <div className="rounded-xl border p-4">
                            <div className="mb-2 text-xs text-muted-foreground">Tanda Tangan PDF</div>
                            <div className="space-y-1 text-sm">
                                <div><strong>User:</strong> {form.driverName || "-"}</div>
                                <div><strong>Diserahkan Oleh:</strong> {form.handoverBy || "-"}</div>
                                <div><strong>Approval Oleh:</strong> {form.approvedBy || "-"}</div>
                            </div>
                        </div>

                        <Button onClick={handlePrint} className="w-full gap-2">
                            <Printer className="h-4 w-4" />
                            Cetak Dokumen
                        </Button>
                    </CardContent>
                </Card>

                <Card className="border-dashed border-primary/40 bg-primary/5 shadow-sm">
                    <CardContent className="p-4 text-sm text-muted-foreground">
                        Dokumen cetak sudah memuat: nama driver, vehicle, jenis bahan bakar, KM isi, jumlah liter, checklist nomor delivery, pembacaan indicator sebelum dan sesudah pengisian, selisih KM, serta area tanda tangan.
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

export function CostFuelClient({ masterData }: Props) {
    const [activeTab, setActiveTab] = useState<TabKey>("delivery")
    const [deliveryForm, setDeliveryForm] = useState<CostFuelFormState>(createInitialFormState)
    const [operationalForm, setOperationalForm] = useState<CostFuelFormState>(createInitialFormState)
    const [historyItems, setHistoryItems] = useState<CostFuelHistoryItem[]>([])

    useEffect(() => {
        if (typeof window === "undefined") {
            return
        }

        try {
            const rawValue = window.localStorage.getItem(HISTORY_STORAGE_KEY)
            if (!rawValue) {
                return
            }

            const parsed = JSON.parse(rawValue) as CostFuelHistoryItem[]
            if (Array.isArray(parsed)) {
                setHistoryItems(parsed)
            }
        } catch {
            window.localStorage.removeItem(HISTORY_STORAGE_KEY)
        }
    }, [])

    const persistHistory = (updater: (current: CostFuelHistoryItem[]) => CostFuelHistoryItem[]) => {
        setHistoryItems((current) => {
            const next = updater(current)
            if (typeof window !== "undefined") {
                window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next))
            }
            return next
        })
    }

    const handleSaveToHistory = (tab: TabKey, form: CostFuelFormState) => {
        const selectedDeliveries = masterData.deliveries.filter((item) => form.selectedDeliveryIds.includes(item.id))
        const historyEntry: CostFuelHistoryItem = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            tab,
            createdAt: new Date().toISOString(),
            requestDate: form.requestDate,
            fuelType: form.fuelType,
            driverName: form.driverName,
            vehicleNumber: form.vehicleNumber,
            requestLiter: form.requestLiter,
            indicatorBefore: form.indicatorBefore,
            indicatorAfter: form.indicatorAfter,
            differenceKm: Math.max(0, toNumber(form.indicatorAfter) - toNumber(form.indicatorBefore)),
            notes: form.notes,
            handoverBy: form.handoverBy,
            approvedBy: form.approvedBy,
            selectedDeliveryNumbers: selectedDeliveries.map((item) => item.deliveryNumber),
        }

        persistHistory((current) => [historyEntry, ...current].slice(0, 30))
    }

    const handleLoadHistory = (item: CostFuelHistoryItem) => {
        const matchingDeliveryIds = masterData.deliveries
            .filter((delivery) => item.selectedDeliveryNumbers.includes(delivery.deliveryNumber))
            .map((delivery) => delivery.id)

        const nextForm: CostFuelFormState = {
            requestDate: item.requestDate,
            fuelType: item.fuelType,
            driverName: item.driverName,
            vehicleNumber: item.vehicleNumber,
            kmIsi: "",
            requestLiter: item.requestLiter,
            indicatorBefore: item.indicatorBefore,
            indicatorAfter: item.indicatorAfter,
            notes: item.notes,
            handoverBy: item.handoverBy,
            approvedBy: item.approvedBy,
            selectedDeliveryIds: item.tab === "delivery" ? matchingDeliveryIds : [],
        }

        if (item.tab === "delivery") {
            setDeliveryForm(nextForm)
            setActiveTab("delivery")
            return
        }

        setOperationalForm(nextForm)
        setActiveTab("operasional")
    }

    const handleDeleteHistory = (id: string) => {
        persistHistory((current) => current.filter((item) => item.id !== id))
    }

    return (
        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
            <div className="min-w-0">
                <div className="space-y-6">
                    <div className="inline-flex rounded-xl border bg-muted/40 p-1">
                        <button
                            type="button"
                            onClick={() => setActiveTab("delivery")}
                            className={cn(
                                "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                                activeTab === "delivery"
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground",
                            )}
                        >
                            Fuel Delivery Anda
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("operasional")}
                            className={cn(
                                "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                                activeTab === "operasional"
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground",
                            )}
                        >
                            Operasional
                        </button>
                    </div>

                    {activeTab === "delivery" && (
                        <>
                            <CostFuelForm
                                tab="delivery"
                                form={deliveryForm}
                                onChange={setDeliveryForm}
                                onSaveHistory={handleSaveToHistory}
                                deliveryOptions={masterData.deliveries}
                                driverOptions={masterData.drivers}
                                vehicleOptions={masterData.vehicles}
                            />
                            <div className="mt-4 flex justify-end">
                                <Button variant="outline" onClick={() => handleSaveToHistory("delivery", deliveryForm)}>
                                    Simpan ke History
                                </Button>
                            </div>
                        </>
                    )}

                    {activeTab === "operasional" && (
                        <>
                            <CostFuelForm
                                tab="operasional"
                                form={operationalForm}
                                onChange={setOperationalForm}
                                onSaveHistory={handleSaveToHistory}
                                deliveryOptions={masterData.deliveries}
                                driverOptions={masterData.drivers}
                                vehicleOptions={masterData.vehicles}
                            />
                            <div className="mt-4 flex justify-end">
                                <Button variant="outline" onClick={() => handleSaveToHistory("operasional", operationalForm)}>
                                    Simpan ke History
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <Card className="h-fit border-border/60 shadow-sm">
                <CardHeader>
                    <CardTitle className="text-base">History Cost Fuel</CardTitle>
                    <CardDescription>Riwayat form yang pernah disimpan atau dicetak di browser ini.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {historyItems.length === 0 ? (
                        <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                            Belum ada history.
                        </div>
                    ) : (
                        historyItems.map((item) => (
                            <div key={item.id} className="rounded-xl border p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="font-medium">{item.driverName || "-"}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {item.tab === "delivery" ? "Fuel Delivery Anda" : "Operasional"} • {formatDate(item.requestDate)}
                                        </div>
                                    </div>
                                    <Badge variant="secondary">{item.requestLiter || "0"} L</Badge>
                                </div>
                                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                                    <div>Vehicle: {item.vehicleNumber || "-"}</div>
                                    <div>Selisih KM: {item.differenceKm.toLocaleString("id-ID")} KM</div>
                                    <div>
                                        Delivery: {item.selectedDeliveryNumbers.length > 0 ? item.selectedDeliveryNumbers.join(", ") : "-"}
                                    </div>
                                </div>
                                <div className="mt-3 flex gap-2">
                                    <Button size="sm" variant="outline" onClick={() => handleLoadHistory(item)}>
                                        Pakai Lagi
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => handleDeleteHistory(item.id)}>
                                        Hapus
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
