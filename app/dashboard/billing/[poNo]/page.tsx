import { getBillingRecordByPo } from "@/app/actions/billing"
import { BillingDetailClient } from "./client-page"
import { notFound } from "next/navigation"

interface PageProps {
    params: Promise<{
        poNo: string
    }>
    searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>
}

export default async function BillingDetailPage({ params, searchParams }: PageProps) {
    const { poNo } = await params
    const resolvedSearchParams = searchParams instanceof Promise ? await searchParams : searchParams

    // params is URL encoded, we need to decode it
    const decodedPoNo = decodeURIComponent(poNo)
    const invoice = Array.isArray(resolvedSearchParams?.invoice)
        ? resolvedSearchParams?.invoice[0]
        : resolvedSearchParams?.invoice

    const result = await getBillingRecordByPo(decodedPoNo, invoice)

    if (!result.success || !result.data) {
        notFound()
    }

    const billingData = result.data

    return <BillingDetailClient data={billingData} />
}
