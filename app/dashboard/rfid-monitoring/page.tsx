import { getProducts } from "@/app/actions/product"
import { getRfidMonitoringSummary } from "@/app/actions/rfid"
import { getWarehouses } from "@/app/actions/warehouse"
import { RfidMonitoringConsole } from "./_components/rfid-monitoring-console"

export default async function RfidMonitoringPage() {
    const [summary, products, warehouses] = await Promise.all([
        getRfidMonitoringSummary(),
        getProducts(),
        getWarehouses(),
    ])

    return (
        <RfidMonitoringConsole
            summary={summary}
            products={products}
            warehouses={warehouses}
        />
    )
}
