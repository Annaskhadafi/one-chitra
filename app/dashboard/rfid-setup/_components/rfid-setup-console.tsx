"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Save, Trash2, Warehouse } from "lucide-react"
import { toast } from "sonner"

import {
    deleteWarehouseTrackingPolicy,
    saveWarehouseRfidSetting,
    saveWarehouseTrackingPolicy,
    type getRfidSetupData,
} from "@/app/actions/rfid"
import { TrackingModeBadge } from "@/components/rfid/tracking-mode-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
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

type SetupData = Awaited<ReturnType<typeof getRfidSetupData>>
type TrackingMode = "manual_only" | "optional_rfid" | "required_rfid"
type ScopeType = "category" | "product"

type Props = {
    data: SetupData
}

export function RfidSetupConsole({ data }: Props) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(data.warehouses[0]?.id ?? null)
    const [scopeType, setScopeType] = useState<ScopeType>("category")
    const [productId, setProductId] = useState("")
    const [category, setCategory] = useState(data.categories[0] ?? "")
    const [trackingMode, setTrackingMode] = useState<TrackingMode>("optional_rfid")
    const [allowManualFallback, setAllowManualFallback] = useState(true)
    const [serialRequired, setSerialRequired] = useState(false)
    const [isActive, setIsActive] = useState(true)
    const [policyNotes, setPolicyNotes] = useState("")

    const selectedSetting = useMemo(
        () => data.settings.find((entry) => entry.warehouseId === selectedWarehouseId),
        [data.settings, selectedWarehouseId],
    )

    const selectedPolicies = useMemo(
        () => data.policies.filter((entry) => entry.warehouseId === selectedWarehouseId),
        [data.policies, selectedWarehouseId],
    )

    const [rfidEnabled, setRfidEnabled] = useState(selectedSetting?.isEnabled ?? false)
    const [defaultTrackingMode, setDefaultTrackingMode] = useState<TrackingMode>((selectedSetting?.defaultTrackingMode ?? "manual_only") as TrackingMode)
    const [inboundValidation, setInboundValidation] = useState(selectedSetting?.requireInboundValidation ?? false)
    const [outboundValidation, setOutboundValidation] = useState(selectedSetting?.requireOutboundValidation ?? false)
    const [warehouseAllowManualFallback, setWarehouseAllowManualFallback] = useState(selectedSetting?.allowManualFallback ?? true)
    const [pilotNotes, setPilotNotes] = useState(selectedSetting?.pilotNotes ?? "")

    useEffect(() => {
        setRfidEnabled(selectedSetting?.isEnabled ?? false)
        setDefaultTrackingMode((selectedSetting?.defaultTrackingMode ?? "manual_only") as TrackingMode)
        setInboundValidation(selectedSetting?.requireInboundValidation ?? false)
        setOutboundValidation(selectedSetting?.requireOutboundValidation ?? false)
        setWarehouseAllowManualFallback(selectedSetting?.allowManualFallback ?? true)
        setPilotNotes(selectedSetting?.pilotNotes ?? "")
    }, [selectedSetting])

    const saveWarehouse = () => {
        if (!selectedWarehouseId) {
            toast.error("Pilih warehouse dulu")
            return
        }

        startTransition(async () => {
            try {
                const result = await saveWarehouseRfidSetting({
                    warehouseId: selectedWarehouseId,
                    isEnabled: rfidEnabled,
                    defaultTrackingMode,
                    allowManualFallback: warehouseAllowManualFallback,
                    requireInboundValidation: inboundValidation,
                    requireOutboundValidation: outboundValidation,
                    pilotNotes,
                })

                if (!result.success) {
                    toast.error("Gagal menyimpan setting warehouse")
                    return
                }

                toast.success("Setting warehouse RFID tersimpan")
                router.refresh()
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Gagal menyimpan setting warehouse")
            }
        })
    }

    const savePolicy = () => {
        if (!selectedWarehouseId) {
            toast.error("Pilih warehouse dulu")
            return
        }

        if (scopeType === "category" && !category) {
            toast.error("Pilih category")
            return
        }

        if (scopeType === "product" && !productId) {
            toast.error("Pilih product")
            return
        }

        startTransition(async () => {
            try {
                const result = await saveWarehouseTrackingPolicy({
                    warehouseId: selectedWarehouseId,
                    scopeType,
                    productId: scopeType === "product" ? Number(productId) : undefined,
                    category: scopeType === "category" ? category : undefined,
                    trackingMode,
                    allowManualFallback,
                    serialRequired,
                    isActive,
                    notes: policyNotes,
                })

                if (!result.success) {
                    toast.error("Gagal menyimpan policy")
                    return
                }

                toast.success("Policy RFID tersimpan")
                setProductId("")
                setPolicyNotes("")
                router.refresh()
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Gagal menyimpan policy")
            }
        })
    }

    const removePolicy = (id: number) => {
        startTransition(async () => {
            try {
                const result = await deleteWarehouseTrackingPolicy(id)
                if (!result.success) {
                    toast.error(result.error || "Gagal menghapus policy")
                    return
                }
                toast.success("Policy dihapus")
                router.refresh()
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Gagal menghapus policy")
            }
        })
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Warehouse className="h-4 w-4 text-primary" />
                        Warehouse Pilot
                    </CardTitle>
                    <CardDescription>
                        Satu warehouse bisa tetap hybrid: sebagian item RFID, sebagian tetap manual.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <div className="space-y-2">
                        <Label>Warehouse</Label>
                        <Select
                            value={selectedWarehouseId ? String(selectedWarehouseId) : ""}
                            onValueChange={(value) => setSelectedWarehouseId(Number(value))}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Pilih warehouse" />
                            </SelectTrigger>
                            <SelectContent>
                                {data.warehouses.map((warehouse) => (
                                    <SelectItem key={warehouse.id} value={String(warehouse.id)}>
                                        {warehouse.sloc} - {warehouse.description || "Tanpa deskripsi"}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Default Tracking</Label>
                        <Select value={defaultTrackingMode} onValueChange={(value: TrackingMode) => setDefaultTrackingMode(value)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Pilih mode" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="manual_only">Manual Only</SelectItem>
                                <SelectItem value="optional_rfid">RFID Optional</SelectItem>
                                <SelectItem value="required_rfid">RFID Required</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center gap-3 rounded-lg border p-4">
                        <Switch checked={rfidEnabled} onCheckedChange={setRfidEnabled} />
                        <div>
                            <p className="text-sm font-medium">Aktifkan pilot RFID</p>
                            <p className="text-xs text-muted-foreground">Kalau mati, warehouse ini kembali full manual.</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 rounded-lg border p-4">
                        <Switch checked={warehouseAllowManualFallback} onCheckedChange={setWarehouseAllowManualFallback} />
                        <div>
                            <p className="text-sm font-medium">Allow Manual Fallback</p>
                            <p className="text-xs text-muted-foreground">Operasional tidak macet saat reader bermasalah.</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 rounded-lg border p-4">
                        <Switch checked={inboundValidation} onCheckedChange={setInboundValidation} />
                        <div>
                            <p className="text-sm font-medium">Inbound Validation</p>
                            <p className="text-xs text-muted-foreground">Validasi scan untuk barang masuk.</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 rounded-lg border p-4">
                        <Switch checked={outboundValidation} onCheckedChange={setOutboundValidation} />
                        <div>
                            <p className="text-sm font-medium">Outbound Validation</p>
                            <p className="text-xs text-muted-foreground">Validasi scan untuk delivery dan transfer keluar.</p>
                        </div>
                    </div>

                    <div className="space-y-2 md:col-span-2 xl:col-span-3">
                        <Label>Catatan Pilot</Label>
                        <Textarea
                            value={pilotNotes}
                            onChange={(event) => setPilotNotes(event.target.value)}
                            placeholder="Aturan supervisor, area scan, alasan fallback, dan catatan rollout."
                            rows={3}
                        />
                    </div>

                    <div className="md:col-span-2 xl:col-span-3 flex justify-end">
                        <Button onClick={saveWarehouse} disabled={isPending || !selectedWarehouseId}>
                            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Simpan Setting Warehouse
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Tracking Policy</CardTitle>
                    <CardDescription>
                        Override mode tracking per kategori atau per produk untuk warehouse yang dipilih.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <div className="space-y-2">
                            <Label>Scope</Label>
                            <Select value={scopeType} onValueChange={(value: ScopeType) => setScopeType(value)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih scope" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="category">Category</SelectItem>
                                    <SelectItem value="product">Product</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {scopeType === "category" ? (
                            <div className="space-y-2">
                                <Label>Category</Label>
                                <Select value={category} onValueChange={setCategory}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Pilih category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {data.categories.map((entry) => (
                                            <SelectItem key={entry} value={entry}>
                                                {entry}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        ) : (
                            <div className="space-y-2 xl:col-span-2">
                                <Label>Product</Label>
                                <Select value={productId} onValueChange={setProductId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Pilih product RFID-capable" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {data.rfidCapableProducts.map((product) => (
                                            <SelectItem key={product.id} value={String(product.id)}>
                                                {product.materialNumber} - {product.materialDescription || "Tanpa deskripsi"}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>Mode</Label>
                            <Select value={trackingMode} onValueChange={(value: TrackingMode) => setTrackingMode(value)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih mode" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="manual_only">Manual Only</SelectItem>
                                    <SelectItem value="optional_rfid">RFID Optional</SelectItem>
                                    <SelectItem value="required_rfid">RFID Required</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-center gap-3 rounded-lg border p-4">
                            <Switch checked={allowManualFallback} onCheckedChange={setAllowManualFallback} />
                            <div>
                                <p className="text-sm font-medium">Fallback Manual</p>
                                <p className="text-xs text-muted-foreground">Override manual masih diizinkan.</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 rounded-lg border p-4">
                            <Switch checked={serialRequired} onCheckedChange={setSerialRequired} />
                            <div>
                                <p className="text-sm font-medium">Serial Required</p>
                                <p className="text-xs text-muted-foreground">Cocok untuk tire dan unit fisik.</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 rounded-lg border p-4">
                            <Switch checked={isActive} onCheckedChange={setIsActive} />
                            <div>
                                <p className="text-sm font-medium">Policy Active</p>
                                <p className="text-xs text-muted-foreground">Matikan kalau mau simpan sebagai draft.</p>
                            </div>
                        </div>

                        <div className="space-y-2 md:col-span-2 xl:col-span-3">
                            <Label>Catatan Policy</Label>
                            <Textarea
                                value={policyNotes}
                                onChange={(event) => setPolicyNotes(event.target.value)}
                                placeholder="Contoh: TYRE di warehouse A wajib RFID, material lain tetap manual."
                                rows={3}
                            />
                        </div>

                        <div className="md:col-span-2 xl:col-span-3 flex justify-end">
                            <Button onClick={savePolicy} disabled={isPending || !selectedWarehouseId}>
                                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Simpan Policy
                            </Button>
                        </div>
                    </div>

                    <div className="rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Scope</TableHead>
                                    <TableHead>Target</TableHead>
                                    <TableHead>Mode</TableHead>
                                    <TableHead>Flags</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="w-[70px] text-right">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {selectedPolicies.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                                            Belum ada policy khusus untuk warehouse ini.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    selectedPolicies.map((policy) => (
                                        <TableRow key={policy.id}>
                                            <TableCell className="font-medium capitalize">{policy.scopeType}</TableCell>
                                            <TableCell>
                                                {policy.scopeType === "product"
                                                    ? `${policy.product?.materialNumber || "N/A"} - ${policy.product?.materialDescription || "Tanpa deskripsi"}`
                                                    : policy.category}
                                            </TableCell>
                                            <TableCell>
                                                <TrackingModeBadge mode={policy.trackingMode as TrackingMode} />
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {policy.serialRequired ? "Serial" : "No Serial"} / {policy.allowManualFallback ? "Fallback" : "Strict"}
                                            </TableCell>
                                            <TableCell>{policy.isActive ? "Active" : "Draft"}</TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    disabled={isPending}
                                                    onClick={() => removePolicy(policy.id)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-destructive" />
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
    )
}
