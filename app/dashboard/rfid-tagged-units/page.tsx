import { getRfidTaggedUnitsOverview } from "@/app/actions/rfid"
import { getWarehouses } from "@/app/actions/warehouse"
import { RfidTaggedUnitsConsole } from "./_components/rfid-tagged-units-console"

export default async function RfidTaggedUnitsPage() {
    const [data, warehouses] = await Promise.all([
        getRfidTaggedUnitsOverview(),
        getWarehouses(),
    ])

    return (
        <RfidTaggedUnitsConsole
            data={data}
            warehouses={warehouses}
        />
    )
}
