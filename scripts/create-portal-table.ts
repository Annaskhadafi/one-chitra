import { db } from "../db";
import { sql } from "drizzle-orm";

async function main() {
    console.log("Creating portal_items table...");
    try {
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS "portal_items" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "name" varchar(255) NOT NULL,
                "description" text,
                "icon" varchar(100) NOT NULL DEFAULT 'Globe',
                "color" varchar(50) NOT NULL DEFAULT '#3b82f6',
                "url" text NOT NULL,
                "new_tab" boolean NOT NULL DEFAULT true,
                "category" varchar(100) NOT NULL DEFAULT 'General',
                "order" integer NOT NULL DEFAULT 0,
                "created_at" timestamp NOT NULL DEFAULT now(),
                "updated_at" timestamp NOT NULL DEFAULT now()
            );
        `);
        console.log("Table created successfully!");
    } catch (error) {
        console.error("Failed to create table:", error);
    }
    process.exit(0);
}

main();
