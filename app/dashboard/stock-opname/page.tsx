import { getStockOpnameActualSetupData, getStockOpnameSessions } from "@/app/actions/stock-opname"
import { getWarehouses } from "@/app/actions/warehouse"
import { OpnameSessionList } from "./_components/opname-session-list"
import { CreateSessionDialog } from "./_components/create-session-dialog"

export default async function StockOpnamePage() {
    const [sessions, warehouses, setupData] = await Promise.all([
        getStockOpnameSessions("sap"),
        getWarehouses(),
        getStockOpnameActualSetupData(),
    ])

    const openCount = sessions.filter((s) => s.status === "open").length
    const closedCount = sessions.filter((s) => s.status === "closed").length

    return (
        <div className="flex flex-1 flex-col gap-5 p-4 sm:gap-6 sm:p-6 md:p-8 lg:p-10">
            <div className="flex flex-col gap-1">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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
                    <div className="w-full sm:w-auto">
                        <CreateSessionDialog
                            warehouses={warehouses}
                            categories={setupData.categories}
                            roleOptions={setupData.roles}
                            users={setupData.users}
                        />
                    </div>
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

            <div className="rounded-xl border border-dashed border-blue-200 bg-blue-50/60 px-4 py-3 text-xs text-blue-700 dark:border-blue-900 dark:bg-blue-950/10 dark:text-blue-300">
                Menu ini khusus Stock Opname SAP. Data item awal mengikuti stock SAP pada warehouse yang dipilih, dan bisa dibatasi dengan kategori produk saat membuat sesi.
            </div>

            <div className="flex-1">
                <OpnameSessionList sessions={sessions} />
            </div>
        </div>
    )
}
