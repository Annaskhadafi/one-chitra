import { getStocks } from "@/app/actions/stock"
import { getWarehouses } from "@/app/actions/warehouse"
import { StockComparison } from "./_components/stock-comparison"

export default async function InventoryPage() {
    const [localStocks, warehouses] = await Promise.all([
        getStocks(),
        getWarehouses(),
    ])

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold tracking-tight">Inventory Comparison</h1>
                    <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Stock vs SAP
                    </span>
                </div>
                <p className="text-muted-foreground">
                    Compare local stock levels against SAP inventory data to identify discrepancies and gaps.
                </p>
            </div>

            <div className="flex-1">
                <StockComparison localStocks={localStocks} warehouses={warehouses} />
            </div>
        </div>
    )
}
