import { getBillingRecordByPo } from "@/app/actions/billing"
import { BillingDetailClient } from "./client-page"
import { notFound } from "next/navigation"

interface PageProps {
    params: Promise<{
        poNo: string
    }>
}

export default async function BillingDetailPage({ params }: PageProps) {
    const { poNo } = await params

    // params is URL encoded, we need to decode it
    const decodedPoNo = decodeURIComponent(poNo)

    const result = await getBillingRecordByPo(decodedPoNo)

    if (!result.success || !result.data) {
        notFound()
    }

    const billingData = result.data

    return <BillingDetailClient data={billingData} />
}
