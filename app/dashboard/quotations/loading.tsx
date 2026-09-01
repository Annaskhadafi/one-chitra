import { PageHeader } from "@/components/page-header"
import { QuotationTableSkeleton } from "./_components/quotation-table-skeleton"
import { FileText } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

export default function QuotationsLoading() {
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
                <Skeleton className="h-10 w-36 rounded-md" />
            </div>

            <div className="flex-1">
                <QuotationTableSkeleton />
            </div>
        </div>
    )
}
