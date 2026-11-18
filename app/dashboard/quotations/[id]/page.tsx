import { getQuotation } from "@/app/actions/quotation"
import { getQuotationApprovalDetail } from "@/app/actions/approval-engine"
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
    if (!/^\d+$/.test(id)) {
        notFound()
    }

    const [quotation, approvalDetail] = await Promise.all([
        getQuotation(id),
        getQuotationApprovalDetail(Number(id)),
    ])

    if (!quotation) {
        notFound()
    }

    return (
        <QuotationDetail
            quotation={quotation as Parameters<typeof QuotationDetail>[0]["quotation"]}
            autoOpenPdf={pdf === "true"}
            approvalDetail={approvalDetail.success ? approvalDetail : undefined}
        />
    )
}
