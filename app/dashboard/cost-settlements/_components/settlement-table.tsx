"use client"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type SettlementRow = Awaited<ReturnType<typeof import("@/app/actions/cost-settlement").getSettlements>>[number]

const formatCurrency = (value: string | number) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(Number(value ?? 0))

const formatDate = (value: string | Date) => {
    const date = typeof value === "string" ? new Date(value) : value
    return date.toLocaleDateString("id-ID")
}

const statusVariant = (status: SettlementRow["status"]) => {
    if (status === "approved" || status === "posted") return "default"
    if (status === "rejected") return "destructive"
    if (status === "submitted") return "secondary"
    return "outline"
}

export function SettlementTable({ data }: { data: SettlementRow[] }) {
    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between gap-3">
                    <CardTitle>Settlement List</CardTitle>
                    <Button asChild>
                        <Link href="/dashboard/cost-settlements/create">Buat Settlement</Link>
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[920px] text-sm">
                        <thead>
                            <tr className="border-b text-left text-muted-foreground">
                                <th className="px-3 py-2 font-medium">No. Settlement</th>
                                <th className="px-3 py-2 font-medium">Tipe</th>
                                <th className="px-3 py-2 font-medium">Referensi</th>
                                <th className="px-3 py-2 font-medium">Tanggal</th>
                                <th className="px-3 py-2 font-medium">Driver</th>
                                <th className="px-3 py-2 font-medium">Uang Muka</th>
                                <th className="px-3 py-2 font-medium">Aktual</th>
                                <th className="px-3 py-2 font-medium">Selisih</th>
                                <th className="px-3 py-2 font-medium">Status</th>
                                <th className="px-3 py-2 font-medium">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.length === 0 ? (
                                <tr>
                                    <td className="px-3 py-6 text-center text-muted-foreground" colSpan={10}>
                                        Belum ada data settlement.
                                    </td>
                                </tr>
                            ) : data.map((row) => (
                                <tr key={row.id} className="border-b last:border-b-0">
                                    <td className="px-3 py-2 font-medium">{row.settlementNumber}</td>
                                    <td className="px-3 py-2 uppercase">{row.settlementType}</td>
                                    <td className="px-3 py-2">
                                        {row.settlementType === "trip"
                                            ? row.fleetTrip?.tripNumber || "-"
                                            : row.delivery?.deliveryNumber || "-"}
                                    </td>
                                    <td className="px-3 py-2">{formatDate(row.settlementDate)}</td>
                                    <td className="px-3 py-2">{row.driverName || "-"}</td>
                                    <td className="px-3 py-2">{formatCurrency(row.advanceAmount)}</td>
                                    <td className="px-3 py-2">{formatCurrency(row.totalActualAmount)}</td>
                                    <td className="px-3 py-2">{formatCurrency(row.varianceAmount)}</td>
                                    <td className="px-3 py-2">
                                        <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                                    </td>
                                    <td className="px-3 py-2">
                                        <Button asChild size="sm" variant="outline">
                                            <Link href={`/dashboard/cost-settlements/${row.id}`}>Detail</Link>
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    )
}
