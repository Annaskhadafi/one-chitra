import { notFound } from "next/navigation"
import { getOpnamePdfReportData } from "@/app/actions/stock-opname"
import { OpnamePdfReport } from "../../_components/opname-pdf-report"

interface Props {
    params: Promise<{ id: string }>
}

export default async function StockOpnamePdfPage({ params }: Props) {
    const { id } = await params
    const sessionId = parseInt(id)

    if (isNaN(sessionId)) notFound()

    const result = await getOpnamePdfReportData(sessionId, "sap")
    
    if (!result.success || !result.data) {
        notFound()
    }

    return <OpnamePdfReport data={result.data} />
}
