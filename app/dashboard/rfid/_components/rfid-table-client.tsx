"use client"

import { useMemo, useState } from "react"
import { format } from "date-fns"
import {
    Check,
    Download,
    Eye,
    Filter,
    Pencil,
    Plus,
    RadioTower,
    RefreshCw,
    Search,
    Trash2,
} from "lucide-react"
import { toast } from "sonner"

import { toggleRfidStatusAction } from "@/app/actions/rfid"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"

import { Input } from "@/components/ui/input"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { usePermissions } from "@/hooks/use-permissions"

import { RfidDetailDialog, type RfidRow } from "./rfid-detail-dialog"
import { RfidDeleteDialog } from "./rfid-delete-dialog"
import { RfidFormDialog } from "./rfid-form-dialog"

interface RfidTableClientProps {
    initialRows: RfidRow[]
}

const formatDate = (value?: Date | string | null) => {
    if (!value) return "-"
    try {
        return format(new Date(value), "dd MMM yyyy HH:mm")
    } catch {
        return String(value)
    }
}

export function RfidTableClient({ initialRows }: RfidTableClientProps) {
    let canCreate = true
    let canEdit = true
    let canDelete = true

    try {
        const permissions = usePermissions()
        canCreate = permissions.hasResourcePermission("rfid", "create")
        canEdit = permissions.hasResourcePermission("rfid", "edit")
        canDelete = permissions.hasResourcePermission("rfid", "delete")
    } catch {
        // Fallback if rendered outside PermissionsProvider
        canCreate = true
        canEdit = true
        canDelete = true
    }

    const [rows, setRows] = useState<RfidRow[]>(initialRows)
    const [searchQuery, setSearchQuery] = useState("")
    const [statusFilter, setStatusFilter] = useState<"all" | "linked" | "unlinked">("all")
    const [selectedIds, setSelectedIds] = useState<number[]>([])

    // Dialog States
    const [detailRow, setDetailRow] = useState<RfidRow | null>(null)
    const [isDetailOpen, setIsDetailOpen] = useState(false)

    const [formMode, setFormMode] = useState<"create" | "edit">("create")
    const [formRow, setFormRow] = useState<RfidRow | null>(null)
    const [isFormOpen, setIsFormOpen] = useState(false)

    const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)
    const [deleteTargetIds, setDeleteTargetIds] = useState<number[]>([])
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

    const [togglingId, setTogglingId] = useState<number | null>(null)

    // Sync state when initialRows updates
    useMemo(() => {
        setRows(initialRows)
    }, [initialRows])

    // Filter Logic
    const filteredRows = useMemo(() => {
        return rows.filter((row) => {
            // Filter by status
            if (statusFilter === "linked" && !row.linked) return false
            if (statusFilter === "unlinked" && row.linked) return false

            // Filter by search query
            if (!searchQuery.trim()) return true
            const q = searchQuery.toLowerCase().trim()
            return (
                row.epc?.toLowerCase().includes(q) ||
                row.tagId?.toLowerCase().includes(q) ||
                row.serialNumber?.toLowerCase().includes(q) ||
                row.materialNumber?.toLowerCase().includes(q) ||
                row.materialDescription?.toLowerCase().includes(q) ||
                row.sloc?.toLowerCase().includes(q) ||
                row.slocDescription?.toLowerCase().includes(q) ||
                row.createdBy?.toLowerCase().includes(q) ||
                row.category?.toLowerCase().includes(q)
            )
        })
    }, [rows, searchQuery, statusFilter])

    // Checkbox selection handlers
    const isAllSelected = filteredRows.length > 0 && filteredRows.every((r) => selectedIds.includes(r.id))

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(filteredRows.map((r) => r.id))
        } else {
            setSelectedIds([])
        }
    }

    const handleSelectRow = (id: number, checked: boolean) => {
        if (checked) {
            setSelectedIds((prev) => [...prev, id])
        } else {
            setSelectedIds((prev) => prev.filter((item) => item !== id))
        }
    }

    // Quick Inline Status Change Handler
    const handleToggleStatus = async (row: RfidRow, newStatus: boolean) => {
        if (!canEdit) {
            toast.error("Anda tidak memiliki izin untuk mengedit data RFID")
            return
        }

        setTogglingId(row.id)
        try {
            const res = await toggleRfidStatusAction(row.id, newStatus)
            if (res.success) {
                toast.success(`Status RFID #${row.id} diperbarui menjadi ${newStatus ? "Linked" : "Unlinked"}`)
                setRows((prev) =>
                    prev.map((r) => (r.id === row.id ? { ...r, linked: newStatus } : r))
                )
            } else {
                toast.error(res.error || "Gagal memperbarui status RFID")
            }
        } catch (err) {
            console.error(err)
            toast.error("Terjadi kesalahan sistem")
        } finally {
            setTogglingId(null)
        }
    }

    // CSV Export Handler
    const handleExportCSV = () => {
        if (filteredRows.length === 0) {
            toast.error("Tidak ada data untuk diexport")
            return
        }

        const headers = [
            "ID",
            "Scanned At",
            "Tag ID / EPC",
            "Serial Number",
            "RSSI",
            "Status",
            "Material Number",
            "Material Description",
            "Category",
            "Plant",
            "SLoc",
            "SLoc Description",
            "Act Stock",
            "Created By",
        ]

        const csvContent = [
            headers.join(","),
            ...filteredRows.map((r) =>
                [
                    r.id,
                    `"${formatDate(r.scannedAt)}"`,
                    `"${r.epc || r.tagId || ""}"`,
                    `"${r.serialNumber || ""}"`,
                    `"${r.rssi || ""}"`,
                    `"${r.linked ? "Linked" : "Unlinked"}"`,
                    `"${r.materialNumber || ""}"`,
                    `"${(r.materialDescription || "").replace(/"/g, '""')}"`,
                    `"${r.category || ""}"`,
                    `"${r.plant || ""}"`,
                    `"${r.sloc || ""}"`,
                    `"${(r.slocDescription || "").replace(/"/g, '""')}"`,
                    r.actStock ?? "",
                    `"${r.createdBy || ""}"`,
                ].join(",")
            ),
        ].join("\n")

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.setAttribute("download", `rfid_export_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        toast.success(`Berhasil meng-export ${filteredRows.length} baris ke CSV`)
    }

    return (
        <Card className="shadow-sm">
            <CardHeader className="p-4 sm:p-6 border-b">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <RadioTower className="size-5 text-primary" /> Data RFID Scan ({filteredRows.length})
                    </CardTitle>

                    <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2">
                            <Download className="size-4" />
                            Export CSV
                        </Button>

                        {canDelete && selectedIds.length > 0 && (
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                    setDeleteTargetId(null)
                                    setDeleteTargetIds(selectedIds)
                                    setIsDeleteDialogOpen(true)
                                }}
                                className="gap-2"
                            >
                                <Trash2 className="size-4" />
                                Hapus Terpilih ({selectedIds.length})
                            </Button>
                        )}

                        {canCreate && (
                            <Button
                                size="sm"
                                onClick={() => {
                                    setFormMode("create")
                                    setFormRow(null)
                                    setIsFormOpen(true)
                                }}
                                className="gap-2"
                            >
                                <Plus className="size-4" />
                                Tambah Scan RFID
                            </Button>
                        )}
                    </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="flex flex-col sm:flex-row items-center gap-3 pt-3">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                        <Input
                            placeholder="Cari berdasarkan Material, EPC, SN, SLoc, atau Created By..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 text-sm"
                        />
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Filter className="size-4 text-muted-foreground hidden sm:inline-block" />
                        <Select
                            value={statusFilter}
                            onValueChange={(val) => setStatusFilter(val as "all" | "linked" | "unlinked")}
                        >
                            <SelectTrigger className="w-full sm:w-[160px]">
                                <SelectValue placeholder="Filter Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Status</SelectItem>
                                <SelectItem value="linked">Linked Only</SelectItem>
                                <SelectItem value="unlinked">Unlinked Only</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[40px] text-center">
                                    <Checkbox
                                        checked={isAllSelected}
                                        onCheckedChange={handleSelectAll}
                                        aria-label="Pilih semua"
                                    />
                                </TableHead>
                                <TableHead>Created At</TableHead>
                                <TableHead>Material</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>SLoc</TableHead>
                                <TableHead>SN</TableHead>
                                <TableHead>EPC / Tag ID</TableHead>
                                <TableHead>RSSI</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Act Stock</TableHead>
                                <TableHead>Created By</TableHead>
                                <TableHead className="text-right pr-6">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredRows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={12} className="h-32 text-center text-muted-foreground">
                                        Tidak ada data RFID yang sesuai filter.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredRows.map((row) => (
                                    <TableRow key={row.id} className={selectedIds.includes(row.id) ? "bg-muted/50" : ""}>
                                        <TableCell className="text-center">
                                            <Checkbox
                                                checked={selectedIds.includes(row.id)}
                                                onCheckedChange={(checked) => handleSelectRow(row.id, Boolean(checked))}
                                                aria-label={`Pilih row ${row.id}`}
                                            />
                                        </TableCell>
                                        <TableCell className="tabular-nums text-xs whitespace-nowrap">
                                            {formatDate(row.scannedAt)}
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-medium text-sm">{row.materialNumber ?? "-"}</div>
                                            <div className="text-xs text-muted-foreground">{row.category ?? "-"}</div>
                                        </TableCell>
                                        <TableCell className="max-w-[240px] truncate text-xs" title={row.materialDescription ?? undefined}>
                                            {row.materialDescription ?? "-"}
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-medium text-xs tabular-nums">{row.sloc ?? "-"}</div>
                                            <div className="text-[11px] text-muted-foreground truncate max-w-[120px]">
                                                {row.slocDescription ?? "-"}
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-medium text-xs tabular-nums">{row.serialNumber ?? "-"}</TableCell>
                                        <TableCell className="font-mono text-xs max-w-[160px] truncate" title={row.epc ?? row.tagId}>
                                            {row.epc ?? row.tagId}
                                        </TableCell>
                                        <TableCell className="tabular-nums text-xs">{row.rssi ?? "-"}</TableCell>
                                        <TableCell>
                                            {/* Interactive Inline Status Toggle via Popover */}
                                            {canEdit ? (
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <button
                                                            type="button"
                                                            disabled={togglingId === row.id}
                                                            className="cursor-pointer focus:outline-none transition-transform active:scale-95"
                                                        >
                                                            <Badge
                                                                variant={row.linked ? "success" : "secondary"}
                                                                className="hover:opacity-80 transition-opacity gap-1"
                                                            >
                                                                {togglingId === row.id ? (
                                                                    <RefreshCw className="size-3 animate-spin" />
                                                                ) : null}
                                                                {row.linked ? "Linked" : "Unlinked"}
                                                            </Badge>
                                                        </button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-48 p-2" align="start">
                                                        <div className="text-xs font-semibold text-muted-foreground px-2 py-1">
                                                            Ubah Status RFID
                                                        </div>
                                                        <div className="space-y-1 mt-1">
                                                            <Button
                                                                variant={row.linked ? "secondary" : "ghost"}
                                                                size="sm"
                                                                onClick={() => handleToggleStatus(row, true)}
                                                                className="w-full justify-between text-xs h-8"
                                                            >
                                                                <span>Linked</span>
                                                                {row.linked && <Check className="size-3 text-primary" />}
                                                            </Button>
                                                            <Button
                                                                variant={!row.linked ? "secondary" : "ghost"}
                                                                size="sm"
                                                                onClick={() => handleToggleStatus(row, false)}
                                                                className="w-full justify-between text-xs h-8"
                                                            >
                                                                <span>Unlinked</span>
                                                                {!row.linked && <Check className="size-3 text-primary" />}
                                                            </Button>
                                                        </div>
                                                    </PopoverContent>
                                                </Popover>
                                            ) : (
                                                <Badge variant={row.linked ? "success" : "secondary"}>
                                                    {row.linked ? "Linked" : "Unlinked"}
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums text-xs">{row.actStock ?? "-"}</TableCell>
                                        <TableCell className="text-xs">{row.createdBy ?? "-"}</TableCell>

                                        {/* Action Buttons */}
                                        <TableCell className="text-right pr-6 whitespace-nowrap">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    title="Detail RFID"
                                                    onClick={() => {
                                                        setDetailRow(row)
                                                        setIsDetailOpen(true)
                                                    }}
                                                    className="size-8 text-muted-foreground hover:text-foreground"
                                                >
                                                    <Eye className="size-4" />
                                                </Button>

                                                {canEdit && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        title="Edit RFID"
                                                        onClick={() => {
                                                            setFormMode("edit")
                                                            setFormRow(row)
                                                            setIsFormOpen(true)
                                                        }}
                                                        className="size-8 text-muted-foreground hover:text-primary"
                                                    >
                                                        <Pencil className="size-4" />
                                                    </Button>
                                                )}

                                                {canDelete && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        title="Hapus RFID"
                                                        onClick={() => {
                                                            setDeleteTargetId(row.id)
                                                            setDeleteTargetIds([])
                                                            setIsDeleteDialogOpen(true)
                                                        }}
                                                        className="size-8 text-muted-foreground hover:text-destructive"
                                                    >
                                                        <Trash2 className="size-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>

            {/* Dialog Windows */}
            <RfidDetailDialog
                open={isDetailOpen}
                onOpenChange={setIsDetailOpen}
                data={detailRow}
                canEdit={canEdit}
                onEdit={(data) => {
                    setFormMode("edit")
                    setFormRow(data)
                    setIsFormOpen(true)
                }}
            />

            <RfidFormDialog
                open={isFormOpen}
                onOpenChange={setIsFormOpen}
                mode={formMode}
                initialData={formRow}
                onSuccess={() => {
                    // Update state or refresh
                }}
            />

            <RfidDeleteDialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
                targetId={deleteTargetId}
                targetIds={deleteTargetIds}
                targetLabel={deleteTargetId ? `#${deleteTargetId}` : undefined}
                onSuccess={() => {
                    setSelectedIds([])
                }}
            />
        </Card>
    )
}
