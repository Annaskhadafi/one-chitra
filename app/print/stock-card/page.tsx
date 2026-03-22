import { getStockCardLabelsByIdsAction } from "@/app/actions/stock-card"
import { StockCardPrintView } from "@/app/dashboard/stock-card/_components/stock-card-print-view"

type PrintStockCardPageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>
}

function parseIds(value: string | string[] | undefined) {
    const raw = Array.isArray(value) ? value.join(",") : value || ""

    return raw
        .split(",")
        .map((part) => Number.parseInt(part.trim(), 10))
        .filter((part) => Number.isFinite(part))
}

export default async function PrintStockCardPage({ searchParams }: PrintStockCardPageProps) {
    const resolvedParams = searchParams instanceof Promise ? await searchParams : searchParams
    const ids = parseIds(resolvedParams?.ids)
    const items = await getStockCardLabelsByIdsAction(ids)

    if (!items.length) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
                <div className="rounded-2xl border bg-white px-6 py-8 text-center shadow-sm">
                    <h1 className="text-xl font-semibold text-slate-900">Tidak ada label untuk dicetak</h1>
                    <p className="mt-2 text-sm text-slate-500">
                        Pilih item dari halaman Stock Card terlebih dahulu.
                    </p>
                </div>
            </div>
        )
    }

    return <StockCardPrintView items={items} />
}
