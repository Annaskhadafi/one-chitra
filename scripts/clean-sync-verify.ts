
import { db } from "../db";
import { competitorPrices } from "../db/schema";
import { syncCompetitorPricesFromApi, getCompetitorPrices } from "../app/actions/competitor-new";

async function cleanAndSync() {
    console.log("Cleaning competitor_prices table...");
    try {
        await db.delete(competitorPrices);
        console.log("✅ Table cleared.");

        console.log("Running fresh sync...");
        const syncResult = await syncCompetitorPricesFromApi();
        console.log("Sync Result:", syncResult);

        const data = await getCompetitorPrices();
        const withNames = data.filter(item => item.consultantName);
        console.log(`✅ Success! Found ${data.length} total records, ${withNames.length} with consultant names.`);

        if (withNames.length > 0) {
            console.log("Sample record with name:", {
                id: withNames[0].id,
                consultantName: withNames[0].consultantName,
                customer: withNames[0].customerName
            });
        }
    } catch (error) {
        console.error("❌ Clean and sync failed:", error);
    }
}

cleanAndSync().then(() => process.exit());
