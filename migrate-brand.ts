import { db } from "./db";
import { sql } from "drizzle-orm";

async function main() {
    console.log("Running manual migration for brand column...");

    try {
        await db.execute(sql`
            ALTER TABLE "products" 
            ADD COLUMN IF NOT EXISTS "brand" varchar(100);
        `);
        console.log("Added brand column to products table");

        console.log("Migration successful!");
    } catch (error) {
        console.error("Migration failed:", error);
    } finally {
        process.exit(0);
    }
}

main();
