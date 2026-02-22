import { db } from "../db";
import { sql } from "drizzle-orm";

async function createTable() {
    try {
        console.log("Creating stock_movements table manually...");
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS "stock_movements" (
                "id" serial PRIMARY KEY,
                "product_id" integer NOT NULL,
                "warehouse_id" integer NOT NULL,
                "quantity" integer NOT NULL,
                "type" varchar(50) NOT NULL,
                "reference_number" varchar(100),
                "recorded_by" text,
                "created_at" timestamp DEFAULT now() NOT NULL
            )
        `);
        console.log("Table created successfully (or already exists).");
    } catch (error: any) {
        console.error("ERROR IN CREATE TABLE:", error.message);
        if (error.stack) console.error("STACK:", error.stack);
        process.exit(1);
    }
}

createTable().then(() => process.exit());
