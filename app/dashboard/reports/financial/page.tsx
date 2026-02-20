import { getFinancialReport } from "@/app/actions/reports"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ReportKPIGrid, ExportButton } from "@/components/reports/report-components"
import { SalesTrendChart, ReportPieChart } from "@/components/reports/report-charts"
import { DollarSign, FileText, ArrowLeft, TrendingUp, AlertCircle } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"

export default async function FinancialReportPage() {
    const data = await getFinancialReport()

    const currentMonthData = data.revenueOverview[data.revenueOverview.length - 1] || { revenue: 0 }
    const prevMonthData = data.revenueOverview[data.revenueOverview.length - 2] || { revenue: 0 }
    const revenueGrowth = prevMonthData.revenue > 0 ? ((currentMonthData.revenue - prevMonthData.revenue) / prevMonthData.revenue) * 100 : 0

    const totalOutstanding = data.outstandingInvoices.reduce((sum, inv) => sum + inv.amount, 0)
    const currentMonthTax = data.taxReport[0]?.totalTax || 0

    const kpis: React.ComponentProps<typeof ReportKPIGrid>["kpis"] = [
        {
            title: "Current Month Revenue",
            value: formatCurrency(currentMonthData.revenue),
            change: revenueGrowth,
            changeLabel: "vs last month",
            icon: "dollar" as const,
            variant: "success",
        },
        {
            title: "Total Outstanding",
            value: formatCurrency(totalOutstanding),
            icon: "alertCircle" as const,
            variant: totalOutstanding > 10000000 ? "warning" : "default",
        },
        {
            title: "Current Month PPN",
            value: formatCurrency(currentMonthTax),
            icon: "file" as const,
            variant: "default",
        },
        {
            title: "Overdue Invoices",
            value: data.outstandingInvoices.filter(i => i.dueDate < new Date()).length,
            icon: "trendingUp" as const,
            variant: "danger",
        },
    ]

    const revenueTrendData = data.revenueOverview.map(r => ({
        date: r.month + "-01", // Make it look like a date for the chart
        sales: r.revenue,
    }))

    const paymentTypeData = data.revenueByPaymentType.map(p => ({
        name: p.type,
        value: p.revenue,
    }))

    return (
        <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                {/* Header with Back Button */}
                <div className="px-4 lg:px-6 flex items-center gap-4">
                    <Link href="/dashboard/reports" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Reports
                    </Link>
                </div>

                <div className="px-4 lg:px-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Financial Report</h1>
                        <p className="text-muted-foreground">
                            Revenue, invoicing, and tax analytics
                        </p>
                    </div>
                </div>

                {/* KPI Cards */}
                <ReportKPIGrid kpis={kpis} />

                {/* Charts Row 1 */}
                <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-3 lg:px-6">
                    <div className="lg:col-span-2">
                        <SalesTrendChart
                            data={revenueTrendData}
                            title="Revenue Overview"
                            description="Monthly revenue trends over the last 12 months"
                            height={350}
                        />
                    </div>
                    <ReportPieChart
                        data={paymentTypeData}
                        title="Revenue by Payment Type"
                        description="Distribution of payment methods used"
                        height={350}
                        variant="pie"
                    />
                </div>

                {/* Tables Row */}
                <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-2 lg:px-6 mb-6">
                    {/* Outstanding Invoices */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Outstanding Invoices</CardTitle>
                                    <CardDescription>Unpaid invoices requiring follow-up</CardDescription>
                                </div>
                                <ExportButton data={data.outstandingInvoices} filename="outstanding-invoices" format="csv" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b bg-muted/50">
                                            <th className="text-left py-3 px-4 font-medium text-xs">Invoice No</th>
                                            <th className="text-left py-3 px-4 font-medium text-xs">Customer</th>
                                            <th className="text-left py-3 px-4 font-medium text-xs">Status</th>
                                            <th className="text-right py-3 px-4 font-medium text-xs">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.outstandingInvoices.slice(0, 5).map((inv, i) => (
                                            <tr key={i} className="border-b hover:bg-muted/30">
                                                <td className="py-3 px-4 text-sm font-medium">{inv.invoiceNo}</td>
                                                <td className="py-3 px-4 text-sm">{inv.customer}</td>
                                                <td className="py-3 px-4 text-sm">
                                                    {inv.dueDate < new Date() ? (
                                                        <Badge variant="destructive">Overdue</Badge>
                                                    ) : (
                                                        <Badge variant="secondary">Pending</Badge>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 text-sm text-right tabular-nums font-medium">{formatCurrency(inv.amount)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Tax Report */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Tax Report (PPN)</CardTitle>
                                    <CardDescription>Monthly tax collection summary</CardDescription>
                                </div>
                                <ExportButton data={data.taxReport} filename="tax-report" format="csv" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b bg-muted/50">
                                            <th className="text-left py-3 px-4 font-medium text-xs">Month</th>
                                            <th className="text-right py-3 px-4 font-medium text-xs">Total Revenue</th>
                                            <th className="text-right py-3 px-4 font-medium text-xs">Total PPN</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.taxReport.slice(0, 5).map((tax, i) => (
                                            <tr key={i} className="border-b hover:bg-muted/30">
                                                <td className="py-3 px-4 text-sm font-medium">{tax.month}</td>
                                                <td className="py-3 px-4 text-sm text-right tabular-nums text-muted-foreground">{formatCurrency(tax.totalRevenue)}</td>
                                                <td className="py-3 px-4 text-sm text-right tabular-nums font-medium text-blue-600">{formatCurrency(tax.totalTax)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}

function formatCurrency(val: number): string {
    if (val >= 1_000_000_000) return `Rp ${(val / 1_000_000_000).toFixed(1)}B`
    if (val >= 1_000_000) return `Rp ${(val / 1_000_000).toFixed(1)}M`
    if (val >= 1_000) return `Rp ${(val / 1_000).toFixed(0)}K`
    return `Rp ${val.toLocaleString()}`
}
