import { StockSAPNewTable } from "./_components/stock-sap-new-table"
import { getSetting } from "@/app/actions/settings"
import { getWarehouses } from "@/app/actions/warehouse"

export default async function StocksSAPNewPage() {
    const [savedRate, warehouses] = await Promise.all([
        getSetting("manual_usd_rate"),
        getWarehouses(),
    ])

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold tracking-tight">Stock SAP New</h1>
                    <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">PostgreSQL</span>
                </div>
                <p className="text-muted-foreground">
                    View SAP stock data from table zmc9_stock_sap.
                </p>
            </div>

            <div className="flex-1">
                <StockSAPNewTable
                    defaultRate={savedRate || "16000"}
                    warehouses={warehouses}
                />
            </div>
        </div>
    )
}
