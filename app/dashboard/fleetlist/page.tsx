import { FleetListTable } from "./_components/fleet-list-table"

export default function FleetListPage() {
    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold tracking-tight">Fleetlist</h1>
                    <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Live API</span>
                </div>
                <p className="text-muted-foreground">
                    Monitor fleet distribution and status across all locations.
                </p>
            </div>

            <div className="flex-1">
                <FleetListTable />
            </div>
        </div>
    )
}
