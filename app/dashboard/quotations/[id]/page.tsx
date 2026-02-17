import { getQuotation } from "@/app/actions/quotation"
import { notFound } from "next/navigation"
import { QuotationDetail } from "../_components/quotation-detail"

export default async function QuotationDetailPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>
    searchParams: Promise<{ pdf?: string }>
}) {
    const { id } = await params
    const { pdf } = await searchParams
    const quotation = await getQuotation(Number(id))

    if (!quotation) {
        notFound()
    }

    return <QuotationDetail quotation={quotation} autoOpenPdf={pdf === "true"} />
}
