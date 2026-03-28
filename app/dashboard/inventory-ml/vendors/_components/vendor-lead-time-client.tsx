"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, Pencil, Plus, Search, Store, Trash2, Truck } from "lucide-react"
import { toast } from "sonner"

import {
    deleteInventoryVendorProfile,
    getInventoryVendorProfiles,
    upsertInventoryVendorProfile,
    type VendorLeadTimeProfile,
} from "@/app/actions/inventory-vendors"
import { searchMaterials } from "@/app/actions/inventory-ml"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"

type MaterialOption = {
    materialNo: string
    materialDesc: string | null
}

type EditableMaterial = {
    materialNo: string
    materialDesc: string | null
    leadTimeDays: string
    isPreferred: boolean
}

const emptyForm = {
    id: undefined as number | undefined,
    vendorName: "",
    defaultLeadTimeDays: "",
    notes: "",
    isActive: true,
    materials: [] as EditableMaterial[],
}

export function VendorLeadTimeClient({ initialProfiles }: { initialProfiles: VendorLeadTimeProfile[] }) {
    const [profiles, setProfiles] = useState(initialProfiles)
    const [search, setSearch] = useState("")
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [materialQuery, setMaterialQuery] = useState("")
    const [materialOptions, setMaterialOptions] = useState<MaterialOption[]>([])
    const [isSearchingMaterial, setIsSearchingMaterial] = useState(false)
    const [form, setForm] = useState(emptyForm)

    const filteredProfiles = useMemo(() => {
        const term = search.trim().toLowerCase()
        if (!term) return profiles
        return profiles.filter((profile) =>
            profile.vendorName.toLowerCase().includes(term)
            || profile.materials.some((item) =>
                item.materialNo.toLowerCase().includes(term)
                || (item.materialDesc || "").toLowerCase().includes(term),
            ),
        )
    }, [profiles, search])

    useEffect(() => {
        const timer = window.setTimeout(async () => {
            if (materialQuery.trim().length < 2) {
                setMaterialOptions([])
                return
            }

            setIsSearchingMaterial(true)
            const response = await searchMaterials(materialQuery.trim())
            if (response.success && response.data) {
                setMaterialOptions(
                    response.data
                        .filter((item): item is { materialNo: string; materialDesc: string | null } => Boolean(item.materialNo))
                        .map((item) => ({
                            materialNo: item.materialNo,
                            materialDesc: item.materialDesc,
                        })),
                )
            }
            setIsSearchingMaterial(false)
        }, 250)

        return () => window.clearTimeout(timer)
    }, [materialQuery])

    const resetForm = () => {
        setForm(emptyForm)
        setMaterialQuery("")
        setMaterialOptions([])
    }

    const refreshProfiles = async () => {
        const latest = await getInventoryVendorProfiles()
        setProfiles(latest)
    }

    const openCreateDialog = () => {
        resetForm()
        setIsDialogOpen(true)
    }

    const openEditDialog = (profile: VendorLeadTimeProfile) => {
        setForm({
            id: profile.id,
            vendorName: profile.vendorName,
            defaultLeadTimeDays: profile.defaultLeadTimeDays?.toString() || "",
            notes: profile.notes || "",
            isActive: profile.isActive,
            materials: profile.materials.map((item) => ({
                materialNo: item.materialNo,
                materialDesc: item.materialDesc,
                leadTimeDays: item.leadTimeDays.toString(),
                isPreferred: item.isPreferred,
            })),
        })
        setMaterialQuery("")
        setMaterialOptions([])
        setIsDialogOpen(true)
    }

    const upsertMaterial = (option: MaterialOption) => {
        setForm((current) => {
            if (current.materials.some((item) => item.materialNo === option.materialNo)) {
                return current
            }

            return {
                ...current,
                materials: [
                    ...current.materials,
                    {
                        materialNo: option.materialNo,
                        materialDesc: option.materialDesc,
                        leadTimeDays: current.defaultLeadTimeDays || "21",
                        isPreferred: current.materials.length === 0,
                    },
                ],
            }
        })
    }

    const removeMaterial = (materialNo: string) => {
        setForm((current) => {
            const nextMaterials = current.materials.filter((item) => item.materialNo !== materialNo)
            if (nextMaterials.length > 0 && !nextMaterials.some((item) => item.isPreferred)) {
                nextMaterials[0] = { ...nextMaterials[0], isPreferred: true }
            }
            return { ...current, materials: nextMaterials }
        })
    }

    const setPreferredMaterial = (materialNo: string) => {
        setForm((current) => ({
            ...current,
            materials: current.materials.map((item) => ({
                ...item,
                isPreferred: item.materialNo === materialNo,
            })),
        }))
    }

    const updateMaterialLeadTime = (materialNo: string, leadTimeDays: string) => {
        setForm((current) => ({
            ...current,
            materials: current.materials.map((item) =>
                item.materialNo === materialNo ? { ...item, leadTimeDays } : item,
            ),
        }))
    }

    const handleSubmit = async () => {
        setIsSubmitting(true)
        try {
            const result = await upsertInventoryVendorProfile({
                id: form.id,
                vendorName: form.vendorName,
                defaultLeadTimeDays: form.defaultLeadTimeDays ? Number(form.defaultLeadTimeDays) : null,
                notes: form.notes,
                isActive: form.isActive,
                materials: form.materials.map((item) => ({
                    materialNo: item.materialNo,
                    materialDesc: item.materialDesc,
                    leadTimeDays: Number(item.leadTimeDays),
                    isPreferred: item.isPreferred,
                })),
            })

            if (!result.success) {
                toast.error(result.error)
                return
            }

            toast.success(form.id ? "Vendor berhasil diperbarui." : "Vendor berhasil ditambahkan.")
            setIsDialogOpen(false)
            resetForm()
            await refreshProfiles()
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDelete = async (id: number) => {
        const confirmed = window.confirm("Hapus vendor dan semua mapping material-nya?")
        if (!confirmed) {
            return
        }

        await deleteInventoryVendorProfile(id)
        toast.success("Vendor berhasil dihapus.")
        await refreshProfiles()
    }

    return (
        <div className="space-y-6">
            <Card className="border-slate-200 shadow-sm">
                <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Store className="h-5 w-5 text-sky-600" />
                            Master Vendor Delivery
                        </CardTitle>
                        <CardDescription>
                            Checklist material per vendor, lalu tentukan lead time agar halaman ML Forecast bisa memakai data ini untuk ROP.
                        </CardDescription>
                    </div>
                    <Button onClick={openCreateDialog} className="bg-sky-600 text-white hover:bg-sky-700">
                        <Plus className="mr-2 h-4 w-4" />
                        Tambah Vendor
                    </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Cari vendor, material number, atau deskripsi..."
                            className="pl-9"
                        />
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                        {filteredProfiles.length === 0 ? (
                            <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground lg:col-span-2">
                                Belum ada vendor yang cocok dengan pencarian ini.
                            </div>
                        ) : (
                            filteredProfiles.map((profile) => (
                                <Card key={profile.id} className="border-slate-200">
                                    <CardHeader className="space-y-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <CardTitle className="text-lg">{profile.vendorName}</CardTitle>
                                                <CardDescription className="mt-1">
                                                    {profile.itemCount} material • default lead time {profile.defaultLeadTimeDays ?? "-"} hari
                                                </CardDescription>
                                            </div>
                                            <Badge variant={profile.isActive ? "success" : "outline"}>
                                                {profile.isActive ? "Aktif" : "Nonaktif"}
                                            </Badge>
                                        </div>
                                        {profile.notes && (
                                            <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                                                {profile.notes}
                                            </p>
                                        )}
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <div className="space-y-2">
                                            {profile.materials.slice(0, 6).map((item) => (
                                                <div key={item.id} className="flex items-start justify-between gap-4 rounded-xl border bg-slate-50 px-3 py-2">
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-semibold text-slate-900">{item.materialNo}</span>
                                                            {item.isPreferred && <Badge variant="secondary">Utama</Badge>}
                                                        </div>
                                                        <p className="truncate text-xs text-muted-foreground">{item.materialDesc || "-"}</p>
                                                    </div>
                                                    <span className="shrink-0 text-sm font-semibold text-sky-700">{item.leadTimeDays} hari</span>
                                                </div>
                                            ))}
                                            {profile.materials.length > 6 && (
                                                <p className="text-xs text-muted-foreground">+{profile.materials.length - 6} material lainnya</p>
                                            )}
                                        </div>

                                        <div className="flex gap-2 pt-2">
                                            <Button variant="outline" className="flex-1" onClick={() => openEditDialog(profile)}>
                                                <Pencil className="mr-2 h-4 w-4" />
                                                Edit
                                            </Button>
                                            <Button variant="outline" className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => void handleDelete(profile.id)}>
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Hapus
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="flex max-h-[92vh] flex-col overflow-hidden sm:max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>{form.id ? "Edit Vendor Delivery" : "Tambah Vendor Delivery"}</DialogTitle>
                        <DialogDescription>
                            Pilih material yang dijual vendor ini, lalu isi lead time per material. Salah satu material bisa ditandai sebagai vendor utama.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid min-h-0 flex-1 gap-6 overflow-hidden lg:grid-cols-[320px_minmax(0,1fr)]">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="vendor-name">Nama Vendor</Label>
                                <Input id="vendor-name" value={form.vendorName} onChange={(event) => setForm((current) => ({ ...current, vendorName: event.target.value }))} placeholder="Contoh: PT Sinar Baja" />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="default-lead-time">Default Lead Time (hari)</Label>
                                <Input id="default-lead-time" type="number" min={1} value={form.defaultLeadTimeDays} onChange={(event) => setForm((current) => ({ ...current, defaultLeadTimeDays: event.target.value }))} placeholder="21" />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="vendor-notes">Catatan</Label>
                                <Textarea id="vendor-notes" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Catatan performa vendor, area kirim, atau syarat khusus." rows={5} />
                            </div>

                            <div className="flex items-center justify-between rounded-2xl border p-4">
                                <div>
                                    <p className="font-medium text-slate-900">Vendor aktif</p>
                                    <p className="text-sm text-muted-foreground">Vendor nonaktif tidak akan dipakai sebagai referensi di halaman forecast.</p>
                                </div>
                                <Switch checked={form.isActive} onCheckedChange={(checked) => setForm((current) => ({ ...current, isActive: checked }))} />
                            </div>
                        </div>

                        <div className="flex min-h-0 flex-col gap-4 overflow-hidden">
                            <div className="rounded-2xl border p-4">
                                <div className="flex items-center gap-2">
                                    <Truck className="h-4 w-4 text-sky-600" />
                                    <p className="font-medium text-slate-900">Checklist Material Vendor</p>
                                </div>
                                <p className="mt-1 text-sm text-muted-foreground">Cari material number, centang, lalu isi lead time delivery untuk masing-masing material.</p>

                                <div className="mt-4 space-y-3">
                                    <Input value={materialQuery} onChange={(event) => setMaterialQuery(event.target.value)} placeholder="Cari material number atau deskripsi..." />
                                    <ScrollArea className="h-44 rounded-xl border">
                                        <div className="space-y-2 p-3">
                                            {isSearchingMaterial ? (
                                                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Mencari material...
                                                </div>
                                            ) : materialOptions.length === 0 ? (
                                                <p className="py-6 text-center text-sm text-muted-foreground">Ketik minimal 2 karakter untuk mencari material.</p>
                                            ) : (
                                                materialOptions.map((option) => {
                                                    const checked = form.materials.some((item) => item.materialNo === option.materialNo)
                                                    return (
                                                        <label key={option.materialNo} className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 hover:bg-slate-50">
                                                            <Checkbox checked={checked} onCheckedChange={(nextChecked) => nextChecked ? upsertMaterial(option) : removeMaterial(option.materialNo)} />
                                                            <div className="min-w-0">
                                                                <p className="font-semibold text-slate-900">{option.materialNo}</p>
                                                                <p className="truncate text-xs text-muted-foreground">{option.materialDesc || "-"}</p>
                                                            </div>
                                                        </label>
                                                    )
                                                })
                                            )}
                                        </div>
                                    </ScrollArea>
                                </div>
                            </div>

                            <div className="min-h-0 flex-1 rounded-2xl border p-4">
                                <p className="font-medium text-slate-900">Material Terpilih</p>
                                <p className="mt-1 text-sm text-muted-foreground">Material yang ditandai utama akan menjadi vendor default di halaman ML Forecast.</p>

                                <ScrollArea className="mt-4 h-[320px]">
                                    <div className="space-y-3 pr-3">
                                        {form.materials.length === 0 ? (
                                            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Belum ada material yang dipilih.</div>
                                        ) : (
                                            form.materials.map((item) => (
                                                <div key={item.materialNo} className="rounded-2xl border bg-slate-50 p-4">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <p className="font-semibold text-slate-900">{item.materialNo}</p>
                                                            <p className="truncate text-xs text-muted-foreground">{item.materialDesc || "-"}</p>
                                                        </div>
                                                        <Button variant="ghost" size="sm" onClick={() => removeMaterial(item.materialNo)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>

                                                    <div className="mt-4 grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
                                                        <div className="space-y-2">
                                                            <Label>Lead Time (hari)</Label>
                                                            <Input type="number" min={1} value={item.leadTimeDays} onChange={(event) => updateMaterialLeadTime(item.materialNo, event.target.value)} />
                                                        </div>
                                                        <div className="flex items-center justify-between rounded-xl border bg-white px-3 py-2">
                                                            <div>
                                                                <p className="font-medium text-slate-900">Vendor utama untuk material ini</p>
                                                                <p className="text-xs text-muted-foreground">Dipakai otomatis di halaman ML Forecast jika tidak ada input manual.</p>
                                                            </div>
                                                            <Switch checked={item.isPreferred} onCheckedChange={() => setPreferredMaterial(item.materialNo)} />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </ScrollArea>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button>
                        <Button onClick={() => void handleSubmit()} disabled={isSubmitting}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Menyimpan...
                                </>
                            ) : "Simpan Vendor"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
