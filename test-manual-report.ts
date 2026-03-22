
import { sendManualRevenueReport } from "./app/actions/dashboard-revenue"

async function test() {
    const period = "03.2026"
    console.log(`Running test for period: ${period}`)
    try {
        const result = await sendManualRevenueReport(period)
        console.log("Test Result:", result)
    } catch (error) {
        console.error("Test Failed with exception:", error)
    }
}

test()
