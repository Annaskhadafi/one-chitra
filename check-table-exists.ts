import { db } from "./db";
import { sql } from "drizzle-orm";

async function main() {
    try {
        console.log("Checking if 'billing_records' table exists...");
        const res = await db.execute(sql`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'billing_records'
        `);
        console.log("Result:", res.rows);
    } catch (error) {
        console.error("Error checking DB:", error);
    }
    process.exit(0);
}

main();
