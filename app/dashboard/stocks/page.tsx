import { getStocks } from "@/app/actions/stock"
import { getProducts } from "@/app/actions/product"
import { getWarehouses } from "@/app/actions/warehouse"
import { getSetting } from "@/app/actions/settings"
import { StockTable } from "./_components/stock-table"

export default async function StocksPage() {
    // Force re-compile to fix module factory error
    const [stocks, products, warehouses, savedRate] = await Promise.all([
        getStocks(),
        getProducts(),
        getWarehouses(),
        getSetting("manual_usd_rate")
    ])

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold tracking-tight">Stock Management</h1>
                <p className="text-muted-foreground">
                    Monitor inventory levels and valuations across all locations.
                </p>
            </div>

            <div className="flex-1">
                <StockTable
                    data={stocks}
                    products={products}
                    warehouses={warehouses}
                    defaultRate={savedRate || "1"}
                />
            </div>
        </div>
    )
}
