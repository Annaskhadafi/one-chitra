import 'dotenv/config';
import { db } from './db/index.js';
import { sql } from 'drizzle-orm';

async function main() {
    try {
        await db.execute(sql`ALTER TABLE "sales_orders" ADD COLUMN "sales_person_id" text REFERENCES "user"("id");`);
        console.log("Column sales_person_id added successfully!");
    } catch(e) {
        console.error("Error adding column:", e);
    }
    process.exit(0);
}
main();
