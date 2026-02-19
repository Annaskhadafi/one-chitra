import { Metadata } from "next"
import { HistoryOrderTable } from "./_components/history-order-table"

export const metadata: Metadata = {
    title: "History Order",
    description: "Historical order data and analysis",
}

export default function HistoryOrderPage() {
    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">History Order</h2>
            </div>
            <HistoryOrderTable />
        </div>
    )
}
