
import { db } from "../db"
import { syncCompetitorPricesFromApi } from "../app/actions/competitor-new"

async function testSync() {
    console.log("Starting sync test...")
    try {
        // We need a session, but in a script we might need to mock it or run it in a way that bypasses auth if possible
        // For local verification, I'll temporarily wrap the logic or check if I can run it.
        // Actually, since I'm in the environment, I'll try to run the action directly.
        // NOTE: This might fail if auth is strictly enforced and no headers are provided.

        const result = await syncCompetitorPricesFromApi()
        console.log("Sync Result:", result)

        if (result.success) {
            console.log(`Added: ${result.addedCount}, Skipped: ${result.skippedCount}`)

            // Run again to verify deduplication
            console.log("Running sync again to verify deduplication...")
            const secondResult = await syncCompetitorPricesFromApi()
            console.log("Second Sync Result:", secondResult)

            if (secondResult.success && secondResult.addedCount === 0) {
                console.log("✅ Deduplication test passed!")
            } else {
                console.log("❌ Deduplication test failed or added more records.")
            }
        } else {
            console.log("❌ Sync failed:", result.error)
        }
    } catch (error) {
        console.error("Test error:", error)
    }
}

testSync().then(() => process.exit())
