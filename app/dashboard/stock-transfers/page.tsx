import { getStockTransfers } from "@/app/actions/stock-transfer"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { StockTransferTable } from "./_components/stock-transfer-table"

export default async function StockTransfersPage() {
    const transfers = await getStockTransfers()

    return (
        <div className="flex flex-col gap-6 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Stock Transfers</h1>
                    <p className="text-muted-foreground">
                        Manage and view stock movements between warehouses
                    </p>
                </div>
                <Link href="/dashboard/stock-transfers/create">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        New Transfer
                    </Button>
                </Link>
            </div>

            <StockTransferTable data={transfers} />
        </div>
    )
}
