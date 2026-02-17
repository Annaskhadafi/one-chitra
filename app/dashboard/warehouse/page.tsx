import { getWarehouses } from "@/app/actions/warehouse"
import { WarehouseTable } from "./_components/warehouse-table"

export default async function WarehousePage() {
    const warehouses = await getWarehouses()

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold tracking-tight">Warehouse Management</h1>
                <p className="text-muted-foreground">
                    Register and manage warehouse storage locations (Sloc).
                </p>
            </div>

            <div className="flex-1">
                <WarehouseTable data={warehouses} />
            </div>
        </div>
    )
}
