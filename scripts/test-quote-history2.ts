import { db } from "../db";
import { salesRevenueSap } from "../db/schema/sap";
import { eq } from "drizzle-orm";

async function main() {
    try {
        console.log("Testing error for quotation...");
        const data = await db.select()
            .from(salesRevenueSap)
            .where(eq(salesRevenueSap.materialNo, "1101240204"));

        console.log("Got data length:", data.length);
    } catch (err) {
        console.error("REAL ERROR:", err);
    }
    process.exit(0);
}
main();
