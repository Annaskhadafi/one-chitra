import { Suspense } from "react"
import { getQuotations, getQuotationCreators } from "@/app/actions/quotation"
import { QuotationTable } from "./_components/quotation-table"
import { QuotationTableSkeleton } from "./_components/quotation-table-skeleton"
import { PageHeader } from "@/components/page-header"
import { CreateQuotationButton } from "./_components/create-quotation-button"
import { FileText } from "lucide-react"

import { auth } from "@/lib/auth"
import { headers } from "next/headers"

export const dynamic = "force-dynamic"

async function QuotationTableContainer() {
    const session = await auth.api.getSession({ headers: await headers() })
    const currentUserId = session?.user?.id || null

    const [quotations, availableCreators] = await Promise.all([
        getQuotations({ userId: currentUserId }),
        getQuotationCreators(),
    ])

    return (
        <QuotationTable
            data={quotations as Parameters<typeof QuotationTable>[0]["data"]}
            currentUserId={currentUserId}
            availableCreators={availableCreators}
        />
    )
}

export default function QuotationsPage() {
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
                <Suspense fallback={<QuotationTableSkeleton />}>
                    <QuotationTableContainer />
                </Suspense>
            </div>
        </div>
    )
}
