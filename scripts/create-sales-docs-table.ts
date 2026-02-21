import { db } from "../db";
import { sql } from "drizzle-orm";

async function main() {
    console.log("Creating sales_documents table...");
    try {
        await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "sales_documents" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "title" text NOT NULL,
        "description" text,
        "file_url" text NOT NULL,
        "file_name" text NOT NULL,
        "file_type" text NOT NULL,
        "uploaded_by_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );
    `);
        console.log("Table created successfully!");
    } catch (error) {
        console.error("Failed to create table:", error);
    }
    process.exit(0);
}

main();
