import { getTirePerformanceRecords } from "@/app/actions/tire-performance"
import { TirePerformanceClient } from "./_components/tire-performance-client"

export const metadata = {
    title: "Tire Performance",
}

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function TirePerformancePage() {
    const records = await getTirePerformanceRecords()

    return (
        <div className="flex-1 bg-muted/20 p-4 pt-4 md:p-6">
            <TirePerformanceClient data={records} />
        </div>
    )
}
