"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, CheckCircle2, Clock3, EyeOff, Search, ShieldAlert } from "lucide-react"
import { toast } from "sonner"

import {
    getRfidExceptionCenterData,
    updateRfidExceptionStatus,
} from "@/app/actions/rfid"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
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

type ExceptionCenterData = Awaited<ReturnType<typeof getRfidExceptionCenterData>>

type RfidExceptionsConsoleProps = {
    data: ExceptionCenterData
}

const statusCards = [
    { key: "open", label: "Open", icon: AlertTriangle, tone: "text-red-600" },
    { key: "investigating", label: "Investigating", icon: Clock3, tone: "text-amber-600" },
    { key: "resolved", label: "Resolved", icon: CheckCircle2, tone: "text-emerald-600" },
    { key: "ignored", label: "Ignored", icon: EyeOff, tone: "text-slate-600" },
] as const

const severityOptions = ["all", "critical", "high", "medium", "low"] as const
const documentTypeOptions = ["all", "delivery", "stock_transfer", "good_receive_manual", "stock_opname"] as const

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

const getSeverityBadgeClassName = (severity: string) => {
    switch (severity) {
        case "critical":
            return "border-red-200 bg-red-50 text-red-700"
        case "high":
            return "border-orange-200 bg-orange-50 text-orange-700"
        case "medium":
            return "border-amber-200 bg-amber-50 text-amber-700"
        default:
            return "border-slate-200 bg-slate-50 text-slate-700"
    }
}

const getStatusBadgeClassName = (status: string) => {
    switch (status) {
        case "resolved":
            return "border-emerald-200 bg-emerald-50 text-emerald-700"
        case "ignored":
            return "border-slate-200 bg-slate-50 text-slate-700"
        case "investigating":
            return "border-blue-200 bg-blue-50 text-blue-700"
        default:
            return "border-red-200 bg-red-50 text-red-700"
    }
}

export function RfidExceptionsConsole({ data }: RfidExceptionsConsoleProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [search, setSearch] = useState("")
    const [warehouseFilter, setWarehouseFilter] = useState("all")
    const [statusFilter, setStatusFilter] = useState("open")
    const [severityFilter, setSeverityFilter] = useState("all")
    const [documentTypeFilter, setDocumentTypeFilter] = useState("all")
    const [draftStatusById, setDraftStatusById] = useState<Record<number, string>>({})
    const [draftReviewById, setDraftReviewById] = useState<Record<number, string>>({})

    const filteredExceptions = useMemo(() => {
        const query = search.trim().toLowerCase()

        return data.exceptions.filter((exception) => {
            const matchesWarehouse = warehouseFilter === "all" || String(exception.warehouseId ?? "") === warehouseFilter
            const matchesStatus = statusFilter === "all" || exception.status === statusFilter
            const matchesSeverity = severityFilter === "all" || exception.severity === severityFilter
            const matchesDocumentType = documentTypeFilter === "all" || exception.documentType === documentTypeFilter

            if (!matchesWarehouse || !matchesStatus || !matchesSeverity || !matchesDocumentType) {
                return false
            }

            if (!query) {
                return true
            }

            const haystack = [
                exception.exceptionType,
                exception.severity,
                exception.status,
                exception.referenceNumber,
                exception.documentType,
                exception.notes,
                exception.product?.materialNumber,
                exception.product?.materialDescription,
                exception.rfidTag?.epc,
                exception.inventoryUnit?.serialNumber,
                exception.inventoryUnit?.product?.materialNumber,
                exception.warehouse?.sloc,
                exception.zone?.zoneName,
                exception.device?.deviceName,
                exception.session?.sessionCode,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()

            return haystack.includes(query)
        })
    }, [data.exceptions, documentTypeFilter, search, severityFilter, statusFilter, warehouseFilter])

    const handleStatusUpdate = (exceptionId: number, currentStatus: string) => {
        const nextStatus = draftStatusById[exceptionId] ?? currentStatus
        const reviewNote = draftReviewById[exceptionId] ?? ""

        if (nextStatus === currentStatus && !reviewNote.trim()) {
            toast.error("Tidak ada perubahan status atau catatan review")
            return
        }

        startTransition(async () => {
            const result = await updateRfidExceptionStatus({
                exceptionId,
                status: nextStatus as ExceptionCenterData["statusOptions"][number],
                reviewNote,
            })

            if (!result.success) {
                toast.error(result.error || "Gagal memperbarui exception RFID")
                return
            }

            toast.success(`Exception berhasil diubah menjadi ${formatEnumLabel(result.status)}`)
            router.refresh()
        })
    }

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            <div className="space-y-1">
                <h1 className="text-2xl font-bold tracking-tight">RFID Exception Center</h1>
                <p className="text-sm text-muted-foreground">
                    Pusat tindak lanjut exception RFID dari goods receive, delivery, stock transfer, dan stock opname, tanpa mengganggu flow manual warehouse yang sedang berjalan.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total Exception</CardDescription>
                        <CardTitle className="text-2xl">{data.totals.total}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground">
                        Critical {data.totals.critical} · High {data.totals.high} · Medium {data.totals.medium}
                    </CardContent>
                </Card>
                {statusCards.map((card) => {
                    const Icon = card.icon
                    return (
                        <Card key={card.key}>
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between gap-2">
                                    <CardDescription>{card.label}</CardDescription>
                                    <Icon className={cn("h-4 w-4", card.tone)} />
                                </div>
                                <CardTitle className="text-2xl">
                                    {data.totals[card.key]}
                                </CardTitle>
                            </CardHeader>
                        </Card>
                    )
                })}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Filter Exception</CardTitle>
                    <CardDescription>
                        Cari berdasarkan type, warehouse, material, serial, EPC, dokumen, atau catatan exception.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <div className="relative xl:col-span-2">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Cari exception, material, serial, EPC, reference..."
                            className="pl-9"
                        />
                    </div>
                    <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                        <SelectTrigger>
                            <SelectValue placeholder="Semua warehouse" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua warehouse</SelectItem>
                            {data.warehouses.map((warehouse) => (
                                <SelectItem key={warehouse.id} value={String(warehouse.id)}>
                                    {warehouse.sloc} - {warehouse.description || "Tanpa deskripsi"}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger>
                            <SelectValue placeholder="Semua status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua status</SelectItem>
                            {data.statusOptions.map((status) => (
                                <SelectItem key={status} value={status}>
                                    {formatEnumLabel(status)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={severityFilter} onValueChange={setSeverityFilter}>
                        <SelectTrigger>
                            <SelectValue placeholder="Semua severity" />
                        </SelectTrigger>
                        <SelectContent>
                            {severityOptions.map((severity) => (
                                <SelectItem key={severity} value={severity}>
                                    {severity === "all" ? "Semua severity" : formatEnumLabel(severity)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={documentTypeFilter} onValueChange={setDocumentTypeFilter}>
                        <SelectTrigger>
                            <SelectValue placeholder="Semua dokumen" />
                        </SelectTrigger>
                        <SelectContent>
                            {documentTypeOptions.map((documentType) => (
                                <SelectItem key={documentType} value={documentType}>
                                    {documentType === "all" ? "Semua dokumen" : formatEnumLabel(documentType)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Daftar Exception</CardTitle>
                    <CardDescription>
                        Update status ke `investigating`, `resolved`, atau `ignored` saat tindak lanjut sudah dilakukan. Status ini aman karena tidak mengubah stok atau transaksi sumber.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Exception</TableHead>
                                    <TableHead>Warehouse / Dokumen</TableHead>
                                    <TableHead>Material / Tag</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Review</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredExceptions.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
                                            Tidak ada exception yang cocok dengan filter saat ini.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredExceptions.map((exception) => {
                                        const draftStatus = draftStatusById[exception.id] ?? exception.status
                                        const draftReview = draftReviewById[exception.id] ?? ""

                                        return (
                                            <TableRow key={exception.id} className="align-top">
                                                <TableCell className="space-y-2">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <Badge variant="outline" className={cn("capitalize", getSeverityBadgeClassName(exception.severity))}>
                                                            {formatEnumLabel(exception.severity)}
                                                        </Badge>
                                                        <Badge variant="outline" className="capitalize">
                                                            {formatEnumLabel(exception.exceptionType)}
                                                        </Badge>
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        Dibuat {formatDateTime(exception.createdAt)}
                                                    </div>
                                                    <div className="text-sm">
                                                        {exception.notes?.trim() || "Tanpa catatan tambahan"}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="space-y-2 text-sm">
                                                    <div className="font-medium">
                                                        {exception.warehouse?.sloc || "N/A"}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {exception.documentType ? formatEnumLabel(exception.documentType) : "Tanpa dokumen"} · {exception.referenceNumber || "-"}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        Zone {exception.zone?.zoneName || "-"} · Device {exception.device?.deviceName || exception.session?.device?.deviceName || "-"}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        Session {exception.session?.sessionCode || "-"}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="space-y-2 text-sm">
                                                    <div className="font-medium">
                                                        {exception.product?.materialNumber || exception.inventoryUnit?.product?.materialNumber || "-"}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {exception.product?.materialDescription || exception.inventoryUnit?.product?.materialDescription || "-"}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        Serial {exception.inventoryUnit?.serialNumber || "-"}
                                                    </div>
                                                    <div className="font-mono text-xs text-muted-foreground">
                                                        EPC {exception.rfidTag?.epc || exception.inventoryUnit?.currentTag?.epc || "-"}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="space-y-2">
                                                    <Badge variant="outline" className={cn("capitalize", getStatusBadgeClassName(exception.status))}>
                                                        {formatEnumLabel(exception.status)}
                                                    </Badge>
                                                    <div className="text-xs text-muted-foreground">
                                                        Resolved by {exception.resolvedByUser?.name || "-"}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {formatDateTime(exception.resolvedAt)}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="space-y-2">
                                                    <Select
                                                        value={draftStatus}
                                                        onValueChange={(value) =>
                                                            setDraftStatusById((current) => ({
                                                                ...current,
                                                                [exception.id]: value,
                                                            }))
                                                        }
                                                    >
                                                        <SelectTrigger className="w-[180px]">
                                                            <SelectValue placeholder="Pilih status" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {data.statusOptions.map((status) => (
                                                                <SelectItem key={status} value={status}>
                                                                    {formatEnumLabel(status)}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <Textarea
                                                        value={draftReview}
                                                        onChange={(event) =>
                                                            setDraftReviewById((current) => ({
                                                                ...current,
                                                                [exception.id]: event.target.value,
                                                            }))
                                                        }
                                                        placeholder="Catatan tindak lanjut, alasan ignore, atau hasil investigasi..."
                                                        className="min-h-[88px]"
                                                    />
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            disabled={isPending}
                                                            onClick={() => handleStatusUpdate(exception.id, exception.status)}
                                                        >
                                                            <ShieldAlert className="mr-2 h-4 w-4" />
                                                            Simpan Review
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            disabled={isPending}
                                                            onClick={() => {
                                                                setDraftStatusById((current) => ({
                                                                    ...current,
                                                                    [exception.id]: exception.status,
                                                                }))
                                                                setDraftReviewById((current) => ({
                                                                    ...current,
                                                                    [exception.id]: "",
                                                                }))
                                                            }}
                                                        >
                                                            Reset
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
