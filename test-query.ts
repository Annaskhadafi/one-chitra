import 'dotenv/config';
import { db } from './db/index.js';
import { sql } from 'drizzle-orm';

async function main() {
    try {
        await db.execute(sql`ALTER TABLE "sales_orders" ADD COLUMN "trip_destination" varchar(255);`);
        console.log("Column trip_destination added successfully!");
    } catch(e: any) {
        console.error("Error adding column:", e.cause || e);
    }
    
    try {
        await db.query.salesOrders.findMany({
            with: { customer: true, createdByUser: true, salesPerson: true },
            limit: 1
        });
        console.log("Query success");
    } catch(e: any) {
        console.error("Query failed:");
        console.error(e.cause || e);
    }
    process.exit(0);
}
main();
