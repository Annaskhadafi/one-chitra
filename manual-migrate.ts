import { db } from "./db";
import { sql } from "drizzle-orm";

async function main() {
    console.log("Running manual migration...");

    try {
        // Add impersonated_by to session
        await db.execute(sql`
      ALTER TABLE "session" 
      ADD COLUMN IF NOT EXISTS "impersonated_by" text;
    `);
        console.log("Added impersonated_by to session");

        // Add banned fields to user
        await db.execute(sql`
      ALTER TABLE "user" 
      ADD COLUMN IF NOT EXISTS "banned" boolean DEFAULT false;
    `);
        await db.execute(sql`
      ALTER TABLE "user" 
      ADD COLUMN IF NOT EXISTS "ban_reason" text;
    `);
        await db.execute(sql`
      ALTER TABLE "user" 
      ADD COLUMN IF NOT EXISTS "ban_expires" timestamp;
    `);
        console.log("Added ban fields to user");

        console.log("Migration successful!");
    } catch (error) {
        console.error("Migration failed:", error);
    } finally {
        process.exit(0);
    }
}

main();
