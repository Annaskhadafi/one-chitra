import { getProcurementNextAnalytics } from "../app/actions/procurement-next"

async function test() {
    console.log("Testing Procurement Next Analytics...")
    try {
        const result = await getProcurementNextAnalytics({
            horizonMonths: 6,
            chartGranularity: "weekly",
            forecastingAlgorithm: "auto_arima",
        })
        console.log("Success:", result.success)
        if (!result.success) {
            console.error("Error:", result.error)
        } else {
            console.log("Summary Items:", result.data?.summary.totalItems)
            const badItems = result.data?.items.filter(item => 
                !Number.isFinite(item.currentStock) || 
                !Number.isFinite(item.minStock) ||
                !Number.isFinite(item.monthlyAvg) ||
                (item.daysCover60d !== null && !Number.isFinite(item.daysCover60d))
            )
            console.log("Bad items count:", badItems?.length)
            if (badItems && badItems.length > 0) {
                console.log("First bad item:", JSON.stringify(badItems[0], null, 2))
            }
        }
    } catch (e) {
        console.error("CRASH detected in server action:", e)
    }
}

test()
