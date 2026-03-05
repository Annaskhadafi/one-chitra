import { notFound } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { ReceiptText } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getSettlementById } from "@/app/actions/cost-settlement"
import { SettlementActions } from "../_components/settlement-actions"
import { SettlementItemReceipts } from "../_components/settlement-item-receipts"

const formatCurrency = (value: string | number) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(Number(value ?? 0))

export default async function SettlementDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const settlement = await getSettlementById(Number(id))

    if (!settlement) {
        notFound()
    }

    return (
        <div className="flex-1 space-y-6 p-8 pt-6">
            <PageHeader
                title={settlement.settlementNumber}
                subtitle="Detail settlement awal. Ledger preview, approval action, dan PDF export akan ditambahkan berikutnya."
                icon={ReceiptText}
            />

            <SettlementActions settlementId={settlement.id} status={settlement.status} />

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Ringkasan</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <p><span className="font-medium">Tipe:</span> {settlement.settlementType}</p>
                        <p><span className="font-medium">Tanggal:</span> {new Date(settlement.settlementDate).toLocaleDateString("id-ID")}</p>
                        <p><span className="font-medium">Driver:</span> {settlement.driverName || "-"}</p>
                        <p><span className="font-medium">Kendaraan:</span> {settlement.vehicleNumber || "-"}</p>
                        <p><span className="font-medium">Status:</span> {settlement.status}</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Nilai</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <p><span className="font-medium">Uang Muka:</span> {formatCurrency(settlement.advanceAmount)}</p>
                        <p><span className="font-medium">Total Aktual:</span> {formatCurrency(settlement.totalActualAmount)}</p>
                        <p><span className="font-medium">Selisih:</span> {formatCurrency(settlement.varianceAmount)}</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Items</CardTitle>
                </CardHeader>
                <CardContent>
                    <SettlementItemReceipts
                        items={settlement.items}
                        canUpload={settlement.status === "draft" || settlement.status === "submitted" || settlement.status === "approved"}
                    />
                </CardContent>
            </Card>
        </div>
    )
}
