import { getAllForecastsGrouped } from "@/app/actions/forecasts"
import { ForecastsClient } from "./_components/forecasts-client"

export const metadata = {
    title: "Master Data Forecast - One Chitra",
}

export default async function ForecastsPage() {
    const response = await getAllForecastsGrouped()
    const data = response.success && response.data ? response.data : []

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 relative h-[calc(100vh-4rem)] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Master Data Forecast</h2>
            </div>

            {/* The main container for client components that handles scrolling if needed */}
            <div className="flex-1 min-h-0">
                <ForecastsClient initialData={data} />
            </div>
        </div>
    )
}
