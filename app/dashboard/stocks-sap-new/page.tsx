import { StockSAPNewTable } from "./_components/stock-sap-new-table"
import { getSetting } from "@/app/actions/settings"
import { getWarehouses } from "@/app/actions/warehouse"
import { PageHeader } from "@/components/page-header"
import { Database } from "lucide-react"

export default async function StocksSAPNewPage() {
    const [savedRate, warehouses] = await Promise.all([
        getSetting("manual_usd_rate"),
        getWarehouses(),
    ])

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            <div className="flex items-center gap-3">
                <div className="flex-1">
                    <PageHeader
                        title="Stock SAP New"
                        subtitle="View SAP stock data from table zmc9_stock_sap."
                        icon={Database}
                    />
                </div>
                <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider self-start mt-2">PostgreSQL</span>
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
