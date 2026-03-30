import { getQuotations } from "@/app/actions/quotation"
import { QuotationTable } from "./_components/quotation-table"
import { QuotationsPageClient } from "./_components/quotations-page-client"

export const dynamic = 'force-dynamic'

export default async function QuotationsPage() {
    const quotations = await getQuotations()

    return (
        <QuotationsPageClient 
            data={quotations as Parameters<typeof QuotationTable>[0]["data"]} 
        />
    )
}
