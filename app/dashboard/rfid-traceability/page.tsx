import { getRfidTraceabilityLookup } from "@/app/actions/rfid"
import { RfidTraceabilityConsole } from "./_components/rfid-traceability-console"

export default async function RfidTraceabilityPage() {
    const lookup = await getRfidTraceabilityLookup()

    return <RfidTraceabilityConsole lookup={lookup} />
}
