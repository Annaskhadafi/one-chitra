import { format } from "date-fns"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

type EvhsControlTowerData = {
    summary: {
        receivedQty: number
        reservedQty: number
        usedQty: number
        reversedQty: number
        remainingQty: number
    }
    ledgerRows: Array<{
        id: string
        site: string
        receiptDate: Date | string | null
        reference: string
        materialNumberCp: string
        materialDescription: string | null
        receivedQty: number
        reservedQty: number
        usedQty: number
        reversedQty: number
        remainingQty: number
        ageDays: number
        confirmedBy: string
    }>
    reconciliationByWarehouse: Array<{
        warehouseId: number
        site: string
        receivedQty: number
        reservedQty: number
        usedQty: number
        reversedQty: number
        remainingQty: number
        giQty: number
        invoicedQty: number
        openMrkoQty: number
    }>
    aging: {
        idleStockQty: number
        voucherPendingGiQty: number
        giPendingMrkoQty: number
        mrkoPendingInvoiceQty: number
        buckets: {
            pendingGi: Record<string, number>
            giPendingMrko: Record<string, number>
            mrkoPendingInvoice: Record<string, number>
        }
    }
    exceptionCenter: Array<{
        id: string
        category: string
        severity: "high" | "medium"
        site: string
        reference: string
        detail: string
        ageDays: number
    }>
    auditTrail: Array<{
        id: string
        timestamp: Date | string
        type: string
        actor: string
        reference: string
        detail: string
    }>
}

const formatNumber = (value: number) => value.toLocaleString("id-ID")

const formatDateValue = (value: Date | string | null | undefined) => {
    if (!value) return "-"

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "-"

    return format(date, "dd MMM yyyy")
}

export function EvhsControlTower({ data }: { data: EvhsControlTowerData }) {
    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-5">
                {[
                    { label: "Received", value: data.summary.receivedQty, tone: "text-blue-700 bg-blue-50 border-blue-100" },
                    { label: "Reserved", value: data.summary.reservedQty, tone: "text-amber-700 bg-amber-50 border-amber-100" },
                    { label: "Used", value: data.summary.usedQty, tone: "text-emerald-700 bg-emerald-50 border-emerald-100" },
                    { label: "Reversed", value: data.summary.reversedQty, tone: "text-slate-700 bg-slate-50 border-slate-100" },
                    { label: "Remaining", value: data.summary.remainingQty, tone: "text-indigo-700 bg-indigo-50 border-indigo-100" },
                ].map((item) => (
                    <Card key={item.label} className={item.tone}>
                        <CardContent className="p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide">{item.label}</p>
                            <p className="mt-2 text-2xl font-bold">{formatNumber(item.value)}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Rekonsiliasi Per Site</CardTitle>
                    <CardDescription>Saldo receipt, reservation, usage, GI, MRKO, dan invoice per warehouse VHS.</CardDescription>
                </CardHeader>
                <CardContent className="overflow-auto">
                    <Table className="min-w-[960px]">
                        <TableHeader>
                            <TableRow>
                                <TableHead>Site</TableHead>
                                <TableHead className="text-right">Received</TableHead>
                                <TableHead className="text-right">Reserved</TableHead>
                                <TableHead className="text-right">Used</TableHead>
                                <TableHead className="text-right">Remaining</TableHead>
                                <TableHead className="text-right">GI Qty</TableHead>
                                <TableHead className="text-right">Open MRKO</TableHead>
                                <TableHead className="text-right">Invoiced</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.reconciliationByWarehouse.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-20 text-center text-muted-foreground">
                                        Belum ada data rekonsiliasi EVHS.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                data.reconciliationByWarehouse.map((row) => (
                                    <TableRow key={row.warehouseId}>
                                        <TableCell className="font-medium">{row.site}</TableCell>
                                        <TableCell className="text-right font-mono">{formatNumber(row.receivedQty)}</TableCell>
                                        <TableCell className="text-right font-mono text-amber-700">{formatNumber(row.reservedQty)}</TableCell>
                                        <TableCell className="text-right font-mono text-emerald-700">{formatNumber(row.usedQty)}</TableCell>
                                        <TableCell className="text-right font-mono text-indigo-700">{formatNumber(row.remainingQty)}</TableCell>
                                        <TableCell className="text-right font-mono">{formatNumber(row.giQty)}</TableCell>
                                        <TableCell className="text-right font-mono text-rose-700">{formatNumber(row.openMrkoQty)}</TableCell>
                                        <TableCell className="text-right font-mono text-blue-700">{formatNumber(row.invoicedQty)}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <div className="grid gap-6 xl:grid-cols-[1.3fr,0.9fr]">
                <Card>
                    <CardHeader>
                        <CardTitle>Ledger Stok Per Receipt Item</CardTitle>
                        <CardDescription>Snapshot saldo riil per item penerimaan: received, reserved, used, reversed, dan remaining.</CardDescription>
                    </CardHeader>
                    <CardContent className="overflow-auto">
                        <Table className="min-w-[1080px]">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Tanggal</TableHead>
                                    <TableHead>Site</TableHead>
                                    <TableHead>Reference</TableHead>
                                    <TableHead>Material</TableHead>
                                    <TableHead className="text-right">Received</TableHead>
                                    <TableHead className="text-right">Reserved</TableHead>
                                    <TableHead className="text-right">Used</TableHead>
                                    <TableHead className="text-right">Reversed</TableHead>
                                    <TableHead className="text-right">Remaining</TableHead>
                                    <TableHead className="text-right">Age</TableHead>
                                    <TableHead>Confirmed By</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.ledgerRows.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={11} className="h-20 text-center text-muted-foreground">
                                            Belum ada ledger EVHS.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    data.ledgerRows.map((row) => (
                                        <TableRow key={row.id} className="text-xs">
                                            <TableCell>{formatDateValue(row.receiptDate)}</TableCell>
                                            <TableCell>{row.site}</TableCell>
                                            <TableCell className="font-mono">{row.reference}</TableCell>
                                            <TableCell>
                                                <p className="font-semibold">{row.materialNumberCp}</p>
                                                <p className="text-muted-foreground">{row.materialDescription || "-"}</p>
                                            </TableCell>
                                            <TableCell className="text-right font-mono">{formatNumber(row.receivedQty)}</TableCell>
                                            <TableCell className="text-right font-mono text-amber-700">{formatNumber(row.reservedQty)}</TableCell>
                                            <TableCell className="text-right font-mono text-emerald-700">{formatNumber(row.usedQty)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatNumber(row.reversedQty)}</TableCell>
                                            <TableCell className="text-right font-mono text-indigo-700">{formatNumber(row.remainingQty)}</TableCell>
                                            <TableCell className="text-right font-mono">{row.ageDays} hari</TableCell>
                                            <TableCell>{row.confirmedBy}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Aging Dashboard</CardTitle>
                            <CardDescription>Indikator stok mengendap dan bottleneck proses EVHS.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { label: "Idle Stock >30 Hari", value: data.aging.idleStockQty, tone: "text-indigo-700 bg-indigo-50" },
                                    { label: "Voucher Belum GI", value: data.aging.voucherPendingGiQty, tone: "text-amber-700 bg-amber-50" },
                                    { label: "GI Belum MRKO", value: data.aging.giPendingMrkoQty, tone: "text-rose-700 bg-rose-50" },
                                    { label: "MRKO Belum Invoice", value: data.aging.mrkoPendingInvoiceQty, tone: "text-blue-700 bg-blue-50" },
                                ].map((item) => (
                                    <div key={item.label} className={`rounded-lg border p-3 ${item.tone}`}>
                                        <p className="text-[11px] font-semibold uppercase tracking-wide">{item.label}</p>
                                        <p className="mt-2 text-xl font-bold">{formatNumber(item.value)}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="space-y-3 text-xs">
                                {[
                                    { label: "Pending GI", buckets: data.aging.buckets.pendingGi },
                                    { label: "Pending MRKO", buckets: data.aging.buckets.giPendingMrko },
                                    { label: "Pending Invoice", buckets: data.aging.buckets.mrkoPendingInvoice },
                                ].map((group) => (
                                    <div key={group.label} className="rounded-lg border p-3">
                                        <p className="font-semibold text-slate-700">{group.label}</p>
                                        <div className="mt-2 grid grid-cols-3 gap-2">
                                            {Object.entries(group.buckets).map(([bucket, value]) => (
                                                <div key={bucket} className="rounded bg-slate-50 p-2 text-center">
                                                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{bucket}</p>
                                                    <p className="font-bold">{formatNumber(value)}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Audit Trail</CardTitle>
                            <CardDescription>Event penerimaan, voucher, update, dan settlement terbaru.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {data.auditTrail.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Belum ada aktivitas EVHS tercatat.</p>
                            ) : (
                                data.auditTrail.map((event) => (
                                    <div key={event.id} className="rounded-lg border p-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold">{event.type}</p>
                                                <p className="text-xs text-muted-foreground">{event.reference}</p>
                                            </div>
                                            <Badge variant="outline">{formatDateValue(event.timestamp)}</Badge>
                                        </div>
                                        <p className="mt-2 text-xs text-slate-700">{event.detail}</p>
                                        <p className="mt-1 text-[11px] text-muted-foreground">Actor: {event.actor}</p>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Exception Center</CardTitle>
                    <CardDescription>Duplicate SN, over-issued qty, material CK missing, GI unmatched, dan MRKO overdue.</CardDescription>
                </CardHeader>
                <CardContent className="overflow-auto">
                    <Table className="min-w-[900px]">
                        <TableHeader>
                            <TableRow>
                                <TableHead>Kategori</TableHead>
                                <TableHead>Severity</TableHead>
                                <TableHead>Site</TableHead>
                                <TableHead>Reference</TableHead>
                                <TableHead>Detail</TableHead>
                                <TableHead className="text-right">Age</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.exceptionCenter.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">
                                        Tidak ada exception EVHS yang perlu ditindak.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                data.exceptionCenter.map((item) => (
                                    <TableRow key={item.id} className="text-xs">
                                        <TableCell className="font-semibold">{item.category}</TableCell>
                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                className={item.severity === "high"
                                                    ? "border-rose-200 bg-rose-50 text-rose-700"
                                                    : "border-amber-200 bg-amber-50 text-amber-700"}
                                            >
                                                {item.severity}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{item.site}</TableCell>
                                        <TableCell className="font-mono">{item.reference}</TableCell>
                                        <TableCell>{item.detail}</TableCell>
                                        <TableCell className="text-right font-mono">{item.ageDays} hari</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
