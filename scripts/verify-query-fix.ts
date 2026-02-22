
import { getCompetitorPrices } from "../app/actions/competitor-new";

async function verifyQuery() {
    console.log("Verifying getCompetitorPrices query...");
    try {
        const result = await getCompetitorPrices();
        console.log(`✅ Success! Fetched ${result.length} records.`);
    } catch (error) {
        console.error("❌ Query still failing:", error);
    }
}

verifyQuery().then(() => process.exit());
