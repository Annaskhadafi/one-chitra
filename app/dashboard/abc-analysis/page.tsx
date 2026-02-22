import { getABCAnalysis } from "@/app/actions/abc-analysis"
import { ABCAnalysisTable } from "./_components/abc-analysis-table"
import { ABCDistributionChart } from "./_components/abc-distribution-chart"

export default async function ABCAnalysisPage() {
    const data = await getABCAnalysis(12)

    const countA = data.filter((d) => d.abcClass === "A").length
    const countB = data.filter((d) => d.abcClass === "B").length
    const countC = data.filter((d) => d.abcClass === "C").length
    const pctA = data.length > 0 ? Math.round((countA / data.length) * 100) : 0
    const pctB = data.length > 0 ? Math.round((countB / data.length) * 100) : 0
    const pctC = data.length > 0 ? Math.round((countC / data.length) * 100) : 0

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold tracking-tight">ABC Analysis</h1>
                    <span className="bg-violet-100 text-violet-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                        12 Bulan Terakhir
                    </span>
                </div>
                <p className="text-muted-foreground">
                    Klasifikasi produk berdasarkan volume pergerakan stok. A = Fast movers (80%), B = Medium (15%), C = Slow movers (5%).
                </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-xl border bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900 p-5 flex flex-col gap-1">
                    <p className="text-sm text-emerald-600 dark:text-emerald-400 font-semibold">Kelas A — Fast Movers</p>
                    <div className="flex items-end gap-2">
                        <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">{countA}</p>
                        <p className="text-sm text-emerald-600 mb-1">produk ({pctA}%)</p>
                    </div>
                    <p className="text-xs text-muted-foreground">Berkontribusi 80% dari total pergerakan</p>
                </div>
                <div className="rounded-xl border bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900 p-5 flex flex-col gap-1">
                    <p className="text-sm text-blue-600 dark:text-blue-400 font-semibold">Kelas B — Medium Movers</p>
                    <div className="flex items-end gap-2">
                        <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">{countB}</p>
                        <p className="text-sm text-blue-600 mb-1">produk ({pctB}%)</p>
                    </div>
                    <p className="text-xs text-muted-foreground">Berkontribusi 15% dari total pergerakan</p>
                </div>
                <div className="rounded-xl border bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 p-5 flex flex-col gap-1">
                    <p className="text-sm text-slate-600 dark:text-slate-400 font-semibold">Kelas C — Slow Movers</p>
                    <div className="flex items-end gap-2">
                        <p className="text-3xl font-bold text-slate-700 dark:text-slate-300">{countC}</p>
                        <p className="text-sm text-slate-600 mb-1">produk ({pctC}%)</p>
                    </div>
                    <p className="text-xs text-muted-foreground">Berkontribusi 5% dari total pergerakan</p>
                </div>
            </div>

            {/* Chart */}
            {data.length > 0 && (
                <div className="rounded-xl border p-5 bg-card">
                    <h2 className="text-sm font-semibold mb-4">Distribusi Kelas ABC</h2>
                    <ABCDistributionChart countA={countA} countB={countB} countC={countC} />
                </div>
            )}

            {/* Table */}
            <div className="flex-1">
                <ABCAnalysisTable data={data} />
            </div>
        </div>
    )
}
