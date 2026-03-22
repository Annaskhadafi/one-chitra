import { getStocks } from "@/app/actions/stock"
import { getWarehouses } from "@/app/actions/warehouse"
import { StockComparison } from "./_components/stock-comparison"
import { PageHeader } from "@/components/page-header"
import { Warehouse } from "lucide-react"

export default async function InventoryPage() {
    const [localStocks, warehouses] = await Promise.all([
        getStocks(),
        getWarehouses(),
    ])

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            <div className="flex items-center gap-3">
                <div className="flex-1">
                    <PageHeader
                        title="Inventory Comparison"
                        subtitle="Compare local stock levels against SAP inventory data to identify discrepancies and gaps."
                        icon={Warehouse}
                    />
                </div>
                <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider self-start mt-2">
                    Stock vs SAP
                </span>
            </div>

            <div className="flex-1">
                <StockComparison localStocks={localStocks} warehouses={warehouses} />
            </div>
        </div>
    )
}
