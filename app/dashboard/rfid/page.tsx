import Link from "next/link"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Camera, Link2, Package, RadioTower, Signal } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getRfidScanRows } from "@/lib/rfid"

import { RfidTableClient } from "./_components/rfid-table-client"

export const dynamic = "force-dynamic"

const formatDate = (value: Date | string) => format(new Date(value), "dd MMM yyyy HH:mm")

export default async function RfidPage() {
    const rows = await getRfidScanRows()
    const linkedCount = rows.filter((row) => row.linked).length
    const uniqueMaterials = new Set(rows.map((row) => row.materialNumber).filter(Boolean)).size
    const latestScan = rows[0]?.scannedAt ? formatDate(rows[0].scannedAt) : "-"

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-balance text-2xl font-bold tracking-tight">RFID</h1>
                    <p className="text-pretty text-muted-foreground">
                        Data scan RFID material dari handheld, kelola dan pantau keterhubungan data stok.
                    </p>
                </div>
                <div>
                    <Button asChild size="lg" className="gap-2 font-semibold shadow">
                        <Link href="/dashboard/rfid/tire-scan">
                            <Camera className="size-5" />
                            <span>Scan Tire SN (OCR)</span>
                        </Link>
                    </Button>
                </div>
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

            <RfidTableClient initialRows={rows} />
        </div>
    )
}
