import { ReceiptText } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getSettlements, getSettlementSummary } from "@/app/actions/cost-settlement"
import { SettlementTable } from "./_components/settlement-table"

const formatCurrency = (value: number) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(value)

export default async function CostSettlementsPage() {
    const [summary, settlements] = await Promise.all([
        getSettlementSummary(),
        getSettlements(),
    ])

    return (
        <div className="flex-1 space-y-6 p-8 pt-6">
            <PageHeader
                title="Cost Settlement"
                subtitle="Rekonsiliasi biaya aktual pengiriman, nota, dan approval settlement."
                icon={ReceiptText}
            />

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Settlement</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold">{summary.totalSettlements}</CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Pending Approval</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold">{summary.pendingApprovalCount}</CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Aktual</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold">{formatCurrency(summary.totalActual)}</CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Selisih</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold">{formatCurrency(summary.totalVariance)}</CardContent>
                </Card>
            </div>

            <SettlementTable data={settlements} />
        </div>
    )
}
