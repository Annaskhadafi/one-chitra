import { fetchGoodReceiveFromSAP } from "../app/actions/good-receive"

async function main() {
    const startDate = "2026-03-01"
    const endDate = "2026-03-31"

    console.log(`Testing fetch for March 2026: ${startDate} to ${endDate}`)
    const result = await fetchGoodReceiveFromSAP(startDate, endDate)

    if (result.success && result.data) {
        console.log(`Results: ${result.data.length}`)
        const found = result.data.find(d => d.ponumb === "8220023977")
        if (found) {
            console.log("BUG: Processed item STILL FOUND in fetch results!")
            console.log(JSON.stringify(found, null, 2))
        } else {
            console.log("Correct: Processed item NOT found in fetch results.")
        }
    } else {
        console.log("Fetch failed:", result.error)
    }
    process.exit(0)
}

main().catch(console.error)
