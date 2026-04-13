import { notFound } from "next/navigation"
import { getOpnamePdfReportData } from "@/app/actions/stock-opname"
import { OpnamePdfReport } from "../../_components/opname-pdf-report"
import { parseStockOpnameSortKey, parseStockOpnameSortOrder } from "@/lib/stock-opname-sort"

interface Props {
    params: Promise<{ id: string }>
    searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>
}

export default async function StockOpnamePdfPage({ params, searchParams }: Props) {
    const { id } = await params
    const sessionId = parseInt(id)
    const resolvedSearchParams = searchParams instanceof Promise ? await searchParams : searchParams

    if (isNaN(sessionId)) notFound()

    const result = await getOpnamePdfReportData(sessionId, "sap", {
        sortKey: parseStockOpnameSortKey(resolvedSearchParams?.sortKey),
        sortOrder: parseStockOpnameSortOrder(resolvedSearchParams?.sortOrder),
    })
    
    if (!result.success || !result.data) {
        notFound()
    }

    return <OpnamePdfReport data={result.data} />
}
