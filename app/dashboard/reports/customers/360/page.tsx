import { db } from "@/db"
import { customers } from "@/db/schema/customers"
import { salesOrders, salesOrderItems } from "@/db/schema/sales-orders"
import { products } from "@/db/schema/products"
import { eq, or, sql, desc } from "drizzle-orm"
import { getCustomerMarketingInsight } from "@/app/actions/customer-segmentation"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ReportEmptyState, ReportKPIGrid } from "@/components/reports/report-components"
import { Badge } from "@/components/ui/badge"

export default async function Customer360Page({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
    const { customer } = await searchParams
    const customerKey = customer?.trim()

    if (!customerKey) {
        return (
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
                <Link href="/dashboard/reports/customers" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Customer Report
                </Link>
                <ReportEmptyState title="Customer 360 belum bisa dibuka" description="Pilih account dari report customer atau sales untuk membuka profil 360." icon="users" />
            </div>
        )
    }

    const account = await db.query.customers.findFirst({
        where: or(eq(customers.customerCode, customerKey), eq(customers.id, Number(customerKey) || -1)),
    })

    if (!account) {
        return (
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
                <Link href="/dashboard/reports/customers" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Customer Report
                </Link>
                <ReportEmptyState title="Customer tidak ditemukan" description="Kode account yang dipilih tidak ditemukan di database pelanggan." icon="users" />
            </div>
        )
    }

    const [summary] = await db.select({
        total_orders: sql<number>`COUNT(DISTINCT ${salesOrders.id})`,
        total_revenue: sql<number>`COALESCE(SUM((${salesOrderItems.unitPrice}::numeric * ${salesOrderItems.quantity}) - ${salesOrderItems.discount}::numeric + ${salesOrderItems.tax}::numeric), 0)`,
        avg_order_value: sql<number>`COALESCE(AVG((${salesOrderItems.unitPrice}::numeric * ${salesOrderItems.quantity}) - ${salesOrderItems.discount}::numeric + ${salesOrderItems.tax}::numeric), 0)`,
        last_order_date: sql<Date>`MAX(${salesOrders.salesDate})`,
    })
        .from(salesOrders)
        .leftJoin(salesOrderItems, eq(salesOrderItems.salesOrderId, salesOrders.id))
        .where(eq(salesOrders.customerId, account.id))

    const monthlyTrend = await db.select({
        month: sql<string>`TO_CHAR(DATE_TRUNC('month', ${salesOrders.salesDate}), 'YYYY-MM')`,
        revenue: sql<number>`COALESCE(SUM((${salesOrderItems.unitPrice}::numeric * ${salesOrderItems.quantity}) - ${salesOrderItems.discount}::numeric + ${salesOrderItems.tax}::numeric), 0)`,
        orders: sql<number>`COUNT(DISTINCT ${salesOrders.id})`,
    })
        .from(salesOrders)
        .leftJoin(salesOrderItems, eq(salesOrderItems.salesOrderId, salesOrders.id))
        .where(eq(salesOrders.customerId, account.id))
        .groupBy(sql`DATE_TRUNC('month', ${salesOrders.salesDate})`)
        .orderBy(sql`DATE_TRUNC('month', ${salesOrders.salesDate})`)
        .limit(12)

    const topProducts = await db.select({
        product_name: products.materialDescription,
        material_number: products.materialNumber,
        category: products.category,
        quantity: sql<number>`COALESCE(SUM(${salesOrderItems.quantity}), 0)`,
        revenue: sql<number>`COALESCE(SUM((${salesOrderItems.unitPrice}::numeric * ${salesOrderItems.quantity}) - ${salesOrderItems.discount}::numeric + ${salesOrderItems.tax}::numeric), 0)`,
    })
        .from(salesOrders)
        .leftJoin(salesOrderItems, eq(salesOrderItems.salesOrderId, salesOrders.id))
        .leftJoin(products, eq(products.id, salesOrderItems.productId))
        .where(eq(salesOrders.customerId, account.id))
        .groupBy(products.id, products.materialDescription, products.materialNumber, products.category)
        .orderBy(desc(sql`COALESCE(SUM((${salesOrderItems.unitPrice}::numeric * ${salesOrderItems.quantity}) - ${salesOrderItems.discount}::numeric + ${salesOrderItems.tax}::numeric), 0)`))
        .limit(8)

    const segmentationInsight = await getCustomerMarketingInsight(account.name)

    const totalRevenue = Number(summary?.total_revenue ?? 0)
    const totalOrders = Number(summary?.total_orders ?? 0)
    const avgOrder = Number(summary?.avg_order_value ?? 0)
    const lastOrderDate = summary?.last_order_date ? new Date(summary.last_order_date as string | Date) : null
    const daysSinceLastOrder = lastOrderDate ? Math.floor((Date.now() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24)) : null
    const health = daysSinceLastOrder === null ? "At Risk" : daysSinceLastOrder <= 30 ? "Healthy" : daysSinceLastOrder <= 90 ? "Watch" : "At Risk"
    const clv = totalRevenue * Math.min(Math.max(totalOrders, 1) / 3, 2.5)
    const dynamicSegment = segmentationInsight.success ? segmentationInsight.data.segment : null
    const dynamicRecency = segmentationInsight.success ? segmentationInsight.data.recency : null
    const dynamicFrequency = segmentationInsight.success ? segmentationInsight.data.frequency : null
    const dynamicMonetary = segmentationInsight.success ? segmentationInsight.data.monetary : null

    const kpis: React.ComponentProps<typeof ReportKPIGrid>["kpis"] = [
        { title: "Total Revenue", value: formatCurrency(totalRevenue), icon: "dollar", variant: "success" },
        { title: "Total Orders", value: totalOrders.toLocaleString(), icon: "sales", variant: "default" },
        { title: "Avg Order Value", value: formatCurrency(avgOrder), icon: "trendingUp", variant: "default" },
        { title: "Days Since Last Order", value: daysSinceLastOrder === null ? "No order" : `${daysSinceLastOrder} days`, icon: "clock", variant: health === "Healthy" ? "success" : health === "Watch" ? "warning" : "danger" },
        { title: "Account Health", value: health, icon: "activity", variant: health === "Healthy" ? "success" : health === "Watch" ? "warning" : "danger" },
        { title: "Customer Segment", value: dynamicSegment ?? "Not mapped", icon: "users", variant: dynamicSegment === "Champions" || dynamicSegment === "Loyal Customers" ? "success" : dynamicSegment === "At Risk" || dynamicSegment === "Lost" ? "danger" : "default" },
    ]

    return (
        <div className="@container/main flex flex-1 flex-col gap-4 p-4 md:p-8 lg:p-10">
            <Link href="/dashboard/reports/customers" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900">
                <ArrowLeft className="h-4 w-4" />
                Back to Customer Report
            </Link>

            <Card className="border-slate-200 bg-gradient-to-br from-white via-slate-50 to-emerald-50 shadow-sm">
                <CardHeader>
                    <div className="flex flex-wrap gap-2">
                        <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">Customer 360</Badge>
                        {dynamicSegment ? (
                            <Badge className={`${segmentTone(dynamicSegment)} hover:bg-inherit`}>{dynamicSegment}</Badge>
                        ) : null}
                    </div>
                    <CardTitle className="text-2xl tracking-tight">Customer 360 Profile</CardTitle>
                    <CardDescription>{account.name} · {account.customerCode || "-"} · ringkasan nilai, recency, segmentasi RFM, dan preferensi pembelian.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4"><p className="text-xs uppercase tracking-[0.18em] text-emerald-600">Health</p><p className="mt-2 text-2xl font-semibold text-slate-950">{health}</p><p className="mt-1 text-sm text-slate-600">Sinyal retensi berbasis recency order.</p></div>
                    <div className="rounded-2xl border border-sky-200 bg-sky-50/80 p-4"><p className="text-xs uppercase tracking-[0.18em] text-sky-600">Last order</p><p className="mt-2 text-2xl font-semibold text-slate-950">{lastOrderDate ? lastOrderDate.toLocaleDateString("id-ID") : "No order"}</p><p className="mt-1 text-sm text-slate-600">Gunakan untuk trigger follow-up account.</p></div>
                    <div className="rounded-2xl border border-violet-200 bg-violet-50/80 p-4"><p className="text-xs uppercase tracking-[0.18em] text-violet-600">Segment</p><p className="mt-2 text-2xl font-semibold text-slate-950">{dynamicSegment ?? "Not mapped"}</p><p className="mt-1 text-sm text-slate-600">Dibaca dari engine segmentasi customer terbaru.</p></div>
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4"><p className="text-xs uppercase tracking-[0.18em] text-amber-600">CLV</p><p className="mt-2 text-2xl font-semibold text-slate-950">{formatCurrency(clv)}</p><p className="mt-1 text-sm text-slate-600">Estimasi nilai jangka panjang account.</p></div>
                </CardContent>
            </Card>

            <ReportKPIGrid kpis={kpis} />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
                <Card className="border-slate-200 bg-white shadow-sm">
                    <CardHeader>
                        <CardTitle>Monthly revenue footprint</CardTitle>
                        <CardDescription>Riwayat revenue dan order bulanan account ini sebagai basis diskusi Customer 360.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {monthlyTrend.length === 0 ? (
                            <div className="flex h-[280px] items-center justify-center text-sm text-slate-500">Belum ada histori transaksi untuk account ini.</div>
                        ) : (
                            <div className="space-y-4">
                                {monthlyTrend.map((row) => (
                                    <div key={row.month}>
                                        <div className="mb-1 flex items-center justify-between text-sm">
                                            <span className="font-medium text-slate-900">{new Date(`${row.month}-01`).toLocaleDateString("en-US", { month: "short", year: "2-digit" })}</span>
                                            <span className="text-slate-600">{formatCurrency(Number(row.revenue))} · {Number(row.orders)} orders</span>
                                        </div>
                                        <div className="h-3 rounded-full bg-slate-100">
                                            <div className="h-3 rounded-full bg-sky-500" style={{ width: `${Math.max(8, (Number(row.revenue) / Math.max(...monthlyTrend.map((x) => Number(x.revenue)), 1)) * 100)}%` }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="border-slate-200 bg-white shadow-sm">
                    <CardHeader>
                        <CardTitle>Segmentation intelligence</CardTitle>
                        <CardDescription>Segmentasi customer kini mengikuti engine RFM terbaru, bukan klasifikasi statis saat report dibuat.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Current segment</p>
                                    <p className="mt-2 text-2xl font-semibold text-slate-950">{dynamicSegment ?? "Not mapped"}</p>
                                </div>
                                {dynamicSegment ? <Badge className={`${segmentTone(dynamicSegment)} hover:bg-inherit`}>{dynamicSegment}</Badge> : null}
                            </div>
                            <p className="mt-3 text-sm leading-6 text-slate-600">
                                Segment ini dibaca dari histori billing terbaru sehingga berubah mengikuti perilaku customer yang sekarang.
                            </p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Recency</p>
                                <p className="mt-2 text-2xl font-semibold text-slate-950">{dynamicRecency ?? "-"}</p>
                                <p className="mt-1 text-xs text-slate-600">Hari sejak billing terakhir pada engine segmentasi.</p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Frequency</p>
                                <p className="mt-2 text-2xl font-semibold text-slate-950">{dynamicFrequency ?? "-"}</p>
                                <p className="mt-1 text-xs text-slate-600">Jumlah transaksi dalam periode analisis dinamis.</p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Monetary</p>
                                <p className="mt-2 text-2xl font-semibold text-slate-950">{dynamicMonetary === null ? "-" : formatCurrency(dynamicMonetary)}</p>
                                <p className="mt-1 text-xs text-slate-600">Nilai billing yang dipakai untuk klasifikasi segmentasi.</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 bg-white shadow-sm">
                    <CardHeader>
                        <CardTitle>Top purchased products</CardTitle>
                        <CardDescription>Produk yang paling banyak menyumbang revenue untuk account ini.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {topProducts.length === 0 ? (
                            <div className="flex h-[280px] items-center justify-center text-sm text-slate-500">Belum ada produk yang bisa dipetakan.</div>
                        ) : (
                            topProducts.map((product, index) => (
                                <div key={`${product.material_number}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <p className="font-medium text-slate-950">{product.product_name || "Unknown Product"}</p>
                                            <p className="text-xs text-slate-500">{product.material_number || "-"} · {product.category || "Uncategorized"}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-semibold text-emerald-600">{formatCurrency(Number(product.revenue))}</p>
                                            <p className="text-xs text-slate-500">{Number(product.quantity).toLocaleString()} qty</p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

function formatCurrency(val: number) {
    if (val >= 1_000_000_000) return `Rp ${(val / 1_000_000_000).toFixed(1)} Miliar`
    if (val >= 1_000_000) return `Rp ${(val / 1_000_000).toFixed(1)} Juta`
    if (val >= 1_000) return `Rp ${(val / 1_000).toFixed(0)}K`
    return `Rp ${val.toLocaleString("id-ID")}`
}

function segmentTone(segment: string) {
    if (segment === "Champions" || segment === "Loyal Customers") {
        return "border-emerald-200 bg-emerald-50 text-emerald-700"
    }

    if (segment === "At Risk" || segment === "Lost" || segment === "Hibernating") {
        return "border-rose-200 bg-rose-50 text-rose-700"
    }

    if (segment === "Potential Loyalists" || segment === "Recent Customers" || segment === "Needs Attention") {
        return "border-amber-200 bg-amber-50 text-amber-700"
    }

    return "border-sky-200 bg-sky-50 text-sky-700"
}
