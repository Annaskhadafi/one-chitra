import { db } from "../db"
import { getSalesOrders } from "../app/actions/sales-order"

async function main() {
    console.log("Testing getSalesOrders()...")
    try {
        const orders = await getSalesOrders()
        console.log(`Success! Found ${orders.length} orders.`)
        if (orders.length > 0) {
            console.log("Sample order:", JSON.stringify(orders[0], null, 2))
        }
    } catch (error) {
        console.error("getSalesOrders failed:", error)
    }
}

main().catch(error => {
    console.error("Script failed:", error)
}).finally(() => {
    process.exit(0)
})
