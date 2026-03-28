import { getSalesReport } from "@/app/actions/reports"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { SalesReportClient } from "./sales-report-client"

export default async function SalesReportPage() {
    const data = await getSalesReport()

    return (
        <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="px-4 py-4 lg:px-6">
                <Link href="/dashboard/reports" className="inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-900">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Reports
                </Link>
            </div>
            <SalesReportClient data={data} />
        </div>
    )
}
