"use client"

import { useMemo, useState, useTransition } from "react"
import { CheckCircle2, Download, Pencil, Plus, Search, Trash2, Wrench, MapPin } from "lucide-react"
import { toast } from "sonner"

import {
  bulkDeleteRepairMasterItems,
  deleteRepairMasterItem,
  deleteRepairMasterSite,
  getRepairMasterData,
  upsertRepairMasterItem,
  upsertRepairMasterSite,
} from "@/app/actions/repair-master"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import type { repairMasterItems, repairMasterSites } from "@/db/schema"
import type { InferSelectModel } from "drizzle-orm"

type RepairMasterItem = InferSelectModel<typeof repairMasterItems>
type RepairMasterSite = InferSelectModel<typeof repairMasterSites>

type RepairMasterClientProps = {
  initialItems: RepairMasterItem[]
  initialSites: RepairMasterSite[]
}

type ItemFormState = {
  materialCode: string
  materialName: string
  valuationStockValue: string
  currency: string
  valuatedStock: string
  uom: string
  category: string
  smu: string
  defaultQty: string
  standardTime: string
  notes: string
  isActive: boolean
}

type SiteFormState = {
  siteCode: string
  siteName: string
  isActive: boolean
}

const emptyItem: ItemFormState = {
  materialCode: "",
  materialName: "",
  valuationStockValue: "",
  currency: "USD",
  valuatedStock: "",
  uom: "",
  category: "",
  smu: "",
  defaultQty: "",
  standardTime: "",
  notes: "",
  isActive: true,
}

const emptySite: SiteFormState = {
  siteCode: "",
  siteName: "",
  isActive: true,
}

function includesQuery(values: Array<string | null | undefined>, query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return true
  return values.some((value) => (value ?? "").toLowerCase().includes(normalizedQuery))
}

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`
  const csv = [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function ItemDialog({
  item,
  trigger,
  onSaved,
}: {
  item?: RepairMasterItem
  trigger: React.ReactNode
  onSaved: () => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState<ItemFormState>(() => ({
    materialCode: item?.materialCode ?? "",
    materialName: item?.materialName ?? "",
    valuationStockValue: item?.valuationStockValue ?? "",
    currency: item?.currency ?? "USD",
    valuatedStock: item?.valuatedStock ?? "",
    uom: item?.uom ?? "",
    category: item?.category ?? "",
    smu: item?.smu ?? "",
    defaultQty: item?.defaultQty ?? "",
    standardTime: item?.standardTime ?? "",
    notes: item?.notes ?? "",
    isActive: item?.isActive ?? true,
  }))

  const updateForm = (key: keyof ItemFormState, value: string | boolean) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const handleSave = () => {
    startTransition(async () => {
      const result = await upsertRepairMasterItem(form, item?.id)
      if (result.success) {
        toast.success(item ? "Barang repair diperbarui" : "Barang repair ditambahkan")
        setOpen(false)
        if (!item) setForm(emptyItem)
        await onSaved()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{item ? "Edit Barang Repair" : "Tambah Barang Repair"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Material Code</Label>
            <Input value={form.materialCode} onChange={(event) => updateForm("materialCode", event.target.value)} disabled={Boolean(item) || isPending} />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Input value={form.category} onChange={(event) => updateForm("category", event.target.value)} disabled={isPending} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Material Name</Label>
            <Input value={form.materialName} onChange={(event) => updateForm("materialName", event.target.value)} disabled={isPending} />
          </div>
          <div className="space-y-2">
            <Label>ValStockValue</Label>
            <Input value={form.valuationStockValue} onChange={(event) => updateForm("valuationStockValue", event.target.value)} disabled={isPending} />
          </div>
          <div className="space-y-2">
            <Label>Curr</Label>
            <Input value={form.currency} onChange={(event) => updateForm("currency", event.target.value)} disabled={isPending} />
          </div>
          <div className="space-y-2">
            <Label>Valuated Stock</Label>
            <Input value={form.valuatedStock} onChange={(event) => updateForm("valuatedStock", event.target.value)} disabled={isPending} />
          </div>
          <div className="space-y-2">
            <Label>UOM</Label>
            <Input value={form.uom} onChange={(event) => updateForm("uom", event.target.value)} disabled={isPending} />
          </div>
          <div className="space-y-2">
            <Label>SMU</Label>
            <Input value={form.smu} onChange={(event) => updateForm("smu", event.target.value)} disabled={isPending} />
          </div>
          <div className="space-y-2">
            <Label>Default Qty</Label>
            <Input value={form.defaultQty} onChange={(event) => updateForm("defaultQty", event.target.value)} disabled={isPending} />
          </div>
          <div className="space-y-2">
            <Label>Standard Time</Label>
            <Input value={form.standardTime} onChange={(event) => updateForm("standardTime", event.target.value)} disabled={isPending} />
          </div>
          <label className="flex items-center gap-2 self-end rounded-lg border px-3 py-2 text-sm">
            <Checkbox checked={form.isActive} onCheckedChange={(value) => updateForm("isActive", Boolean(value))} disabled={isPending} />
            Active
          </label>
          <div className="space-y-2 md:col-span-2">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} disabled={isPending} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Batal</Button>
          <Button type="button" onClick={handleSave} disabled={isPending || !form.materialCode.trim() || !form.materialName.trim()}>
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SiteDialog({
  site,
  trigger,
  onSaved,
}: {
  site?: RepairMasterSite
  trigger: React.ReactNode
  onSaved: () => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState<SiteFormState>(() => ({
    siteCode: site?.siteCode ?? "",
    siteName: site?.siteName ?? "",
    isActive: site?.isActive ?? true,
  }))

  const handleSave = () => {
    startTransition(async () => {
      const result = await upsertRepairMasterSite(form, site?.id)
      if (result.success) {
        toast.success(site ? "Site repair diperbarui" : "Site repair ditambahkan")
        setOpen(false)
        if (!site) setForm(emptySite)
        await onSaved()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{site ? "Edit Site Repair" : "Tambah Site Repair"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>Site Code</Label>
            <Input value={form.siteCode} onChange={(event) => setForm((current) => ({ ...current, siteCode: event.target.value }))} disabled={Boolean(site) || isPending} />
          </div>
          <div className="space-y-2">
            <Label>Site Name</Label>
            <Input value={form.siteName} onChange={(event) => setForm((current) => ({ ...current, siteName: event.target.value }))} disabled={isPending} />
          </div>
          <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
            <Checkbox checked={form.isActive} onCheckedChange={(value) => setForm((current) => ({ ...current, isActive: Boolean(value) }))} disabled={isPending} />
            Active
          </label>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Batal</Button>
          <Button type="button" onClick={handleSave} disabled={isPending || !form.siteCode.trim() || !form.siteName.trim()}>
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function RepairMasterClient({ initialItems, initialSites }: RepairMasterClientProps) {
  const [items, setItems] = useState(initialItems)
  const [sites, setSites] = useState(initialSites)
  const [itemQuery, setItemQuery] = useState("")
  const [siteQuery, setSiteQuery] = useState("")
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([])
  const [isPending, startTransition] = useTransition()

  const refreshData = async () => {
    const data = await getRepairMasterData()
    setItems(data.items)
    setSites(data.sites)
  }

  const filteredItems = useMemo(
    () =>
      items.filter((item) =>
        includesQuery(
          [
            item.materialCode,
            item.materialName,
            item.valuationStockValue,
            item.currency,
            item.valuatedStock,
            item.uom,
            item.category,
            item.smu,
            item.defaultQty,
            item.standardTime,
            item.notes,
          ],
          itemQuery,
        ),
      ),
    [itemQuery, items],
  )

  const filteredSites = useMemo(
    () => sites.filter((site) => includesQuery([site.siteCode, site.siteName], siteQuery)),
    [siteQuery, sites],
  )

  const selectedSet = new Set(selectedItemIds)
  const allVisibleItemsSelected = filteredItems.length > 0 && filteredItems.every((item) => selectedSet.has(item.id))

  const toggleAllVisibleItems = (checked: boolean) => {
    setSelectedItemIds((current) => {
      const visibleIds = filteredItems.map((item) => item.id)
      if (checked) {
        return Array.from(new Set([...current, ...visibleIds]))
      }
      return current.filter((id) => !visibleIds.includes(id))
    })
  }

  const handleDeleteItem = (id: number) => {
    if (!window.confirm("Hapus barang repair ini?")) return

    startTransition(async () => {
      const result = await deleteRepairMasterItem(id)
      if (result.success) {
        toast.success("Barang repair dihapus")
        setSelectedItemIds((current) => current.filter((selectedId) => selectedId !== id))
        await refreshData()
      } else {
        toast.error(result.error)
      }
    })
  }

  const handleBulkDeleteItems = () => {
    if (!window.confirm(`Hapus ${selectedItemIds.length} barang repair terpilih?`)) return

    startTransition(async () => {
      const result = await bulkDeleteRepairMasterItems(selectedItemIds)
      if (result.success) {
        toast.success("Barang repair terpilih dihapus")
        setSelectedItemIds([])
        await refreshData()
      } else {
        toast.error(result.error)
      }
    })
  }

  const handleDeleteSite = (id: number) => {
    if (!window.confirm("Hapus site repair ini?")) return

    startTransition(async () => {
      const result = await deleteRepairMasterSite(id)
      if (result.success) {
        toast.success("Site repair dihapus")
        await refreshData()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <Tabs defaultValue="items" className="space-y-4">
      <TabsList className="grid w-full grid-cols-2 md:w-[420px]">
        <TabsTrigger value="items" className="gap-2">
          <Wrench className="h-4 w-4" />
          Barang Repair
        </TabsTrigger>
        <TabsTrigger value="sites" className="gap-2">
          <MapPin className="h-4 w-4" />
          Site Repair
        </TabsTrigger>
      </TabsList>

      <TabsContent value="items" className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Total Barang</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{items.length.toLocaleString("id-ID")}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Active</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{items.filter((item) => item.isActive).length.toLocaleString("id-ID")}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Selected</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{selectedItemIds.length.toLocaleString("id-ID")}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative md:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={itemQuery} onChange={(event) => setItemQuery(event.target.value)} className="pl-9" placeholder="Cari material, category, SMU..." />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                downloadCsv(
                  `repair_master_items_${new Date().toISOString().slice(0, 10)}.csv`,
                  ["Material Code", "Material Name", "ValStockValue", "Curr", "Valuated Stock", "UOM", "Category", "SMU", "Default Qty", "Standard Time", "Status", "Notes"],
                  filteredItems.map((item) => [
                    item.materialCode,
                    item.materialName,
                    item.valuationStockValue ?? "",
                    item.currency ?? "",
                    item.valuatedStock ?? "",
                    item.uom ?? "",
                    item.category ?? "",
                    item.smu ?? "",
                    item.defaultQty ?? "",
                    item.standardTime ?? "",
                    item.isActive ? "Active" : "Inactive",
                    item.notes ?? "",
                  ]),
                )
              }
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button type="button" variant="destructive" disabled={selectedItemIds.length === 0 || isPending} onClick={handleBulkDeleteItems}>
              <Trash2 className="mr-2 h-4 w-4" />
              Hapus Terpilih
            </Button>
            <ItemDialog onSaved={refreshData} trigger={<Button><Plus className="mr-2 h-4 w-4" />Tambah Barang</Button>} />
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="max-h-[620px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox checked={allVisibleItemsSelected} onCheckedChange={(value) => toggleAllVisibleItems(Boolean(value))} />
                  </TableHead>
                  <TableHead>Material Code</TableHead>
                  <TableHead>Material Name</TableHead>
                  <TableHead>ValStockValue</TableHead>
                  <TableHead>Curr</TableHead>
                  <TableHead>Valuated Stock</TableHead>
                  <TableHead>UOM</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length > 0 ? (
                  filteredItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedSet.has(item.id)}
                          onCheckedChange={(value) =>
                            setSelectedItemIds((current) =>
                              value ? Array.from(new Set([...current, item.id])) : current.filter((id) => id !== item.id),
                            )
                          }
                        />
                      </TableCell>
                      <TableCell className="font-medium">{item.materialCode}</TableCell>
                      <TableCell className="min-w-72">{item.materialName}</TableCell>
                      <TableCell>{item.valuationStockValue || "-"}</TableCell>
                      <TableCell>{item.currency || "-"}</TableCell>
                      <TableCell>{item.valuatedStock || "-"}</TableCell>
                      <TableCell>{item.uom || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={item.isActive ? "default" : "secondary"}>{item.isActive ? "Active" : "Inactive"}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <ItemDialog
                            item={item}
                            onSaved={refreshData}
                            trigger={<Button type="button" variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>}
                          />
                          <Button type="button" variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDeleteItem(item.id)} disabled={isPending}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="h-28 text-center text-muted-foreground">
                      Belum ada data barang repair.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="sites" className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative md:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={siteQuery} onChange={(event) => setSiteQuery(event.target.value)} className="pl-9" placeholder="Cari code atau nama site..." />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                downloadCsv(
                  `repair_master_sites_${new Date().toISOString().slice(0, 10)}.csv`,
                  ["Site Code", "Site Name", "Status"],
                  filteredSites.map((site) => [site.siteCode, site.siteName, site.isActive ? "Active" : "Inactive"]),
                )
              }
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <SiteDialog onSaved={refreshData} trigger={<Button><Plus className="mr-2 h-4 w-4" />Tambah Site</Button>} />
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">Site Code</TableHead>
                <TableHead>Site Name</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-32 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSites.map((site) => (
                <TableRow key={site.id}>
                  <TableCell className="font-medium">{site.siteCode}</TableCell>
                  <TableCell>{site.siteName}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {site.isActive ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : null}
                      <Badge variant={site.isActive ? "default" : "secondary"}>{site.isActive ? "Active" : "Inactive"}</Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <SiteDialog
                        site={site}
                        onSaved={refreshData}
                        trigger={<Button type="button" variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>}
                      />
                      <Button type="button" variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDeleteSite(site.id)} disabled={isPending}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </TabsContent>
    </Tabs>
  )
}
