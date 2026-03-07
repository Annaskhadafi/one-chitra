import { getCampaigns } from "../app/actions/marketing-campaigns";
import { getDeadStockReport } from "../app/actions/dead-stock";

async function main() {
    console.log("Testing getCampaigns...");
    try {
        const campaigns = await getCampaigns();
        console.log("Campaigns:", campaigns);
    } catch (e) {
        console.error("getCampaigns failed:", e);
    }

    console.log("Testing getDeadStockReport...");
    try {
        const report = await getDeadStockReport(90);
        console.log("Dead Stock Report:", report);
    } catch (e) {
        console.error("getDeadStockReport failed:", e);
    }
    process.exit(0);
}

main();
