"use client"

import { useMemo, useState, useTransition } from "react"
import { Search } from "lucide-react"
import { toast } from "sonner"

import {
    getRfidTraceabilityLookup,
    searchRfidTraceability,
} from "@/app/actions/rfid"
import { TrackingModeBadge } from "@/components/rfid/tracking-mode-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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

type TraceabilityLookup = Awaited<ReturnType<typeof getRfidTraceabilityLookup>>
type TraceabilityResult = Awaited<ReturnType<typeof searchRfidTraceability>>

type RfidTraceabilityConsoleProps = {
    lookup: TraceabilityLookup
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

export function RfidTraceabilityConsole({ lookup }: RfidTraceabilityConsoleProps) {
    const [query, setQuery] = useState("")
    const [warehouseId, setWarehouseId] = useState("all")
    const [result, setResult] = useState<TraceabilityResult | null>(null)
    const [isPending, startTransition] = useTransition()

    const statCards = useMemo(() => {
        if (!result) {
            return []
        }

        return [
            { label: "Matched Tags", value: result.matchedTags.length },
            { label: "Matched Units", value: result.matchedUnits.length },
            { label: "Binding History", value: result.bindings.length },
            { label: "Unit Events", value: result.unitEvents.length },
            { label: "Scan Events", value: result.scanEvents.length },
            { label: "Write Sessions", value: result.writeSessions.length },
        ]
    }, [result])

    const handleSearch = () => {
        if (!query.trim()) {
            toast.error("Masukkan EPC, serial number, atau material number dulu")
            return
        }

        startTransition(async () => {
            const response = await searchRfidTraceability({
                query,
                warehouseId: warehouseId === "all" ? null : Number(warehouseId),
            })

            setResult(response)
            if (
                response.matchedTags.length === 0 &&
                response.matchedUnits.length === 0 &&
                response.bindings.length === 0 &&
                response.unitEvents.length === 0 &&
                response.scanEvents.length === 0 &&
                response.writeSessions.length === 0 &&
                response.exceptions.length === 0
            ) {
                toast.info("Belum ada data yang cocok untuk pencarian ini")
            }
        })
    }

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            <div className="space-y-1">
                <h1 className="text-2xl font-bold tracking-tight">RFID Traceability</h1>
                <p className="text-sm text-muted-foreground">
                    Cari berdasarkan EPC, serial number, atau material number untuk melihat hubungan tag, unit, dan histori operasionalnya.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Pencarian Traceability</CardTitle>
                    <CardDescription>
                        Gunakan pencarian ini untuk investigasi tag, validasi histori tire, atau melacak material yang sudah pernah ditulis ke RFID.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-[1fr,220px,auto]">
                        <div className="space-y-2">
                            <Label>Kata Kunci</Label>
                            <Input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Contoh: EPC, SN-TIRE-001, atau material number"
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                        event.preventDefault()
                                        handleSearch()
                                    }
                                }}
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
                                    {lookup.warehouses.map((warehouse) => (
                                        <SelectItem key={warehouse.id} value={String(warehouse.id)}>
                                            {warehouse.sloc} - {warehouse.description || "-"}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-end">
                            <Button onClick={handleSearch} disabled={isPending} className="w-full md:w-auto">
                                <Search className="mr-2 h-4 w-4" />
                                Cari
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {result && (
                <>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {statCards.map((stat) => (
                            <Card key={stat.label}>
                                <CardContent className="p-6">
                                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                                    <p className="mt-2 text-3xl font-bold">{stat.value}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <div className="grid gap-6 xl:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Matched Tags</CardTitle>
                                <CardDescription>
                                    Tag yang cocok dengan EPC, serial memory, atau material memory dari pencarian.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {result.matchedTags.length === 0 ? (
                                    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                                        Tidak ada tag yang cocok.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {result.matchedTags.map((tag) => (
                                            <div key={tag.id} className="rounded-lg border p-4">
                                                <div className="font-mono text-sm font-semibold">{tag.epc}</div>
                                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                                    <Badge variant="outline" className="capitalize">
                                                        {formatEnumLabel(tag.status)}
                                                    </Badge>
                                                    {tag.isReusable && <Badge variant="secondary">Reusable</Badge>}
                                                </div>
                                                <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
                                                    <div>Material memory: {tag.memoryMaterialNumber || "-"}</div>
                                                    <div>Serial memory: {tag.memorySerialNumber || "-"}</div>
                                                    <div>TID: {tag.tid || "-"}</div>
                                                    <div>Warehouse terakhir: {tag.lastSeenWarehouse?.sloc || "-"}</div>
                                                    <div>Last seen: {formatDateTime(tag.lastSeenAt)}</div>
                                                    <div>Tag serial: {tag.tagSerial || "-"}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Matched Units</CardTitle>
                                <CardDescription>
                                    Unit inventory yang cocok dengan serial number, material number, atau tag yang sedang terpasang.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {result.matchedUnits.length === 0 ? (
                                    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                                        Tidak ada unit yang cocok.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {result.matchedUnits.map((unit) => (
                                            <div key={unit.id} className="rounded-lg border p-4">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="font-semibold">
                                                        {unit.product?.materialNumber || `Unit #${unit.id}`}
                                                    </span>
                                                    <TrackingModeBadge mode={unit.trackingMode} />
                                                    <Badge variant="outline" className="capitalize">
                                                        {formatEnumLabel(unit.status)}
                                                    </Badge>
                                                </div>
                                                <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
                                                    <div>Serial unit: {unit.serialNumber || "-"}</div>
                                                    <div>Warehouse: {unit.warehouse?.sloc || "-"}</div>
                                                    <div>Zona: {unit.zone?.zoneName || "-"}</div>
                                                    <div>Current tag: {unit.currentTag?.epc || "-"}</div>
                                                    <div>Produk: {unit.product?.materialDescription || "-"}</div>
                                                    <div>Last movement: {formatDateTime(unit.lastMovementAt)}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-6 xl:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Binding History</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="rounded-lg border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Tag</TableHead>
                                                <TableHead>Unit</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Bound At</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {result.bindings.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={4} className="h-24 text-center text-sm text-muted-foreground">
                                                        Belum ada binding history.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                result.bindings.map((binding) => (
                                                    <TableRow key={binding.id}>
                                                        <TableCell className="font-mono text-xs">{binding.rfidTag?.epc || "-"}</TableCell>
                                                        <TableCell className="text-xs text-muted-foreground">
                                                            <div>{binding.inventoryUnit?.product?.materialNumber || "-"}</div>
                                                            <div>{binding.inventoryUnit?.serialNumber || "-"}</div>
                                                        </TableCell>
                                                        <TableCell className="capitalize">{formatEnumLabel(binding.status)}</TableCell>
                                                        <TableCell className="text-xs text-muted-foreground">{formatDateTime(binding.boundAt)}</TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Open Exceptions</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="rounded-lg border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Type</TableHead>
                                                <TableHead>Severity</TableHead>
                                                <TableHead>Warehouse</TableHead>
                                                <TableHead>Created</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {result.exceptions.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={4} className="h-24 text-center text-sm text-muted-foreground">
                                                        Tidak ada exception terkait.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                result.exceptions.map((exception) => (
                                                    <TableRow key={exception.id}>
                                                        <TableCell>{exception.exceptionType}</TableCell>
                                                        <TableCell className="capitalize">{formatEnumLabel(exception.severity)}</TableCell>
                                                        <TableCell>{exception.warehouse?.sloc || "-"}</TableCell>
                                                        <TableCell className="text-xs text-muted-foreground">{formatDateTime(exception.createdAt)}</TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Inventory Unit Events</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="rounded-lg border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Operation</TableHead>
                                                <TableHead>Product / Unit</TableHead>
                                                <TableHead>Tag</TableHead>
                                                <TableHead>Warehouse</TableHead>
                                                <TableHead>Created</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {result.unitEvents.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
                                                        Belum ada event unit terkait.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                result.unitEvents.map((event) => (
                                                    <TableRow key={event.id}>
                                                        <TableCell className="capitalize">{formatEnumLabel(event.operationType)}</TableCell>
                                                        <TableCell className="text-xs text-muted-foreground">
                                                            <div>{event.product?.materialNumber || "-"}</div>
                                                            <div>{event.inventoryUnit?.serialNumber || "-"}</div>
                                                        </TableCell>
                                                        <TableCell className="font-mono text-xs">{event.rfidTag?.epc || "-"}</TableCell>
                                                        <TableCell>{event.warehouse?.sloc || "-"}</TableCell>
                                                        <TableCell className="text-xs text-muted-foreground">{formatDateTime(event.createdAt)}</TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="grid gap-6 xl:grid-cols-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Scan History</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="rounded-lg border">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>EPC</TableHead>
                                                    <TableHead>Result</TableHead>
                                                    <TableHead>Session</TableHead>
                                                    <TableHead>Last Seen</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {result.scanEvents.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={4} className="h-24 text-center text-sm text-muted-foreground">
                                                            Belum ada scan history terkait.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    result.scanEvents.map((scanEvent) => (
                                                        <TableRow key={scanEvent.id}>
                                                            <TableCell className="font-mono text-xs">{scanEvent.epc}</TableCell>
                                                            <TableCell className="capitalize">{formatEnumLabel(scanEvent.scanResult)}</TableCell>
                                                            <TableCell className="text-xs text-muted-foreground">
                                                                <div>{scanEvent.session?.sessionCode || "-"}</div>
                                                                <div>{scanEvent.session?.device?.deviceName || "-"}</div>
                                                            </TableCell>
                                                            <TableCell className="text-xs text-muted-foreground">{formatDateTime(scanEvent.lastSeenAt)}</TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Write History</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="rounded-lg border">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Operation</TableHead>
                                                    <TableHead>Tag / Material</TableHead>
                                                    <TableHead>Device</TableHead>
                                                    <TableHead>Executed</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {result.writeSessions.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={4} className="h-24 text-center text-sm text-muted-foreground">
                                                            Belum ada write history terkait.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    result.writeSessions.map((writeSession) => (
                                                        <TableRow key={writeSession.id}>
                                                            <TableCell className="capitalize">{formatEnumLabel(writeSession.operationType)}</TableCell>
                                                            <TableCell className="text-xs text-muted-foreground">
                                                                <div className="font-mono text-foreground">{writeSession.rfidTag?.epc || "-"}</div>
                                                                <div>{writeSession.materialNumber || writeSession.inventoryUnit?.product?.materialNumber || "-"}</div>
                                                            </TableCell>
                                                            <TableCell>{writeSession.device?.deviceName || "Manual / Web"}</TableCell>
                                                            <TableCell className="text-xs text-muted-foreground">{formatDateTime(writeSession.executedAt)}</TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
