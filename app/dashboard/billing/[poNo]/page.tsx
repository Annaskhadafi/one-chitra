import { getBillingRecordByPo } from "@/app/actions/billing"
import { BillingDetailClient } from "./client-page"
import { notFound } from "next/navigation"
import type { BillingRecordDisplay } from "@/lib/types"

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

    return <BillingDetailClient data={result.data as BillingRecordDisplay} />
}
