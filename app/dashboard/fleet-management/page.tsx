import { getFleetTrips } from "@/app/actions/fleet-trips"
import { FleetTripTable } from "./_components/fleet-trip-table"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

export default async function FleetManagementPage() {
    const fleetTripsData = await getFleetTrips()

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-bold tracking-tight">Fleet Management</h1>
                    <p className="text-muted-foreground">
                        Manage internal fleet trips, assign drivers, and track operational costs.
                    </p>
                </div>
                <Link href="/dashboard/fleet-management/create">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        New Trip
                    </Button>
                </Link>
            </div>

            <div className="flex-1">
                <FleetTripTable data={fleetTripsData} />
            </div>
        </div>
    )
}
