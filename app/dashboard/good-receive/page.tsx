import { getWarehouses } from "@/app/actions/warehouse"
import GoodReceiveClient from "./client-page"

export default async function GoodReceivePage() {
    const warehouses = await getWarehouses()
    return <GoodReceiveClient warehouses={warehouses} />
}
