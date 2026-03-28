import Link from "next/link"
import { notFound } from "next/navigation"
import { getDelivery } from "@/app/actions/delivery"
import { AutoCloseSidebar } from "@/components/auto-close-sidebar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { ArrowLeft, FileText, Truck } from "lucide-react"

function formatDate(value: Date | string | null) {
    if (!value) return "-"
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return "-"
    return date.toLocaleDateString("id-ID")
}

function statusVariant(status: string | null) {
    const normalized = (status ?? "").toLowerCase()
    if (normalized === "delivered" || normalized === "completed") return "default"
    if (normalized === "cancelled") return "destructive"
    return "secondary"
}

export default async function DeliveryViewPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const delivery = await getDelivery(Number(id))

    if (!delivery) return notFound()

    return (
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-8 lg:p-10">
            <AutoCloseSidebar />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <Truck className="h-5 w-5 text-primary" />
                        <h1 className="text-xl font-bold tracking-tight">{delivery.deliveryNumber || "Delivery Detail"}</h1>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Halaman view-only untuk role yang hanya punya akses melihat delivery.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Link href="/dashboard/summary-order">
                        <Button variant="outline" size="sm">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Kembali
                        </Button>
                    </Link>
                    <Link href={`/dashboard/sales-orders/${delivery.salesOrderId}/edit`}>
                        <Button variant="outline" size="sm">
                            <FileText className="mr-2 h-4 w-4" />
                            Lihat SO
                        </Button>
                    </Link>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Status Delivery</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Badge variant={statusVariant(delivery.status)}>{delivery.status || "-"}</Badge>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Date Delivery</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm font-medium">{formatDate(delivery.deliveryDate ?? delivery.scheduledDate)}</CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">DO SAP</CardTitle>
                    </CardHeader>
                    <CardContent className="font-mono text-sm">{delivery.doSap || "-"}</CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Customer</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm font-medium">{delivery.salesOrder?.customer?.name || "-"}</CardContent>
                </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Informasi Utama</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-muted-foreground">No. Delivery</span>
                            <span className="font-mono">{delivery.deliveryNumber || "-"}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-muted-foreground">No. SO</span>
                            <Link href={`/dashboard/sales-orders/${delivery.salesOrderId}/edit`} className="font-mono text-blue-600 hover:underline">
                                {delivery.salesOrder?.invoiceNumber || "-"}
                            </Link>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-muted-foreground">No. PO</span>
                            <span className="font-mono">{delivery.salesOrder?.customerPo || "-"}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-muted-foreground">Warehouse</span>
                            <span>{delivery.warehouse ? `${delivery.warehouse.sloc} - ${delivery.warehouse.description}` : "-"}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-muted-foreground">Driver</span>
                            <span>{delivery.driverName || "-"}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-muted-foreground">Vehicle</span>
                            <span>{delivery.vehicleNumber || "-"}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Alamat & Catatan</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                        <div>
                            <p className="mb-1 text-muted-foreground">Shipping Address</p>
                            <p>{delivery.shippingAddress || "-"}</p>
                        </div>
                        <div>
                            <p className="mb-1 text-muted-foreground">Notes</p>
                            <p>{delivery.notes || "-"}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Detail Product Delivery</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Material No</TableHead>
                                    <TableHead>Product</TableHead>
                                    <TableHead>Qty Order</TableHead>
                                    <TableHead>Qty Delivery</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {delivery.items.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-mono text-xs">{item.product?.materialNumber || "-"}</TableCell>
                                        <TableCell>{item.product?.materialDescription || "-"}</TableCell>
                                        <TableCell>{item.orderedQuantity}</TableCell>
                                        <TableCell>{item.deliveredQuantity}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
