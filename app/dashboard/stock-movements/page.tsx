import { getStockMovements } from "@/app/actions/stock-movement"
import { getWarehouses } from "@/app/actions/warehouse"
import { MovementDashboard } from "./_components/movement-dashboard"

export default async function StockMovementsPage() {
    const [movements, warehouses] = await Promise.all([
        getStockMovements(),
        getWarehouses()
    ])

    return <MovementDashboard movements={movements} warehouses={warehouses} />
}
