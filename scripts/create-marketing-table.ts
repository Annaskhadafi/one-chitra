import { db } from "../db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Creating marketing_campaigns table...");
  try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "marketing_campaigns" (
            "id" serial PRIMARY KEY NOT NULL,
            "name" varchar(255) NOT NULL,
            "subject" varchar(255) NOT NULL,
            "content" text NOT NULL,
            "segment_criteria" text,
            "scheduled_at" timestamp,
            "status" varchar(50) DEFAULT 'draft' NOT NULL,
            "total_recipients" integer DEFAULT 0,
            "success_count" integer DEFAULT 0,
            "failure_count" integer DEFAULT 0,
            "created_by" text,
            "created_at" timestamp DEFAULT now() NOT NULL,
            "updated_at" timestamp DEFAULT now() NOT NULL
        );
      `);
      console.log("Table created successfully.");
  } catch (e) {
      console.error("Error creating table:", e);
  }
  process.exit(0);
}

main();
