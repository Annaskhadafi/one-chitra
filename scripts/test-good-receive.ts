import { fetchGoodReceiveFromSAP } from "@/app/actions/good-receive"

async function main() {
    try {
        const startDate = "2025-01-01"
        const endDate = "2025-12-31"
        console.log(`Fetching from ${startDate} to ${endDate}...`)

        const result = await fetchGoodReceiveFromSAP(startDate, endDate)
        console.log("Success:", result.success)
        if (result.success && result.data) {
            console.log(`Received ${result.data.length} items. First 2 items:`)
            console.log(JSON.stringify(result.data.slice(0, 2), null, 2))
        } else {
            console.log("Error:", result.error)
        }
    } catch (e) {
        console.error("Error running test:", e)
    }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) });
