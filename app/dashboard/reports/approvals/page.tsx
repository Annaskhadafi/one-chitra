import Link from "next/link"
import { ArrowLeft, Clock3, FileCheck2, Timer, XCircle } from "lucide-react"
import { getApprovalReport } from "@/app/actions/reports"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default async function ApprovalReportPage() {
    const data = await getApprovalReport()

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
                    <h1 className="text-2xl font-bold tracking-tight">Approval Report</h1>
                    <p className="text-muted-foreground">Monitoring performa approval, lead time, dan status request.</p>
                </div>

                <div className="grid grid-cols-1 gap-4 px-4 sm:grid-cols-2 lg:grid-cols-4 lg:px-6">
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm">Total Requests</CardTitle></CardHeader>
                        <CardContent className="flex items-center justify-between">
                            <div className="text-2xl font-bold">{data.summary.totalRequests}</div>
                            <FileCheck2 className="h-5 w-5 text-muted-foreground" />
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm">Pending</CardTitle></CardHeader>
                        <CardContent className="flex items-center justify-between">
                            <div className="text-2xl font-bold">{data.summary.pendingRequests}</div>
                            <Clock3 className="h-5 w-5 text-amber-500" />
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm">Approved</CardTitle></CardHeader>
                        <CardContent className="flex items-center justify-between">
                            <div className="text-2xl font-bold">{data.summary.approvedRequests}</div>
                            <FileCheck2 className="h-5 w-5 text-emerald-500" />
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm">Rejected</CardTitle></CardHeader>
                        <CardContent className="flex items-center justify-between">
                            <div className="text-2xl font-bold">{data.summary.rejectedRequests}</div>
                            <XCircle className="h-5 w-5 text-rose-500" />
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-2 lg:px-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Average Lead Time</CardTitle>
                            <CardDescription>Rata-rata waktu dari submit sampai selesai.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-2 text-3xl font-bold">
                                <Timer className="h-7 w-7 text-muted-foreground" />
                                {data.averageLeadTimeHours.toFixed(1)}h
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Pending by Step</CardTitle>
                            <CardDescription>Distribusi beban pending per step approval.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {data.pendingByStep.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Tidak ada pending task.</p>
                            ) : (
                                data.pendingByStep.map((row) => (
                                    <div key={row.stepOrder} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                                        <span>Step {row.stepOrder}</span>
                                        <span className="font-semibold">{row.pendingCount}</span>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="px-4 lg:px-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Monthly Trend</CardTitle>
                            <CardDescription>Jumlah request submitted, approved, dan rejected per bulan.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="px-3 py-2 text-left">Month</th>
                                            <th className="px-3 py-2 text-right">Submitted</th>
                                            <th className="px-3 py-2 text-right">Approved</th>
                                            <th className="px-3 py-2 text-right">Rejected</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.monthlyTrend.map((row) => (
                                            <tr key={row.month} className="border-b last:border-0">
                                                <td className="px-3 py-2">{row.month}</td>
                                                <td className="px-3 py-2 text-right">{row.submitted}</td>
                                                <td className="px-3 py-2 text-right text-emerald-600">{row.approved}</td>
                                                <td className="px-3 py-2 text-right text-rose-600">{row.rejected}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
