import { getReorderAlerts } from "@/app/actions/stock-alerts"
import { ReorderAlertTable } from "./_components/reorder-alert-table"
import { ReportPieChart, ReportBarChart } from "@/components/reports/report-charts"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { BarChart3 } from "lucide-react"

export default async function StockAlertsPage() {
    const alerts = await getReorderAlerts()

    const critical = alerts.filter((a) => a.urgency === "critical").length
    const warning = alerts.filter((a) => a.urgency === "warning").length

    // Data for Urgency Distribution (Pie Chart)
    const urgencyData = [
        { name: "Critical (Stok 0)", value: critical },
        { name: "Warning (< Min)", value: warning },
    ].filter(d => d.value > 0)

    // Data for Top 10 Critical Products (Bar Chart)
    // We calculate the stock ratio (current / min) - the lower the ratio, the more critical
    const topCriticalProducts = [...alerts]
        .map(a => ({
            name: a.product.materialDescription || a.product.materialNumber,
            value: a.totalStock,
            min: a.minStock,
            ratio: a.minStock > 0 ? (a.totalStock / a.minStock) * 100 : 0
        }))
        .sort((a, b) => a.ratio - b.ratio) // Most critical first
        .slice(0, 10)
        .map(p => ({
            name: p.name,
            value: p.value,
        }))

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold tracking-tight">Reorder Point Alerts</h1>
                    {alerts.length > 0 && (
                        <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                            {alerts.length} Alert{alerts.length > 1 ? "s" : ""}
                        </span>
                    )}
                </div>
                <p className="text-muted-foreground">
                    Produk yang stok-nya sudah menyentuh atau di bawah batas minimum (min stock).
                </p>
            </div>

            {/* Summary Cards & Charts */}
            <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="analytics" className="border-none">
                    <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-6 bg-card border rounded-xl shadow-sm hover:bg-accent/50 transition-all [&[data-state=open]]:rounded-b-none [&[data-state=open]]:border-b-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                <BarChart3 className="h-5 w-5" />
                            </div>
                            <div className="text-left">
                                <h3 className="text-base font-bold text-foreground/90">Ringkasan & Dashboard Analitik</h3>
                                <p className="text-xs text-muted-foreground font-normal">Klik untuk melihat status alert kritis dan produk prioritas restock.</p>
                            </div>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="bg-card border border-t-0 rounded-b-xl shadow-sm p-6 overflow-visible">
                        <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-xl border bg-card p-5 flex flex-col gap-1">
                    <p className="text-sm text-muted-foreground">Total Alert</p>
                    <p className="text-3xl font-bold">{alerts.length}</p>
                    <p className="text-xs text-muted-foreground">Produk perlu restock</p>
                </div>
                <div className="rounded-xl border bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900 p-5 flex flex-col gap-1">
                    <p className="text-sm text-red-600 dark:text-red-400 font-medium">Critical (Stok = 0)</p>
                    <p className="text-3xl font-bold text-red-600 dark:text-red-400">{critical}</p>
                    <p className="text-xs text-red-500">Segera lakukan pengadaan</p>
                </div>
                <div className="rounded-xl border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900 p-5 flex flex-col gap-1">
                    <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">Warning (Stok &lt; Min)</p>
                    <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{warning}</p>
                    <p className="text-xs text-amber-500">Perlu segera ditambah</p>
                </div>
            </div>

            {/* Charts Section */}
            {alerts.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1">
                        <ReportPieChart
                            data={urgencyData}
                            title="Distribusi Urgensi"
                            description="Perbandingan stok kosong vs stok minim"
                            variant="donut"
                            height={300}
                        />
                    </div>
                    <div className="lg:col-span-2">
                        <ReportBarChart
                            data={topCriticalProducts}
                            title="Top 10 Produk Paling Kritis"
                            description="Produk dengan prioritas restock tertinggi (berdasarkan urutan urgensi)"
                            height={300}
                        />
                    </div>
                </div>
            )}
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>

            <div className="flex-1">
                <ReorderAlertTable data={alerts} />
            </div>
        </div>
    )
}
