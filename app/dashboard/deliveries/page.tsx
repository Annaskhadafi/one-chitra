import { getDeliveries, getDeliveryItemsFlat } from "@/app/actions/delivery"
import { DeliveryTable } from "./_components/delivery-table"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { PermissionGuard } from "@/components/permission-guard"

export default async function DeliveriesPage() {
    const [deliveriesData, itemsData] = await Promise.all([
        getDeliveries(),
        getDeliveryItemsFlat()
    ])

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-bold tracking-tight">Delivery Management</h1>
                    <p className="text-muted-foreground">
                        Schedule and manage deliveries from sales orders.
                    </p>
                </div>
                <PermissionGuard resource="deliveries" action="create">
                    <Link href="/dashboard/deliveries/create">
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Create Delivery
                        </Button>
                    </Link>
                </PermissionGuard>
            </div>

            <div className="flex-1">
                <DeliveryTable data={deliveriesData} itemsData={itemsData} />
            </div>
        </div>
    )
}
