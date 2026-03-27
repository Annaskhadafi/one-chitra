import { ReceiptText } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { getFleetTrips } from "@/app/actions/fleet-trips"
import { getDeliveries } from "@/app/actions/delivery"
import { SettlementCreateForm } from "../_components/settlement-create-form"

export default async function CreateCostSettlementPage() {
    const [fleetTrips, deliveries] = await Promise.all([
        getFleetTrips(),
        getDeliveries(),
    ])

    const toNumber = (value: string | number | null | undefined) => Number(value ?? 0)
    const sumCostFields = (payload: {
        costGasoline?: string | number | null
        costGasolineDexlite?: string | number | null
        costGasolineBio?: string | number | null
        costToll?: string | number | null
        costParking?: string | number | null
        costMeals?: string | number | null
        costMaintenance?: string | number | null
        costOthers?: string | number | null
        costRapidTest?: string | number | null
        costFerry?: string | number | null
        costPortal?: string | number | null
        costWashing?: string | number | null
        costEscort?: string | number | null
    }) => (
        toNumber(payload.costGasoline)
        + toNumber(payload.costGasolineDexlite)
        + toNumber(payload.costGasolineBio)
        + toNumber(payload.costToll)
        + toNumber(payload.costParking)
        + toNumber(payload.costMeals)
        + toNumber(payload.costMaintenance)
        + toNumber(payload.costOthers)
        + toNumber(payload.costRapidTest)
        + toNumber(payload.costFerry)
        + toNumber(payload.costPortal)
        + toNumber(payload.costWashing)
        + toNumber(payload.costEscort)
    )

    const tripOptions = fleetTrips.map((trip) => ({
        id: trip.id,
        tripNumber: trip.tripNumber,
        driverLabel: `${trip.driver?.name || "Tanpa Driver"} • ${new Date(trip.date).toLocaleDateString("id-ID")}`,
        advanceAmount: sumCostFields(trip),
    }))

    const deliveryOptions = deliveries.map((delivery) => ({
        id: delivery.id,
        deliveryNumber: delivery.deliveryNumber,
        customerName: delivery.salesOrder?.customer?.name || "Tanpa Customer",
        advanceAmount: delivery.isExternal
            ? toNumber(delivery.shippingCost)
            : sumCostFields(delivery),
    }))

    return (
        <div className="flex-1 space-y-6 p-8 pt-6">
            <PageHeader
                title="Buat Cost Settlement"
                subtitle="Input settlement aktual, item biaya, dan penandatangan untuk diproses approval."
                icon={ReceiptText}
            />

            <SettlementCreateForm fleetTrips={tripOptions} deliveries={deliveryOptions} />
        </div>
    )
}
