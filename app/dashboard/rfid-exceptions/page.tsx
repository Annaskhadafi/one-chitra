import { getRfidExceptionCenterData } from "@/app/actions/rfid"
import { RfidExceptionsConsole } from "./_components/rfid-exceptions-console"

export default async function RfidExceptionsPage() {
    const data = await getRfidExceptionCenterData()

    return <RfidExceptionsConsole data={data} />
}
