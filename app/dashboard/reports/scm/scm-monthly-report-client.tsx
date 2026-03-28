"use client"

import { useState, useTransition } from "react"
import { Loader2, BarChart3 } from "lucide-react"

import { getMonthlyScmReport } from "@/app/actions/reports"
import type { MonthlyScmReportData } from "@/app/dashboard/reports/types"
import { ReportBarChart, ReportPieChart } from "@/components/reports/report-charts"
import { ReportKPIGrid } from "@/components/reports/report-components"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type Props = {
    initialData: MonthlyScmReportData
}

export function ScmMonthlyReportClient({ initialData }: Props) {
    const [period, setPeriod] = useState(initialData.period)
    const [data, setData] = useState(initialData)
    const [isPending, startTransition] = useTransition()

    const outstandingSalesOrders = data.outstandingSalesOrders ?? []
    const totalOutstandingOrders = data.summary.totalOutstandingOrders ?? outstandingSalesOrders.length
    const totalOutstandingQty = data.summary.totalOutstandingQty ?? outstandingSalesOrders.reduce((sum, row) => sum + row.totalQuantity, 0)
    const totalOutstandingValue = data.summary.totalOutstandingValue ?? outstandingSalesOrders.reduce((sum, row) => sum + row.totalValue, 0)

    const handlePeriodChange = (value: string) => {
        setPeriod(value)
        startTransition(() => {
            void getMonthlyScmReport(value).then((nextData) => {
                setData(nextData)
            })
        })
    }

    const kpis: React.ComponentProps<typeof ReportKPIGrid>["kpis"] = [
        {
            title: "Total Qty GR Manual",
            value: data.summary.totalGrManualQty,
            icon: "packageCheck",
            variant: "success",
        },
        {
            title: "Total Qty Delivered",
            value: data.summary.totalDeliveredQty,
            icon: "truck",
            variant: "default",
        },
        {
            title: "Qty 27.00 R 49",
            value: data.summary.totalR49DeliveredQty,
            icon: "chart",
            variant: "warning",
        },
        {
            title: "Total Delivery R49",
            value: data.summary.totalR49Deliveries,
            icon: "truck",
            variant: "default",
        },
        {
            title: "Outstanding SO",
            value: totalOutstandingOrders,
            icon: "file",
            variant: "warning",
        },
        {
            title: "Outstanding Qty",
            value: totalOutstandingQty,
            icon: "packageOpen",
            variant: "warning",
        },
    ]

    return (
        <div className="flex flex-col gap-4">
            <div className="px-4 lg:px-6">
                <Card>
                    <CardContent className="flex flex-col gap-4 pt-6 md:flex-row md:items-end md:justify-between">
                        <div className="space-y-1">
                            <label htmlFor="scm-period" className="text-sm font-medium">
                                Pilih Bulan Report
                            </label>
                            <Input
                                id="scm-period"
                                type="month"
                                value={period}
                                onChange={(event) => handlePeriodChange(event.target.value)}
                                className="w-full md:w-56"
                            />
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
                            Period: {formatPeriodLabel(data.period)}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="px-4 lg:px-6">
                <ReportKPIGrid kpis={kpis} />
            </div>

            <div className="px-4 lg:px-6">
                <Tabs defaultValue="gr-manual" className="gap-4">
                    <TabsList className="h-auto w-full flex-wrap justify-start">
                        <TabsTrigger value="gr-manual">Barang Masuk GR Manual</TabsTrigger>
                        <TabsTrigger value="delivered">Barang Delivered</TabsTrigger>
                        <TabsTrigger value="r49-delivery">By Delivery 27.00 R 49</TabsTrigger>
                        <TabsTrigger value="outstanding-so">Outstanding SO</TabsTrigger>
                    </TabsList>

                    <TabsContent value="gr-manual" className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                            <ReportBarChart
                                data={data.grManualByCategory.map((item) => ({
                                    name: item.category,
                                    value: item.totalQuantity,
                                    secondary: item.transactionCount,
                                }))}
                                title="Barang Masuk (GR Manual) per Category"
                                description="Diagram quantity bulanan berdasarkan category product"
                                showLegend
                            />
                            <ReportPieChart
                                data={data.grManualByCategory.map((item) => ({
                                    name: item.category,
                                    value: item.totalQuantity,
                                }))}
                                title="Distribusi GR Manual per Category"
                                description="Komposisi quantity barang masuk bulan terpilih"
                            />
                        </div>
                        <CategorySummaryTable
                            title="Detail GR Manual per Category"
                            description="Qty dan jumlah transaksi GR Manual per category"
                            rows={data.grManualByCategory.map((item) => ({
                                category: item.category,
                                quantity: item.totalQuantity,
                                count: item.transactionCount,
                                value: item.totalValue,
                                gapSlaDays: item.averageSlaDays,
                                createdBy: item.createdBy,
                            }))}
                            countLabel="Transaksi"
                            emptyLabel="Belum ada data GR Manual pada bulan ini."
                            showValue={false}
                            showGapSla
                            showCreatedBy
                        />
                    </TabsContent>

                    <TabsContent value="delivered" className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                            <ReportBarChart
                                data={data.deliveredByCategory.map((item) => ({
                                    name: item.category,
                                    value: item.totalQuantity,
                                    secondary: item.deliveryCount,
                                }))}
                                title="Barang Delivered per Category"
                                description="Diagram quantity barang delivered berdasarkan category"
                                showLegend
                            />
                            <ReportPieChart
                                data={data.deliveredByCategory.map((item) => ({
                                    name: item.category,
                                    value: item.totalQuantity,
                                }))}
                                title="Distribusi Delivered per Category"
                                description="Komposisi qty delivered pada bulan terpilih"
                            />
                        </div>
                        <CategorySummaryTable
                            title="Detail Delivered per Category"
                            description="Qty delivered dan jumlah delivery per category"
                            rows={data.deliveredByCategory.map((item) => ({
                                category: item.category,
                                quantity: item.totalQuantity,
                                count: item.deliveryCount,
                                value: item.totalValue,
                                gapSlaDays: undefined,
                            }))}
                            countLabel="Delivery"
                            emptyLabel="Belum ada data delivered pada bulan ini."
                        />
                    </TabsContent>

                    <TabsContent value="r49-delivery" className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                            <ReportBarChart
                                data={data.r49ByDelivery.slice(0, 12).map((item) => ({
                                    name: item.deliveryNumber,
                                    value: item.totalQuantity,
                                    secondary: item.itemCount,
                                }))}
                                title="Delivery Product 27.00 R 49"
                                description="Top delivery berdasarkan qty untuk product mengandung 27.00 R 49"
                                showLegend
                            />
                            <Card>
                                <CardHeader>
                                    <CardTitle>Ringkasan 27.00 R 49</CardTitle>
                                    <CardDescription>Semua delivery product yang mengandung 27.00 R 49 All Pattern</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4 text-sm">
                                    <div className="flex items-center justify-between rounded-lg border p-3">
                                        <span className="text-muted-foreground">Total Delivery</span>
                                        <span className="font-semibold">{data.summary.totalR49Deliveries.toLocaleString()}</span>
                                    </div>
                                    <div className="flex items-center justify-between rounded-lg border p-3">
                                        <span className="text-muted-foreground">Total Qty</span>
                                        <span className="font-semibold">{data.summary.totalR49DeliveredQty.toLocaleString()}</span>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <Card>
                            <CardHeader>
                                <CardTitle>Report Monthly by Delivery</CardTitle>
                                <CardDescription>
                                    Semua product yang mengandung 27.00 R 49 untuk period {formatPeriodLabel(data.period)}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {data.r49ByDelivery.length === 0 ? (
                                    <div className="flex h-40 items-center justify-center text-muted-foreground">
                                        Tidak ada delivery 27.00 R 49 pada bulan ini.
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Delivery</TableHead>
                                                    <TableHead>Tanggal</TableHead>
                                                    <TableHead>Customer</TableHead>
                                                    <TableHead>Barang</TableHead>
                                                    <TableHead>Category</TableHead>
                                                    <TableHead className="text-right">Qty</TableHead>
                                                    <TableHead className="text-right">Value</TableHead>
                                                    <TableHead className="text-right">Items</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {data.r49ByDelivery.map((row) => (
                                                    <TableRow key={`${row.deliveryId}-${row.category}`}>
                                                        <TableCell className="font-medium">{row.deliveryNumber}</TableCell>
                                                        <TableCell>{row.deliveryDate ?? "-"}</TableCell>
                                                        <TableCell>{row.customerName}</TableCell>
                                                        <TableCell className="max-w-md whitespace-normal">
                                                            <div className="space-y-1">
                                                                {row.products.map((product) => (
                                                                    <div key={`${row.deliveryId}-${product.materialNumber}`} className="text-sm">
                                                                        <span className="font-medium">{product.productName}</span>
                                                                        {" "}
                                                                        <span className="text-muted-foreground">({product.materialNumber})</span>
                                                                        {" "}
                                                                        <span className="text-muted-foreground">Qty: {product.quantity.toLocaleString()}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>{row.category}</TableCell>
                                                        <TableCell className="text-right">{row.totalQuantity.toLocaleString()}</TableCell>
                                                        <TableCell className="text-right">{formatCurrency(row.totalValue)}</TableCell>
                                                        <TableCell className="text-right">{row.itemCount.toLocaleString()}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="outstanding-so" className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                            <ReportBarChart
                                data={outstandingSalesOrders.slice(0, 12).map((item) => ({
                                    name: item.customerName,
                                    value: item.totalQuantity,
                                    secondary: item.totalValue,
                                }))}
                                title="Outstanding Sales Order per Customer"
                                description="Qty outstanding dan value sales order yang belum selesai delivery"
                                showLegend
                            />
                            <Card>
                                <CardHeader>
                                    <CardTitle>Ringkasan Outstanding SO</CardTitle>
                                    <CardDescription>Sales order yang masih punya sisa qty belum delivery</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4 text-sm">
                                    <div className="flex items-center justify-between rounded-lg border p-3">
                                        <span className="text-muted-foreground">Total SO</span>
                                        <span className="font-semibold">{totalOutstandingOrders.toLocaleString()}</span>
                                    </div>
                                    <div className="flex items-center justify-between rounded-lg border p-3">
                                        <span className="text-muted-foreground">Outstanding Qty</span>
                                        <span className="font-semibold">{totalOutstandingQty.toLocaleString()}</span>
                                    </div>
                                    <div className="flex items-center justify-between rounded-lg border p-3">
                                        <span className="text-muted-foreground">Outstanding Value</span>
                                        <span className="font-semibold">{formatCurrency(totalOutstandingValue)}</span>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <Card>
                            <CardHeader>
                                <CardTitle>Outstanding Sales Order Belum Delivery</CardTitle>
                                <CardDescription>
                                    Kategori, customer, qty, value, dan detail product untuk period {formatPeriodLabel(data.period)}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {outstandingSalesOrders.length === 0 ? (
                                    <div className="flex h-40 items-center justify-center text-muted-foreground">
                                        Tidak ada outstanding sales order pada bulan ini.
                                    </div>
                                ) : (
                                    <Accordion type="single" collapsible className="w-full">
                                        {outstandingSalesOrders.map((order) => (
                                            <AccordionItem key={order.salesOrderId} value={`so-${order.salesOrderId}`}>
                                                <AccordionTrigger className="hover:no-underline">
                                                    <div className="grid w-full grid-cols-1 gap-2 pr-4 text-left md:grid-cols-[1.1fr_0.8fr_0.9fr_0.8fr_0.6fr_0.8fr]">
                                                        <div>
                                                            <div className="font-semibold">{order.orderNumber}</div>
                                                            <div className="text-xs text-muted-foreground">{order.salesDate ?? "-"}</div>
                                                        </div>
                                                        <div className="text-sm">{order.customerName}</div>
                                                        <div className="text-sm">{order.category}</div>
                                                        <div className="text-sm">{formatCurrency(order.totalValue)}</div>
                                                        <div className="text-sm">{order.totalQuantity.toLocaleString()}</div>
                                                        <div className="text-sm">{order.productCount.toLocaleString()} Product</div>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent>
                                                    <div className="overflow-x-auto rounded-lg border">
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow>
                                                                    <TableHead>Product</TableHead>
                                                                    <TableHead>Material Number</TableHead>
                                                                    <TableHead>Category</TableHead>
                                                                    <TableHead className="text-right">Qty</TableHead>
                                                                    <TableHead className="text-right">Value</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {order.products.map((product) => (
                                                                    <TableRow key={`${order.salesOrderId}-${product.materialNumber}-${product.productName}`}>
                                                                        <TableCell className="font-medium">{product.productName}</TableCell>
                                                                        <TableCell>{product.materialNumber}</TableCell>
                                                                        <TableCell>{product.category}</TableCell>
                                                                        <TableCell className="text-right">{product.quantity.toLocaleString()}</TableCell>
                                                                        <TableCell className="text-right">{formatCurrency(product.value)}</TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    )
}

// Keep this component in the client bundle so Turbopack rebuilds consistently after prop-shape changes.
function CategorySummaryTable({
    title,
    description,
    rows,
    countLabel,
    emptyLabel,
    showValue = true,
    showGapSla = false,
    showCreatedBy = false,
}: {
    title: string
    description: string
    rows: Array<{ category: string; quantity: number; count: number; value: number; gapSlaDays?: number; createdBy?: string }>
    countLabel: string
    emptyLabel: string
    showValue?: boolean
    showGapSla?: boolean
    showCreatedBy?: boolean
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                {rows.length === 0 ? (
                    <div className="flex h-40 items-center justify-center text-muted-foreground">
                        {emptyLabel}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Category</TableHead>
                                    <TableHead className="text-right">Qty</TableHead>
                                    {showValue !== false ? <TableHead className="text-right">Value</TableHead> : null}
                                    {showGapSla ? <TableHead className="text-right">Gap SLA (Hari)</TableHead> : null}
                                    {showCreatedBy ? <TableHead>Created By</TableHead> : null}
                                    <TableHead className="text-right">{countLabel}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.map((row) => (
                                    <TableRow key={row.category}>
                                        <TableCell className="font-medium">{row.category}</TableCell>
                                        <TableCell className="text-right">{row.quantity.toLocaleString()}</TableCell>
                                        {showValue !== false ? <TableCell className="text-right">{formatCurrency(row.value)}</TableCell> : null}
                                        {showGapSla ? <TableCell className="text-right">{formatGapSla(row.gapSlaDays)}</TableCell> : null}
                                        {showCreatedBy ? <TableCell>{row.createdBy ?? "-"}</TableCell> : null}
                                        <TableCell className="text-right">{row.count.toLocaleString()}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

function formatPeriodLabel(period: string) {
    const [year, month] = period.split("-")
    const date = new Date(Number(year), Number(month) - 1, 1)
    return date.toLocaleDateString("id-ID", { month: "long", year: "numeric" })
}

function formatCurrency(value: number) {
    const safeValue = Number.isFinite(value) ? value : 0
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(safeValue)
}

function formatGapSla(value?: number) {
    if (value == null || !Number.isFinite(value)) return "-"
    return `${value.toFixed(1)} hari`
}
