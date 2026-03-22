"use client"

import { useMemo, useState } from "react"

import { getRfidTaggedUnitsOverview } from "@/app/actions/rfid"
import { TrackingModeBadge } from "@/components/rfid/tracking-mode-badge"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

type TaggedUnitsData = Awaited<ReturnType<typeof getRfidTaggedUnitsOverview>>
type WarehouseOption = {
    id: number
    sloc: string
    description: string | null
    type: string | null
}

type RfidTaggedUnitsConsoleProps = {
    data: TaggedUnitsData
    warehouses: WarehouseOption[]
}

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

export function RfidTaggedUnitsConsole({ data, warehouses }: RfidTaggedUnitsConsoleProps) {
    const [query, setQuery] = useState("")
    const [warehouseId, setWarehouseId] = useState("all")

    const filteredItems = useMemo(() => {
        const normalizedQuery = query.trim().toUpperCase()

        return data.items.filter((item) => {
            if (warehouseId !== "all" && String(item.warehouseId) !== warehouseId) {
                return false
            }

            if (!normalizedQuery) {
                return true
            }

            const haystack = [
                item.product?.materialNumber,
                item.product?.materialDescription,
                item.serialNumber,
                item.currentTag?.epc,
                item.currentTag?.memorySerialNumber,
                item.currentTag?.memoryMaterialNumber,
                item.warehouse?.sloc,
                item.warehouse?.description,
                item.zone?.zoneName,
            ]
                .filter(Boolean)
                .join(" ")
                .toUpperCase()

            return haystack.includes(normalizedQuery)
        })
    }, [data.items, query, warehouseId])

    const statCards = useMemo(
        () => [
            { label: "Tagged Units", value: data.totals.taggedUnits },
            { label: "Active Tags", value: data.totals.activeTags },
            { label: "Reusable Tags", value: data.totals.reusableTags },
            { label: "Warehouses", value: data.totals.warehouseCount },
        ],
        [data.totals],
    )

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            <div className="space-y-1">
                <h1 className="text-2xl font-bold tracking-tight">RFID Tagged Units</h1>
                <p className="text-sm text-muted-foreground">
                    Lihat semua barang yang saat ini sudah memiliki RFID tag aktif, lengkap dengan material, serial number, EPC, warehouse, dan status unitnya.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {statCards.map((stat) => (
                    <Card key={stat.label}>
                        <CardContent className="p-6">
                            <p className="text-sm text-muted-foreground">{stat.label}</p>
                            <p className="mt-2 text-3xl font-bold">{stat.value}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Daftar Barang Bertag RFID</CardTitle>
                    <CardDescription>
                        Gunakan pencarian untuk memfilter berdasarkan material number, deskripsi, serial number, EPC, atau warehouse.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-[1fr,280px]">
                        <div className="space-y-2">
                            <Label>Pencarian</Label>
                            <Input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Cari material, serial number, EPC, atau warehouse"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Warehouse</Label>
                            <Select value={warehouseId} onValueChange={setWarehouseId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Semua warehouse" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua warehouse</SelectItem>
                                    {warehouses.map((warehouse) => (
                                        <SelectItem key={warehouse.id} value={String(warehouse.id)}>
                                            {warehouse.sloc} - {warehouse.description || "-"}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Warehouse</TableHead>
                                    <TableHead>Product / Material</TableHead>
                                    <TableHead>Serial Unit</TableHead>
                                    <TableHead>EPC</TableHead>
                                    <TableHead>Status Tag</TableHead>
                                    <TableHead>Status Unit</TableHead>
                                    <TableHead>Tracking</TableHead>
                                    <TableHead>Last Seen</TableHead>
                                    <TableHead>Last Movement</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredItems.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="h-24 text-center text-sm text-muted-foreground">
                                            Belum ada barang bertag RFID yang cocok dengan filter ini.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredItems.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell>
                                                <div className="min-w-[140px]">
                                                    <div className="font-medium">{item.warehouse?.sloc || "-"}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {item.warehouse?.description || "-"}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="min-w-[220px]">
                                                    <div className="font-medium">
                                                        {item.product?.materialNumber || "-"}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {item.product?.materialDescription || "-"}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="min-w-[140px] font-mono text-xs">
                                                    {item.serialNumber || "-"}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="min-w-[180px] font-mono text-xs">
                                                    {item.currentTag?.epc || "-"}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    Memory SN: {item.currentTag?.memorySerialNumber || "-"}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap gap-2">
                                                    <Badge variant="outline" className="capitalize">
                                                        {formatEnumLabel(item.currentTag?.status)}
                                                    </Badge>
                                                    {item.currentTag?.isReusable ? (
                                                        <Badge variant="secondary">Reusable</Badge>
                                                    ) : null}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="capitalize">
                                                    {formatEnumLabel(item.status)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <TrackingModeBadge mode={item.trackingMode} />
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-xs">
                                                    {formatDateTime(item.currentTag?.lastSeenAt)}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    Zona: {item.zone?.zoneName || "-"}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-xs">
                                                    {formatDateTime(item.lastMovementAt)}
                                                </div>
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
