import { getDrivers, getVehicles } from "@/app/actions/fleet"
import { getSalesOrdersForDelivery } from "@/app/actions/delivery"
import { FleetTripForm } from "../_components/fleet-trip-form"

export default async function CreateFleetTripPage() {
    const drivers = await getDrivers()
    const vehicles = await getVehicles()
    const salesOrders = await getSalesOrdersForDelivery()

    // Map salesOrders to match form props if needed, or pass directly if compatible.
    // The form expects: SalesOrder { id, invoiceNumber, customerPo, customer: { name }, items: { remainingQuantity }[] }
    // getSalesOrdersForDelivery returns: SalesOrder & { items: (SalesOrderItem & { remainingQuantity })[] }
    // It should be compatible enough for the subset we need.

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold tracking-tight">Create Fleet Trip</h1>
                <p className="text-muted-foreground">
                    Schedule a new fleet trip and assign deliveries.
                </p>
            </div>

            <FleetTripForm
                drivers={drivers}
                vehicles={vehicles}
                salesOrders={salesOrders}
            />
        </div>
    )
}
