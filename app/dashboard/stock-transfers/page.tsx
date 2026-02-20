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
        <div className="flex flex-col gap-8 p-8 max-w-[1600px] mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">Stock Transfers</h1>
                    <p className="text-muted-foreground">
                        Manage and monitor inventory movements across your warehouse network
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Link href="/dashboard/stock-transfers/create">
                        <Button className="shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
                            <Plus className="mr-2 h-4 w-4" />
                            New Transfer
                        </Button>
                    </Link>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card className="relative overflow-hidden group transition-all hover:shadow-md border-primary/10">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <ArrowLeftRight className="h-12 w-12" />
                    </div>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Transfers</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalTransfers}</div>
                        <p className="text-xs text-muted-foreground mt-1">All time records</p>
                    </CardContent>
                </Card>
                <Card className="relative overflow-hidden group transition-all hover:shadow-md border-emerald-500/10">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                    </div>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.completedTransfers}</div>
                        <p className="text-xs text-muted-foreground mt-1">Successful movements</p>
                    </CardContent>
                </Card>
                <Card className="relative overflow-hidden group transition-all hover:shadow-md border-amber-500/10">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Clock className="h-12 w-12 text-amber-500" />
                    </div>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.pendingTransfers}</div>
                        <p className="text-xs text-muted-foreground mt-1">Awaiting processing</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-none bg-transparent shadow-none">
                <StockTransferTable data={transfers} />
            </Card>
        </div>
    )
}
