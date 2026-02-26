import { getQuotations } from "@/app/actions/quotation"
import { QuotationTable } from "./_components/quotation-table"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

export default async function QuotationsPage() {
    const quotations = await getQuotations()

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-bold tracking-tight">Quotations</h1>
                    <p className="text-muted-foreground">
                        Manage quotations and pricing proposals.
                    </p>
                </div>
                <Link href="/dashboard/quotations/create">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Create Quotation
                    </Button>
                </Link>
            </div>

            <div className="flex-1">
                <QuotationTable data={quotations} />
            </div>
        </div>
    )
}
