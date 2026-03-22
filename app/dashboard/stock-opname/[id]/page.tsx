import { notFound } from "next/navigation"
import { getStockOpnameSession } from "@/app/actions/stock-opname"
import { OpnameDetailView } from "../_components/opname-detail-view"
import Link from "next/link"

interface Props {
    params: Promise<{ id: string }>
}

export default async function StockOpnameDetailPage({ params }: Props) {
    const { id } = await params
    const sessionId = parseInt(id)

    if (isNaN(sessionId)) notFound()

    const session = await getStockOpnameSession(sessionId, "sap")
    if (!session) notFound()

    const totalItems = session.items?.length ?? 0
    const countedItems = session.items?.filter((i) => i.countedQty !== null).length ?? 0
    const variantItems = session.items?.filter((i) => i.variance !== null && i.variance !== 0).length ?? 0
    const progress = totalItems > 0 ? Math.round((countedItems / totalItems) * 100) : 0

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Link href="/dashboard/stock-opname" className="hover:underline">Stock Opname</Link>
                    <span>/</span>
                    <span className="text-foreground font-medium">{session.name}</span>
                </div>
                <h1 className="text-2xl font-bold tracking-tight">{session.name}</h1>
                <p className="text-muted-foreground text-sm">
                    Warehouse: <strong>{session.warehouse?.sloc}</strong>
                    {session.warehouse?.description && ` — ${session.warehouse.description}`}
                    {session.notes && <span className="ml-3">· {session.notes}</span>}
                </p>
            </div>

            {/* Progress */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="rounded-xl border bg-card p-4 flex flex-col gap-1">
                    <p className="text-xs text-muted-foreground">Total Produk</p>
                    <p className="text-2xl font-bold">{totalItems}</p>
                </div>
                <div className="rounded-xl border bg-card p-4 flex flex-col gap-1">
                    <p className="text-xs text-muted-foreground">Sudah Dihitung</p>
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{countedItems}</p>
                </div>
                <div className="rounded-xl border bg-card p-4 flex flex-col gap-1">
                    <p className="text-xs text-muted-foreground">Ada Selisih</p>
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{variantItems}</p>
                </div>
                <div className="rounded-xl border bg-card p-4 flex flex-col gap-1">
                    <p className="text-xs text-muted-foreground">Progress</p>
                    <p className="text-2xl font-bold">{progress}%</p>
                    <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden mt-1">
                        <div
                            className="h-full rounded-full bg-emerald-500 transition-all"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            </div>

            <OpnameDetailView session={session} sourceType="sap" />
        </div>
    )
}
