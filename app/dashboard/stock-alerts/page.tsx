import { getReorderAlerts } from "@/app/actions/stock-alerts"
import { ReorderAlertTable } from "./_components/reorder-alert-table"

export default async function StockAlertsPage() {
    const alerts = await getReorderAlerts()

    const critical = alerts.filter((a) => a.urgency === "critical").length
    const warning = alerts.filter((a) => a.urgency === "warning").length

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

            {/* Summary Cards */}
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

            <div className="flex-1">
                <ReorderAlertTable data={alerts} />
            </div>
        </div>
    )
}
