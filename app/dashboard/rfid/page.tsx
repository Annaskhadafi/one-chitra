import { format } from "date-fns"
import { Link2, Package, RadioTower, Signal } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { getRfidScanRows } from "@/lib/rfid"

export const dynamic = "force-dynamic"

const formatDate = (value: Date | string) => format(new Date(value), "dd MMM yyyy HH:mm")

export default async function RfidPage() {
    const rows = await getRfidScanRows()
    const linkedCount = rows.filter((row) => row.linked).length
    const uniqueMaterials = new Set(rows.map((row) => row.materialNumber).filter(Boolean)).size
    const latestScan = rows[0]?.scannedAt ? formatDate(rows[0].scannedAt) : "-"

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            <div className="flex flex-col gap-1">
                <h1 className="text-balance text-2xl font-bold tracking-tight">RFID</h1>
                <p className="text-pretty text-muted-foreground">
                    Data scan RFID material dari handheld.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Scan</CardTitle>
                        <RadioTower className="size-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold tabular-nums">{rows.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Linked</CardTitle>
                        <Link2 className="size-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold tabular-nums">{linkedCount}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Material</CardTitle>
                        <Package className="size-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold tabular-nums">{uniqueMaterials}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Scan Terakhir</CardTitle>
                        <Signal className="size-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-sm font-semibold tabular-nums">{latestScan}</div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Data RFID</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Created At</TableHead>
                                    <TableHead>Material</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>SLoc</TableHead>
                                    <TableHead>SN</TableHead>
                                    <TableHead>EPC</TableHead>
                                    <TableHead>RSSI</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Act Stock</TableHead>
                                    <TableHead>Created By</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                                            Belum ada data RFID.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    rows.map((row) => (
                                        <TableRow key={row.id}>
                                            <TableCell className="tabular-nums">{formatDate(row.scannedAt)}</TableCell>
                                            <TableCell>
                                                <div className="font-medium">{row.materialNumber ?? "-"}</div>
                                                <div className="text-xs text-muted-foreground">{row.category ?? "-"}</div>
                                            </TableCell>
                                            <TableCell className="max-w-[280px] truncate" title={row.materialDescription ?? undefined}>
                                                {row.materialDescription ?? "-"}
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium tabular-nums">{row.sloc ?? "-"}</div>
                                                <div className="text-xs text-muted-foreground">{row.slocDescription ?? "-"}</div>
                                            </TableCell>
                                            <TableCell className="font-medium tabular-nums">{row.serialNumber ?? "-"}</TableCell>
                                            <TableCell className="font-mono text-xs">{row.epc ?? row.tagId}</TableCell>
                                            <TableCell className="tabular-nums">{row.rssi ?? "-"}</TableCell>
                                            <TableCell>
                                                <Badge variant={row.linked ? "success" : "secondary"}>
                                                    {row.linked ? "Linked" : "Unlinked"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">{row.actStock ?? "-"}</TableCell>
                                            <TableCell>{row.createdBy ?? "-"}</TableCell>
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
