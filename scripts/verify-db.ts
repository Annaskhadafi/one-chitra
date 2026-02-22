import { db } from "../db";
import { stockMovements } from "../db/schema";
import { desc } from "drizzle-orm";

async function verify() {
    try {
        console.log("Checking stockMovements...");
        // Use a direct query first to check if table exists
        const result = await db.select().from(stockMovements).limit(1);
        console.log("Direct Result:", result);

        console.log("Checking with relations...");
        const relResult = await db.query.stockMovements.findMany({
            with: {
                product: true,
                warehouse: true,
                recordedByUser: true,
            },
            limit: 1
        });
        console.log("Rel Result:", relResult);
    } catch (error: any) {
        console.error("FULL ERROR NAME:", error.name);
        console.error("FULL ERROR MESSAGE:", error.message);
        if (error.code) console.error("ERROR CODE:", error.code);
        if (error.detail) console.error("ERROR DETAIL:", error.detail);
        if (error.hint) console.error("ERROR HINT:", error.hint);
    }
}

verify().then(() => process.exit());
