import { getPriceLists, getMarginAlerts } from "@/app/actions/price-management"
import { PriceManagementClient } from "./_components/price-management-client"

export default async function PriceManagementPage() {
    const [priceLists, marginAlerts] = await Promise.all([
        getPriceLists(),
        getMarginAlerts(),
    ])

    const activeLists = priceLists.filter((p) => p.isActive).length
    const expiredLists = priceLists.filter(
        (p) => p.validUntil && new Date(p.validUntil) < new Date()
    ).length
    const criticalAlerts = marginAlerts.filter((a) => a.shortfall > 5).length

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold tracking-tight">Price Management</h1>
                    {criticalAlerts > 0 && (
                        <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                            {criticalAlerts} Margin Alert
                        </span>
                    )}
                </div>
                <p className="text-muted-foreground">
                    Kelola price list per tier/customer, volume discount, masa berlaku harga, histori perubahan, dan proteksi margin floor.
                </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="rounded-xl border bg-card p-5 flex flex-col gap-1">
                    <p className="text-sm text-muted-foreground">Total Price List</p>
                    <p className="text-3xl font-bold">{priceLists.length}</p>
                    <p className="text-xs text-muted-foreground">Semua jenis</p>
                </div>
                <div className="rounded-xl border bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900 p-5 flex flex-col gap-1">
                    <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">Aktif</p>
                    <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">{activeLists}</p>
                    <p className="text-xs text-muted-foreground">Price list aktif</p>
                </div>
                <div className="rounded-xl border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900 p-5 flex flex-col gap-1">
                    <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">Expired</p>
                    <p className="text-3xl font-bold text-amber-700 dark:text-amber-300">{expiredLists}</p>
                    <p className="text-xs text-muted-foreground">Sudah melewati validUntil</p>
                </div>
                <div className={`rounded-xl border p-5 flex flex-col gap-1 ${criticalAlerts > 0 ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900' : 'bg-card'}`}>
                    <p className={`text-sm font-medium ${criticalAlerts > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>Margin Alerts</p>
                    <p className={`text-3xl font-bold ${criticalAlerts > 0 ? 'text-red-700 dark:text-red-300' : ''}`}>{marginAlerts.length}</p>
                    <p className="text-xs text-muted-foreground">Item di bawah margin floor</p>
                </div>
            </div>

            {/* Main Tabs */}
            <PriceManagementClient
                priceLists={priceLists}
                marginAlerts={marginAlerts}
            />
        </div>
    )
}
