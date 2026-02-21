import { db } from "../db";
import { competitorPrices, competitorActivities, lostSales } from "../db/schema";

async function main() {
    console.log("Testing competitor_prices query...");
    try {
        const prices = await db.query.competitorPrices.findMany({
            with: {
                businessConsultant: true,
                createdBy: true,
            }
        });
        console.log("prices success:", prices.length);
    } catch (err) {
        console.error("prices error:", err);
    }

    console.log("Testing competitor_activities query...");
    try {
        const activities = await db.query.competitorActivities.findMany({
            with: {
                businessConsultant: true,
                createdBy: true,
            }
        });
        console.log("activities success:", activities.length);
    } catch (err) {
        console.error("activities error:", err);
    }

    console.log("Testing lost_sales query...");
    try {
        const lost = await db.query.lostSales.findMany({
            with: {
                businessConsultant: true,
                createdBy: true,
            }
        });
        console.log("lost success:", lost.length);
    } catch (err) {
        console.error("lost error:", err);
    }

    process.exit(0);
}

main();
