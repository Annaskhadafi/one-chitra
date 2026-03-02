import { getDeliveries, getDeliveryItemsFlat } from "@/app/actions/delivery"
import { DeliveryTable } from "./_components/delivery-table"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Plus, Truck } from "lucide-react"
import { PermissionGuard } from "@/components/permission-guard"
import { PageHeader } from "@/components/page-header"
import { ReportPieChart, ReportBarChart } from "@/components/reports/report-charts"

export default async function DeliveriesPage() {
    const [deliveriesData, itemsData] = await Promise.all([
        getDeliveries(),
        getDeliveryItemsFlat()
    ])

    // KPI Calculations
    const scheduled = deliveriesData.filter(d => d.status.toLowerCase() === "scheduled").length
    const delivered = deliveriesData.filter(d => d.status.toLowerCase() === "delivered").length
    const cancelled = deliveriesData.filter(d => d.status.toLowerCase() === "cancelled").length

    // Status Distribution Data
    const statusData = [
        { name: "Scheduled", value: scheduled },
        { name: "Delivered", value: delivered },
        { name: "Cancelled", value: cancelled },
    ].filter(d => d.value > 0)

    // Top Customers by Deliveries
    const customerMap: Record<string, number> = {}
    deliveriesData.forEach(d => {
        const name = d.salesOrder?.customer?.name || "Unknown"
        customerMap[name] = (customerMap[name] || 0) + 1
    })
    const customerData = Object.entries(customerMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10)

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex-1">
                    <PageHeader
                        title="Delivery Management"
                        subtitle="Schedule and manage deliveries from sales orders."
                        icon={Truck}
                    />
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
            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                    <ReportPieChart
                        data={statusData}
                        title="Status Distribusi"
                        description="Perbandingan status pengiriman saat ini"
                        variant="donut"
                        height={300}
                    />
                </div>
                <div className="lg:col-span-2">
                    <ReportBarChart
                        data={customerData}
                        title="Top 10 Pelanggan (Pengiriman)"
                        description="Berdasarkan jumlah transaksi pengiriman terbanyak"
                        height={300}
                    />
                </div>
            </div>

            <div className="flex-1">
                <DeliveryTable data={deliveriesData} itemsData={itemsData} />
            </div>
        </div>
    )
}
