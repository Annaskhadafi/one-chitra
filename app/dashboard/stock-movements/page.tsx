import { getStockMovements } from "@/app/actions/stock-movement"
import { getWarehouses } from "@/app/actions/warehouse"
import { MovementTable } from "./_components/movement-table"

export default async function StockMovementsPage() {
    const [movements, warehouses] = await Promise.all([
        getStockMovements(),
        getWarehouses()
    ])

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold tracking-tight">Stock Movement Log</h1>
                <p className="text-muted-foreground">
                    Track all incoming and outgoing stock transactions.
                </p>
            </div>

            <div className="flex-1">
                <MovementTable
                    data={movements}
                    warehouses={warehouses}
                />
            </div>
        </div>
    )
}
