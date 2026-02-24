import { getStockTransfers, getStockTransferStats } from "@/app/actions/stock-transfer"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Plus, ArrowLeftRight, CheckCircle2, Clock } from "lucide-react"
import { StockTransferTable } from "./_components/stock-transfer-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default async function StockTransfersPage() {
    const transfers = await getStockTransfers()
    const stats = await getStockTransferStats()

    return (
        <div className="flex flex-col gap-8 p-8 w-full">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 dark:from-blue-950/30 dark:via-purple-950/30 dark:to-pink-950/30 p-6 rounded-xl border border-blue-200/50 dark:border-blue-800/50">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">Stock Transfers</h1>
                    <p className="text-muted-foreground font-medium">
                        Stock transfers are automatically created from Delivery with PO type VHS Consignment
                    </p>
                </div>
                {/* New Transfer button hidden - stock transfers come from Delivery with PO type VHS Consignment */}
                {/* <div className="flex items-center gap-3">
                    <Link href="/dashboard/stock-transfers/create">
                        <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg shadow-purple-500/30 transition-all hover:scale-[1.02] active:scale-[0.98]">
                            <Plus className="mr-2 h-4 w-4" />
                            New Transfer
                        </Button>
                    </Link>
                </div> */}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card className="relative overflow-hidden group transition-all hover:shadow-lg hover:scale-[1.02] border-none bg-gradient-to-br from-blue-500 to-cyan-500 text-white">
                    <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-30 transition-opacity">
                        <ArrowLeftRight className="h-16 w-16" />
                    </div>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-blue-50">Total Transfers</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{stats.totalTransfers}</div>
                        <p className="text-xs text-blue-100 mt-1">All time records</p>
                    </CardContent>
                </Card>
                <Card className="relative overflow-hidden group transition-all hover:shadow-lg hover:scale-[1.02] border-none bg-gradient-to-br from-emerald-500 to-teal-500 text-white">
                    <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-30 transition-opacity">
                        <CheckCircle2 className="h-16 w-16" />
                    </div>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-emerald-50">Completed</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{stats.completedTransfers}</div>
                        <p className="text-xs text-emerald-100 mt-1">Successful movements</p>
                    </CardContent>
                </Card>
                <Card className="relative overflow-hidden group transition-all hover:shadow-lg hover:scale-[1.02] border-none bg-gradient-to-br from-amber-500 to-orange-500 text-white">
                    <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-30 transition-opacity">
                        <Clock className="h-16 w-16" />
                    </div>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-amber-50">Pending</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{stats.pendingTransfers}</div>
                        <p className="text-xs text-amber-100 mt-1">Awaiting processing</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-none bg-transparent shadow-none">
                <StockTransferTable data={transfers} />
            </Card>
        </div>
    )
}
