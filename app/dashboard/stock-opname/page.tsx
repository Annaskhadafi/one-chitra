import { getStockOpnameSessions } from "@/app/actions/stock-opname"
import { getWarehouses } from "@/app/actions/warehouse"
import { OpnameSessionList } from "./_components/opname-session-list"
import { CreateSessionDialog } from "./_components/create-session-dialog"

export default async function StockOpnamePage() {
    const [sessions, warehouses] = await Promise.all([
        getStockOpnameSessions(),
        getWarehouses(),
    ])

    const openCount = sessions.filter((s) => s.status === "open").length
    const closedCount = sessions.filter((s) => s.status === "closed").length

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            <div className="flex flex-col gap-1">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold tracking-tight">Stock Opname</h1>
                            {openCount > 0 && (
                                <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                    {openCount} Aktif
                                </span>
                            )}
                        </div>
                        <p className="text-muted-foreground mt-1">
                            Penghitungan fisik stok & rekonsiliasi selisih antara Stock SAP dan stok aktual di gudang.
                        </p>
                    </div>
                    <CreateSessionDialog warehouses={warehouses} />
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-xl border bg-card p-5 flex flex-col gap-1">
                    <p className="text-sm text-muted-foreground">Total Sesi</p>
                    <p className="text-3xl font-bold">{sessions.length}</p>
                    <p className="text-xs text-muted-foreground">Semua sesi opname</p>
                </div>
                <div className="rounded-xl border bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900 p-5 flex flex-col gap-1">
                    <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">Sedang Berjalan</p>
                    <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{openCount}</p>
                    <p className="text-xs text-muted-foreground">Sesi masih open</p>
                </div>
                <div className="rounded-xl border bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 p-5 flex flex-col gap-1">
                    <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Selesai</p>
                    <p className="text-3xl font-bold text-slate-700 dark:text-slate-300">{closedCount}</p>
                    <p className="text-xs text-muted-foreground">Sesi sudah ditutup</p>
                </div>
            </div>

            <div className="flex-1">
                <OpnameSessionList sessions={sessions} />
            </div>
        </div>
    )
}
