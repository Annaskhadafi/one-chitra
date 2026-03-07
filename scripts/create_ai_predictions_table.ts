import { db } from "../db";
import { sql } from "drizzle-orm";

async function main() {
    console.log("Creating ai_inventory_predictions table...");
    try {
        await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "ai_inventory_predictions" (
        "id" serial PRIMARY KEY NOT NULL,
        "product_code" varchar(100) NOT NULL,
        "product_name" text,
        "prediction_type" varchar(50) NOT NULL,
        "recommended_stock" integer NOT NULL,
        "rationale" text NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
      );
    `);
        console.log("Table created successfully!");
        process.exit(0);
    } catch (err) {
        console.error("Error creating table:", err);
        process.exit(1);
    }
}

main();
