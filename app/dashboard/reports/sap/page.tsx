import { getSAPIntegrationReport } from "@/app/actions/reports"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ReportKPIGrid, ExportButton } from "@/components/reports/report-components"
import { ArrowLeft, RefreshCw, AlertTriangle, CheckCircle, Database } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"

export default async function SAPIntegrationReportPage() {
    const data = await getSAPIntegrationReport()

    const errorsCount = data.syncErrors.length
    const discrepanciesCount = data.dataDiscrepancy.filter(d => d.difference !== 0).length

    const kpis: React.ComponentProps<typeof ReportKPIGrid>["kpis"] = [
        {
            title: "Systems Status",
            value: errorsCount === 0 ? "Connected" : "Issues Detected",
            icon: "database",
            variant: errorsCount === 0 ? "success" : "danger",
        },
        {
            title: "Recent Sync Errors",
            value: errorsCount.toString(),
            icon: "alert",
            variant: errorsCount > 0 ? "danger" : "default",
        },
        {
            title: "Data Discrepancies",
            value: discrepanciesCount.toString(),
            icon: "repeat",
            variant: discrepanciesCount > 0 ? "warning" : "success",
        },
        {
            title: "Last Successful Sync",
            value: data.syncStatus.find(s => s.status === 'success')?.lastSync?.toLocaleTimeString() || "N/A",
            icon: "check",
            variant: "default",
        },
    ]

    return (
        <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                {/* Header with Back Button */}
                <div className="px-4 lg:px-6 flex items-center gap-4">
                    <Link href="/dashboard/reports" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Reports
                    </Link>
                </div>

                <div className="px-4 lg:px-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">SAP Integration Report</h1>
                        <p className="text-muted-foreground">
                            Monitor synchronization status, errors, and data alignment
                        </p>
                    </div>
                </div>

                {/* KPI Cards */}
                <ReportKPIGrid kpis={kpis} />

                {/* Sync Status Cards */}
                <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-4 lg:px-6">
                    {data.syncStatus.map((status, i) => (
                        <Card key={i} className={status.status === 'error' ? 'border-rose-200 bg-rose-50/50 dark:bg-rose-950/20' : ''}>
                            <CardHeader className="py-4">
                                <CardTitle className="text-sm font-medium flex items-center justify-between">
                                    {status.type}
                                    {status.status === 'success' ? (
                                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                                    ) : (
                                        <AlertTriangle className="h-4 w-4 text-rose-500" />
                                    )}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pb-4">
                                <p className="text-xs text-muted-foreground mb-1">Last Sync</p>
                                <p className="text-sm font-medium">
                                    {status.lastSync ? status.lastSync.toLocaleString() : "Never"}
                                </p>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-2 lg:px-6 mb-6">
                    {/* Data Discrepancy Table */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Data Discrepancy</CardTitle>
                                    <CardDescription>Differences between Local and SAP database counts</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b bg-muted/50">
                                            <th className="text-left py-3 px-4 font-medium text-xs">Entity</th>
                                            <th className="text-right py-3 px-4 font-medium text-xs">Local DB</th>
                                            <th className="text-right py-3 px-4 font-medium text-xs">SAP</th>
                                            <th className="text-right py-3 px-4 font-medium text-xs">Difference</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.dataDiscrepancy.map((disc, i) => (
                                            <tr key={i} className="border-b hover:bg-muted/30">
                                                <td className="py-3 px-4 text-sm font-medium">{disc.entity}</td>
                                                <td className="py-3 px-4 text-sm text-right tabular-nums">{disc.localCount.toLocaleString()}</td>
                                                <td className="py-3 px-4 text-sm text-right tabular-nums">{disc.sapCount.toLocaleString()}</td>
                                                <td className="py-3 px-4 text-sm text-right tabular-nums font-medium">
                                                    {disc.difference !== 0 ? (
                                                        <Badge variant="destructive">{Math.abs(disc.difference)}</Badge>
                                                    ) : (
                                                        <span className="text-emerald-500 text-xs">✅ Match</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Sync Errors */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Recent Sync Errors</CardTitle>
                                    <CardDescription>Logs of failed synchronizations</CardDescription>
                                </div>
                                <ExportButton data={data.syncErrors} filename="sync-errors" format="csv" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            {data.syncErrors.length === 0 ? (
                                <div className="flex h-[200px] items-center justify-center text-muted-foreground">
                                    <div className="text-center">
                                        <CheckCircle className="h-12 w-12 mx-auto mb-2 text-emerald-500 opacity-50" />
                                        <p>No recent synchronization errors.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b bg-muted/50">
                                                <th className="text-left py-3 px-4 font-medium text-xs">Type</th>
                                                <th className="text-left py-3 px-4 font-medium text-xs">Date</th>
                                                <th className="text-left py-3 px-4 font-medium text-xs">Error Description</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.syncErrors.map((err, i) => (
                                                <tr key={i} className="border-b hover:bg-muted/30">
                                                    <td className="py-3 px-4 text-sm font-medium">
                                                        <Badge variant="outline">{err.type}</Badge>
                                                    </td>
                                                    <td className="py-3 px-4 text-sm whitespace-nowrap">{err.date.toLocaleString()}</td>
                                                    <td className="py-3 px-4 text-sm text-rose-600 line-clamp-2">{err.error}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
