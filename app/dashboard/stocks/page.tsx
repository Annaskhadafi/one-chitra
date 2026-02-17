import { getStocks } from "@/app/actions/stock"
import { StockTable } from "./_components/stock-table"

export default async function StocksPage() {
    const stocks = await getStocks()

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold tracking-tight">Stock Management</h1>
                <p className="text-muted-foreground">
                    Monitor inventory levels and valuations across all locations.
                </p>
            </div>

            <div className="flex-1">
                <StockTable data={stocks} />
            </div>
        </div>
    )
}
