import { getStockOpnameActualSetupData, getStockOpnameSessions } from "@/app/actions/stock-opname"
import { getWarehouses } from "@/app/actions/warehouse"
import { OpnameSessionList } from "../stock-opname/_components/opname-session-list"
import { CreateSessionDialogActual } from "./_components/create-session-dialog-actual"

export default async function StockOpnameAktualPage() {
    const [sessions, warehouses, setupData] = await Promise.all([
        getStockOpnameSessions("actual"),
        getWarehouses(),
        getStockOpnameActualSetupData(),
    ])

    const openCount = sessions.filter((s) => s.status === "open").length
    const closedCount = sessions.filter((s) => s.status === "closed").length

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            <div className="flex flex-col gap-1">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold tracking-tight">Stock Opname Aktual</h1>
                            {openCount > 0 && (
                                <span className="bg-teal-100 text-teal-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                    {openCount} Aktif
                                </span>
                            )}
                        </div>
                        <p className="text-muted-foreground mt-1">
                            Snapshot menggunakan data stock aktual (stock internal), bukan data SAP.
                        </p>
                    </div>
                    <CreateSessionDialogActual
                        warehouses={warehouses}
                        categories={setupData.categories}
                        roleOptions={setupData.roles}
                        users={setupData.users}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-xl border bg-card p-5 flex flex-col gap-1">
                    <p className="text-sm text-muted-foreground">Total Sesi</p>
                    <p className="text-3xl font-bold">{sessions.length}</p>
                    <p className="text-xs text-muted-foreground">Semua sesi opname aktual</p>
                </div>
                <div className="rounded-xl border bg-teal-50 dark:bg-teal-950/20 border-teal-200 dark:border-teal-900 p-5 flex flex-col gap-1">
                    <p className="text-sm text-teal-600 dark:text-teal-400 font-medium">Sedang Berjalan</p>
                    <p className="text-3xl font-bold text-teal-600 dark:text-teal-400">{openCount}</p>
                    <p className="text-xs text-muted-foreground">Sesi masih open</p>
                </div>
                <div className="rounded-xl border bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 p-5 flex flex-col gap-1">
                    <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Selesai</p>
                    <p className="text-3xl font-bold text-slate-700 dark:text-slate-300">{closedCount}</p>
                    <p className="text-xs text-muted-foreground">Sesi sudah ditutup</p>
                </div>
            </div>

            <div className="rounded-xl border border-dashed bg-amber-50/60 dark:bg-amber-950/10 border-amber-200 px-4 py-3 text-xs text-amber-700 dark:text-amber-300">
                Menu ini khusus Stock Opname Aktual. Data item awal mengikuti kategori produk yang dipilih saat pembuatan sesi.
            </div>

            <div className="flex-1">
                <OpnameSessionList
                    sessions={sessions}
                    basePath="/dashboard/stock-opname-aktual"
                    sourceType="actual"
                />
            </div>
        </div>
    )
}
