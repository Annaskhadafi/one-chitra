import { notFound } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getStockCardDetail } from "@/lib/stock-card"
import { Boxes, CalendarClock, MapPin, Users } from "lucide-react"

type StockCardDetailPageProps = {
    params: Promise<{ stockId: string }> | { stockId: string }
}

function statusLabel(status: string | null) {
    if (!status) return "-"

    const normalized = status.toLowerCase()
    if (normalized === "history") return "History Order"
    if (normalized === "delivered") return "Delivered"
    if (normalized === "ready") return "Ready"
    if (normalized === "scheduled") return "Scheduled"
    if (normalized === "partial") return "Partial"
    if (normalized === "cancelled") return "Cancelled"

    return status
}

function statusVariant(status: string | null): "outline" | "secondary" | "success" | "warning" | "destructive" {
    if (!status) return "outline"

    const normalized = status.toLowerCase()
    if (normalized === "delivered") return "success"
    if (normalized === "ready" || normalized === "partial") return "warning"
    if (normalized === "cancelled") return "destructive"
    if (normalized === "scheduled") return "secondary"

    return "outline"
}

export default async function StockCardDetailPage({ params }: StockCardDetailPageProps) {
    const resolvedParams = params instanceof Promise ? await params : params
    const stockId = Number.parseInt(resolvedParams.stockId, 10)

    if (!Number.isFinite(stockId)) {
        notFound()
    }

    const detail = await getStockCardDetail(stockId)

    if (!detail) {
        notFound()
    }

    return (
        <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eff6ff_45%,#ffffff_100%)] px-4 py-8 sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-6xl flex-col gap-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                            <Badge variant="outline">Stock Card</Badge>
                            <Badge variant="secondary">{detail.warehouseType || "Warehouse"}</Badge>
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                            {detail.materialDescription || "Produk tanpa deskripsi"}
                        </h1>
                        <p className="mt-2 text-sm text-slate-600">
                            Material Number {detail.materialNumber}
                            {detail.oldMaterialNo ? ` | Old Number ${detail.oldMaterialNo}` : ""}
                        </p>
                    </div>

                    <div className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm">
                        Stock ID #{detail.stockId}
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                    <Card className="border-blue-200/60 bg-blue-50/70">
                        <CardHeader className="pb-3">
                            <CardDescription>Warehouse</CardDescription>
                            <CardTitle className="text-lg">
                                {detail.warehouseCode}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-slate-600">
                            {detail.warehouseName || "Gudang tanpa nama"}
                        </CardContent>
                    </Card>

                    <Card className="border-emerald-200/60 bg-emerald-50/70">
                        <CardHeader className="pb-3">
                            <CardDescription>Qty Saat Ini</CardDescription>
                            <CardTitle className="text-lg">
                                {detail.currentQty.toLocaleString("id-ID")}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-slate-600">
                            Qty pada warehouse sticker ini
                        </CardContent>
                    </Card>

                    <Card className="border-amber-200/60 bg-amber-50/70">
                        <CardHeader className="pb-3">
                            <CardDescription>Total Semua Warehouse</CardDescription>
                            <CardTitle className="text-lg">
                                {detail.totalQtyAllWarehouses.toLocaleString("id-ID")}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-slate-600">
                            Akumulasi stok material yang sama
                        </CardContent>
                    </Card>

                    <Card className="border-violet-200/60 bg-violet-50/70">
                        <CardHeader className="pb-3">
                            <CardDescription>Customer Tercatat</CardDescription>
                            <CardTitle className="text-lg">
                                {detail.uniqueCustomerCount.toLocaleString("id-ID")}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-slate-600">
                            Update terakhir {detail.latestDeliveryDate || "-"}
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-6 lg:grid-cols-[1.1fr_1.9fr]">
                    <Card className="border-slate-200/70">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <MapPin className="h-5 w-5 text-sky-600" />
                                Sebaran Stok per Warehouse
                            </CardTitle>
                            <CardDescription>
                                Menampilkan posisi stok material ini di setiap warehouse.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {detail.warehouseStocks.map((warehouse) => (
                                <div
                                    key={warehouse.warehouseId}
                                    className="rounded-xl border border-slate-200 bg-white px-4 py-3"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="font-semibold text-slate-900">
                                                {warehouse.warehouseCode}
                                                {warehouse.warehouseName ? ` - ${warehouse.warehouseName}` : ""}
                                            </div>
                                            <div className="mt-1 text-xs text-slate-500">
                                                {warehouse.warehouseType || "Warehouse"}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-lg font-bold text-slate-900">
                                                {warehouse.qty.toLocaleString("id-ID")}
                                            </div>
                                            <div className="text-xs text-slate-500">Qty</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    <Card className="border-slate-200/70">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <CalendarClock className="h-5 w-5 text-emerald-600" />
                                History Order & Delivery
                            </CardTitle>
                            <CardDescription>
                                Tanpa price. Sumber data diambil dari delivery internal dan histori order SAP.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {detail.history.length ? (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                                                <th className="pb-3 pr-4 font-medium">Tanggal</th>
                                                <th className="pb-3 pr-4 font-medium">Customer</th>
                                                <th className="pb-3 pr-4 font-medium">Qty</th>
                                                <th className="pb-3 pr-4 font-medium">Ref</th>
                                                <th className="pb-3 pr-4 font-medium">Order</th>
                                                <th className="pb-3 pr-4 font-medium">Warehouse</th>
                                                <th className="pb-3 font-medium">Sumber</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {detail.history.map((item, index) => (
                                                <tr key={`${item.source}-${item.referenceNumber}-${index}`} className="border-b border-slate-100 align-top">
                                                    <td className="py-3 pr-4 text-slate-700">
                                                        {item.deliveryDate || "-"}
                                                    </td>
                                                    <td className="py-3 pr-4">
                                                        <div className="font-medium text-slate-900">{item.customerName}</div>
                                                        <div className="mt-1 text-xs text-slate-500">
                                                            {statusLabel(item.status)}
                                                        </div>
                                                    </td>
                                                    <td className="py-3 pr-4 font-mono text-slate-900">
                                                        {item.qty.toLocaleString("id-ID")}
                                                    </td>
                                                    <td className="py-3 pr-4 text-slate-700">
                                                        {item.referenceNumber || "-"}
                                                    </td>
                                                    <td className="py-3 pr-4 text-slate-700">
                                                        {item.orderNumber || "-"}
                                                    </td>
                                                    <td className="py-3 pr-4 text-slate-700">
                                                        {item.warehouseLabel || "-"}
                                                    </td>
                                                    <td className="py-3">
                                                        <Badge variant={statusVariant(item.status)}>
                                                            {item.source === "delivery" ? "Delivery" : "History Order"}
                                                        </Badge>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center">
                                    <Users className="h-8 w-8 text-slate-300" />
                                    <p className="mt-3 font-medium text-slate-700">Belum ada history yang tercatat</p>
                                    <p className="mt-1 max-w-md text-sm text-slate-500">
                                        Saat ini stock card belum menemukan data order atau delivery untuk material ini.
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <Card className="border-slate-200/70">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Boxes className="h-5 w-5 text-indigo-600" />
                            Identitas Material
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-3">
                        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Material Number</div>
                            <div className="mt-2 break-all text-base font-semibold text-slate-900">
                                {detail.materialNumber}
                            </div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Material Old Number</div>
                            <div className="mt-2 text-base font-semibold text-slate-900">
                                {detail.oldMaterialNo || "-"}
                            </div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Warehouse Sticker</div>
                            <div className="mt-2 text-base font-semibold text-slate-900">
                                {detail.warehouseCode}
                                {detail.warehouseName ? ` - ${detail.warehouseName}` : ""}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
