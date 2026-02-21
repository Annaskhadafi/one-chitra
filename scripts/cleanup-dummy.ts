import { db } from "../db";
import { competitorPrices } from "../db/schema";
import { eq } from "drizzle-orm";

async function main() {
    console.log("Cleaning up dummy record...");
    try {
        await db.delete(competitorPrices).where(eq(competitorPrices.customerName, "Test Customer"));
        console.log("Cleanup success!");
    } catch (err) {
        console.error("Cleanup failed:", err);
    }
    process.exit(0);
}

main();
