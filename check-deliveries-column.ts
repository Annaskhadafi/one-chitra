import { db } from "./db";
import { sql } from "drizzle-orm";

async function main() {
    try {
        console.log("Checking 'deliveries' table for 'fleet_trip_id'...");
        const res = await db.execute(sql`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'deliveries' AND column_name = 'fleet_trip_id'
        `);
        console.log("Result:", res.rows);
    } catch (error) {
        console.error("Error checking DB:", error);
    }
    process.exit(0);
}

main();
