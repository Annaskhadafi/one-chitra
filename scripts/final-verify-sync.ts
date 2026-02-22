
import { syncCompetitorPricesFromApi, getCompetitorPrices } from "../app/actions/competitor-new";

async function finalVerify() {
    console.log("Running final sync verification...");
    try {
        // Run sync
        const syncResult = await syncCompetitorPricesFromApi();
        console.log("Sync Result:", syncResult);

        // Fetch data to see if consultantNames are there
        const data = await getCompetitorPrices();
        const withNames = data.filter(item => item.consultantName);
        console.log(`✅ Success! Found ${data.length} total records, ${withNames.length} with consultant names.`);

        if (data.length > 0) {
            console.log("Sample record:", {
                id: data[0].id,
                consultantName: data[0].consultantName,
                customer: data[0].customerName
            });
        }
    } catch (error) {
        console.error("❌ Final verification failed:", error);
    }
}

finalVerify().then(() => process.exit());
