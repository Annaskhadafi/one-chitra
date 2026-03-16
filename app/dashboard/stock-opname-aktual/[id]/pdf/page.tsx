import { notFound } from "next/navigation"
import { getOpnamePdfReportData } from "@/app/actions/stock-opname"
import { OpnamePdfReport } from "@/app/dashboard/stock-opname/_components/opname-pdf-report"

interface Props {
    params: Promise<{ id: string }>
}

export default async function StockOpnameAktualPdfPage({ params }: Props) {
    const { id } = await params
    const sessionId = parseInt(id)

    if (isNaN(sessionId)) notFound()

    const result = await getOpnamePdfReportData(sessionId, "actual")

    if (!result.success || !result.data) {
        notFound()
    }

    return <OpnamePdfReport data={result.data} />
}
