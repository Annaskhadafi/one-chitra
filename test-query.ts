import { db } from "./db"; // Adjust path if needed
import { salesOrders, customers, user } from "./db/schema"; // Adjust path if needed
import { desc } from "drizzle-orm";

async function main() {
    console.log("Running test query...");
    try {
        const orders = await db.query.salesOrders.findMany({
            with: {
                customer: true,
                createdByUser: true,
            },
            orderBy: [desc(salesOrders.createdAt)],
        });
        console.log("Query success. Found", orders.length, "orders.");
    } catch (error) {
        console.error("Query failed:", error);
    }
    process.exit(0);
}

main();
