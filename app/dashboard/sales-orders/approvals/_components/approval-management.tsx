"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { toast } from "sonner"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    CheckCircle2,
    Clock,
    AlertCircle,
    UserCheck,
    Truck,
    Package,
    ArrowLeft,
    Loader2,
    Send,
    MessageSquare,
    ShieldAlert,
} from "lucide-react"
import Link from "next/link"
import { approveShippingOrders } from "@/app/actions/sales-order-shipping-approval"

interface ApprovalManagementProps {
    batches: any[]
    orders: any[]
    currentUser: {
        id: string
        name: string | null
        email: string | null
        role: string | null
    }
    selectedBatchId?: string
}

export function ApprovalManagement({
    batches,
    orders,
    currentUser,
    selectedBatchId,
}: ApprovalManagementProps) {
    const router = useRouter()
    const [activeBatchId, setActiveBatchId] = React.useState<string>(
        selectedBatchId || batches[0]?.id || ""
    )
    const [selectedOrderIds, setSelectedOrderIds] = React.useState<number[]>([])
    const [approverNotes, setApproverNotes] = React.useState("")
    const [isApproving, setIsApproving] = React.useState(false)

    // Cari batch yang sedang aktif
    const currentBatch = React.useMemo(() => {
        return batches.find((b) => b.id === activeBatchId) || batches[0] || null
    }, [batches, activeBatchId])

    // Filter order berdasarkan batch aktif
    const batchOrders = React.useMemo(() => {
        if (!currentBatch) return []
        return orders.filter((o) => o.shippingApprovalBatchId === currentBatch.id)
    }, [orders, currentBatch])

    // Inisialisasi checklist seluruh order dalam batch
    React.useEffect(() => {
        if (batchOrders.length > 0) {
            setSelectedOrderIds(batchOrders.map((o: any) => o.id))
        } else {
            setSelectedOrderIds([])
        }
    }, [currentBatch?.id, batchOrders.length])

    // Cek apakah user saat ini berwenang meng-approve
    const isAuthorizedApprover = React.useMemo(() => {
        const userEmail = (currentUser.email || "").toLowerCase()
        const userRole = (currentUser.role || "").toLowerCase()

        return (
            userEmail.includes("ali.rahman") ||
            userRole.includes("scm") ||
            userRole.includes("admin") ||
            userRole.includes("manager") ||
            userRole.includes("leader")
        )
    }, [currentUser])

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedOrderIds(batchOrders.map((o: any) => o.id))
        } else {
            setSelectedOrderIds([])
        }
    }

    const handleToggleOrder = (orderId: number) => {
        setSelectedOrderIds((prev) =>
            prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
        )
    }

    const handleApprove = async () => {
        if (selectedOrderIds.length === 0) {
            toast.error("Pilih setidaknya satu Sales Order untuk diapprove.")
            return
        }

        setIsApproving(true)
        try {
            const res = await approveShippingOrders({
                salesOrderIds: selectedOrderIds,
                batchId: currentBatch?.id,
                approverNotes,
            })

            if (res.success) {
                toast.success(
                    `Berhasil menyetujui pengiriman untuk ${selectedOrderIds.length} Sales Order.`
                )
                router.refresh()
            } else {
                toast.error(res.error || "Gagal menyetujui pengiriman.")
            }
        } catch (err) {
            console.error(err)
            toast.error("Terjadi kesalahan saat memproses approval.")
        } finally {
            setIsApproving(false)
        }
    }

    if (batches.length === 0) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <Link href="/dashboard/sales-orders">
                        <Button variant="ghost" size="sm" className="gap-2">
                            <ArrowLeft className="h-4 w-4" />
                            Kembali ke Sales Orders
                        </Button>
                    </Link>
                </div>

                <Card className="text-center py-12">
                    <CardContent className="space-y-4">
                        <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                            <Package className="h-6 w-6" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                                Belum Ada Permintaan Approval Pengiriman
                            </h3>
                            <p className="text-sm text-muted-foreground max-w-md mx-auto">
                                Belum ada batch pengajuan pengiriman dari user sales/admin. Anda dapat mengajukannya melalui halaman tabel Sales Orders.
                            </p>
                        </div>
                        <Link href="/dashboard/sales-orders">
                            <Button className="mt-2 bg-sky-600 hover:bg-sky-700">
                                Buka Daftar Sales Orders
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const isBatchApproved = currentBatch?.status === "Approve"

    return (
        <div className="space-y-6">
            {/* Header Navigation & Title */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <Link href="/dashboard/sales-orders">
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        </Link>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                            Verifikasi Approval Pengiriman SCM
                        </h1>
                    </div>
                    <p className="text-sm text-muted-foreground pl-10">
                        Review rincian Sales Order, berikan arahan logistik/pengiriman, dan setujui pengiriman.
                    </p>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto">
                    <div className="text-right">
                        <span className="text-xs text-muted-foreground block">Login Sebagai:</span>
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                            {currentUser.name || currentUser.email}
                        </span>
                    </div>
                    <Badge variant={isAuthorizedApprover ? "default" : "secondary"} className="h-7">
                        {isAuthorizedApprover ? "Approver Berwenang" : "Viewer (Read Only)"}
                    </Badge>
                </div>
            </div>

            {/* Batch Selector Tab/Cards jika ada lebih dari 1 */}
            {batches.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
                    {batches.map((b) => (
                        <Button
                            key={b.id}
                            variant={b.id === activeBatchId ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                                setActiveBatchId(b.id)
                                setApproverNotes("")
                            }}
                            className="shrink-0 gap-2 font-mono text-xs"
                        >
                            <span>{b.batchNumber}</span>
                            <Badge
                                variant={b.status === "Approve" ? "outline" : "secondary"}
                                className={
                                    b.status === "Approve"
                                        ? "bg-emerald-100 text-emerald-800 border-none text-[10px]"
                                        : "bg-amber-100 text-amber-800 border-none text-[10px]"
                                }
                            >
                                {b.status}
                            </Badge>
                        </Button>
                    ))}
                </div>
            )}

            {/* Batch Header Info Card */}
            {currentBatch && (
                <Card className="border shadow-sm">
                    <CardHeader className="pb-4 bg-slate-50/50 dark:bg-slate-900/50 border-b">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="space-y-1">
                                <div className="flex items-center gap-3">
                                    <span className="font-mono font-bold text-lg text-slate-900 dark:text-slate-100">
                                        {currentBatch.batchNumber}
                                    </span>
                                    {isBatchApproved ? (
                                        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1">
                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                            Disetujui (Approve)
                                        </Badge>
                                    ) : (
                                        <Badge className="bg-amber-500 hover:bg-amber-600 text-white gap-1">
                                            <Clock className="h-3.5 w-3.5" />
                                            Menunggu Approval SCM
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Diajukan oleh:{" "}
                                    <strong className="text-slate-700 dark:text-slate-300">
                                        {currentBatch.requester?.name || "Pemohon"}
                                    </strong>{" "}
                                    • Tanggal:{" "}
                                    {format(new Date(currentBatch.createdAt), "dd MMMM yyyy, HH:mm")}
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    Target Approver:
                                </span>
                                <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50/50 dark:bg-blue-950/40">
                                    Ali Rahman (SCM Leader Balikpapan)
                                </Badge>
                            </div>
                        </div>

                        {/* Catatan Pemohon */}
                        {currentBatch.userComment && (
                            <div className="mt-3 p-3 bg-white dark:bg-slate-950 border rounded-lg text-xs space-y-1">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                                    Catatan / Permintaan dari Pemohon:
                                </span>
                                <p className="text-slate-800 dark:text-slate-200 italic font-medium">
                                    &ldquo;{currentBatch.userComment}&rdquo;
                                </p>
                            </div>
                        )}
                    </CardHeader>

                    <CardContent className="pt-6 space-y-6">
                        {/* Table of Orders */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                    <Package className="h-4 w-4 text-sky-600" />
                                    Daftar Sales Order Dalam Batch Ini ({batchOrders.length} SO)
                                </h3>

                                {!isBatchApproved && (
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            id="select-all"
                                            checked={
                                                selectedOrderIds.length === batchOrders.length &&
                                                batchOrders.length > 0
                                            }
                                            onCheckedChange={handleSelectAll}
                                        />
                                        <Label htmlFor="select-all" className="text-xs font-medium cursor-pointer">
                                            Pilih Semua ({selectedOrderIds.length}/{batchOrders.length})
                                        </Label>
                                    </div>
                                )}
                            </div>

                            <div className="border rounded-lg overflow-hidden bg-white dark:bg-slate-950">
                                <Table>
                                    <TableHeader className="bg-slate-50 dark:bg-slate-900">
                                        <TableRow>
                                            {!isBatchApproved && <TableHead className="w-12 text-center" />}
                                            <TableHead className="w-36 text-xs font-semibold">No SO</TableHead>
                                            <TableHead className="w-40 text-xs font-semibold">No PO Customer</TableHead>
                                            <TableHead className="min-w-[160px] text-xs font-semibold">Customer</TableHead>
                                            <TableHead className="min-w-[240px] text-xs font-semibold">Rincian Barang & Qty</TableHead>
                                            <TableHead className="w-36 text-xs font-semibold text-center">Status SCM</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {batchOrders.map((order: any) => {
                                            const isChecked = selectedOrderIds.includes(order.id)
                                            return (
                                                <TableRow key={order.id} className="text-xs hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                                                    {!isBatchApproved && (
                                                        <TableCell className="text-center">
                                                            <Checkbox
                                                                checked={isChecked}
                                                                onCheckedChange={() => handleToggleOrder(order.id)}
                                                            />
                                                        </TableCell>
                                                    )}
                                                    <TableCell className="font-mono font-bold text-blue-600">
                                                        {order.invoiceNumber || "-"}
                                                    </TableCell>
                                                    <TableCell className="font-medium text-slate-700 dark:text-slate-300">
                                                        {order.customerPo || "-"}
                                                    </TableCell>
                                                    <TableCell className="font-medium text-slate-900 dark:text-slate-100">
                                                        {order.customer?.name || "-"}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="space-y-1 py-1">
                                                            {order.items?.map((it: any, idx: number) => (
                                                                <div key={idx} className="flex items-center justify-between text-[11px] gap-2">
                                                                    <span className="text-slate-700 dark:text-slate-300 truncate max-w-[280px]">
                                                                        {it.product?.materialDescription || it.description || "Material"}
                                                                    </span>
                                                                    <span className="font-semibold text-slate-900 dark:text-slate-100 shrink-0">
                                                                        {it.quantity} pcs
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {order.shippingApprovalStatus === "Approve" ? (
                                                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                                                                Approve
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                                                Waiting Approve
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Approval Action Box */}
                        {isBatchApproved ? (
                            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg space-y-2">
                                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
                                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                    Batch Ini Sudah Disetujui (Approve)
                                </div>
                                {currentBatch.approverNotes && (
                                    <div className="pl-7 space-y-1">
                                        <span className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider block">
                                            Catatan Arahan dari Approver:
                                        </span>
                                        <p className="text-xs text-emerald-900 dark:text-emerald-100 italic bg-white/60 dark:bg-slate-900/60 p-2.5 rounded border border-emerald-200/50">
                                            &ldquo;{currentBatch.approverNotes}&rdquo;
                                        </p>
                                    </div>
                                )}
                                {currentBatch.approvedAt && (
                                    <p className="pl-7 text-[11px] text-emerald-700 dark:text-emerald-400">
                                        Disetujui pada: {format(new Date(currentBatch.approvedAt), "dd MMMM yyyy, HH:mm")}
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="border rounded-xl p-5 bg-slate-50/70 dark:bg-slate-900/40 space-y-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="approver-notes" className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                        <MessageSquare className="h-4 w-4 text-sky-600" />
                                        Comment / Arahan SCM untuk Pengiriman
                                    </Label>
                                    <Textarea
                                        id="approver-notes"
                                        placeholder="Tuliskan arahan pengiriman untuk tim sales/logistik (misal: 'Dapat diproses pengiriman menggunakan truck tronton hari Senin', atau catatan prioritas)..."
                                        value={approverNotes}
                                        onChange={(e) => setApproverNotes(e.target.value)}
                                        rows={3}
                                        className="resize-none bg-white dark:bg-slate-950 text-sm"
                                        disabled={!isAuthorizedApprover || isApproving}
                                    />
                                </div>

                                {!isAuthorizedApprover && (
                                    <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-3 rounded-lg border border-amber-200">
                                        <ShieldAlert className="h-4 w-4 shrink-0" />
                                        <span>
                                            Anda tidak memiliki otorisasi untuk melakukan approval pengiriman. Hanya Ali Rahman (SCM Leader) atau Admin yang dapat menyetujui.
                                        </span>
                                    </div>
                                )}

                                <div className="flex items-center justify-between pt-2">
                                    <span className="text-xs text-muted-foreground">
                                        {selectedOrderIds.length} Sales Order akan disetujui statusnya menjadi &ldquo;Approve&rdquo;.
                                    </span>

                                    <Button
                                        type="button"
                                        onClick={handleApprove}
                                        disabled={
                                            !isAuthorizedApprover ||
                                            isApproving ||
                                            selectedOrderIds.length === 0
                                        }
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 min-w-[200px]"
                                    >
                                        {isApproving ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Memproses...
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle2 className="h-4 w-4" />
                                                Approve Pengiriman
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
