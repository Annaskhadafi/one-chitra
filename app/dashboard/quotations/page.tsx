import { getQuotations } from "@/app/actions/quotation"
import { QuotationTable } from "./_components/quotation-table"
import { PageHeader } from "@/components/page-header"
import { Suspense } from "react"
import { Providers } from "@/components/providers"
import { CreateQuotationButton } from "./_components/create-quotation-button"
import { FileText } from "lucide-react"

export const dynamic = 'force-dynamic'

export default async function QuotationsPage() {
    const quotations = await getQuotations()

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex-1">
                    <PageHeader
                        title="Quotations"
                        subtitle="Manage quotations and pricing proposals."
                        icon={FileText}
                    />
                </div>
                <CreateQuotationButton />
            </div>

            <div className="flex-1">
                <Providers>
                    <Suspense fallback={<div>Loading...</div>}>
                        <QuotationTable data={quotations as Parameters<typeof QuotationTable>[0]["data"]} />
                    </Suspense>
                </Providers>
            </div>
        </div>
    )
}
