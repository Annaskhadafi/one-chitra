import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { getMonthlyScmReport } from "@/app/actions/reports"
import { ScmMonthlyReportClient } from "./scm-monthly-report-client"

export default async function ScmMonthlyReportPage() {
    const initialData = await getMonthlyScmReport()

    return (
        <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                <div className="px-4 lg:px-6 flex items-center gap-4">
                    <Link href="/dashboard/reports" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Reports
                    </Link>
                </div>

                <div className="px-4 lg:px-6">
                    <h1 className="text-2xl font-bold tracking-tight">Report Monthly SCM</h1>
                    <p className="text-muted-foreground">
                        Report bulanan untuk GR Manual, barang delivered, dan delivery product 27.00 R 49.
                    </p>
                </div>

                <ScmMonthlyReportClient initialData={initialData} />
            </div>
        </div>
    )
}
