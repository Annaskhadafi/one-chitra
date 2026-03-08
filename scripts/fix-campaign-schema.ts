import { db } from "../db"
import { sql } from "drizzle-orm"

async function runRaw() {
    try {
        console.log("Menambahkan kolom yang kurang di marketing_campaigns...")
        await db.execute(sql`
            ALTER TABLE "marketing_campaigns" ADD COLUMN IF NOT EXISTS "description" text;
            ALTER TABLE "marketing_campaigns" ADD COLUMN IF NOT EXISTS "channel_type" varchar(50) DEFAULT 'email' NOT NULL;
            ALTER TABLE "marketing_campaigns" ADD COLUMN IF NOT EXISTS "cc_emails" text;
            ALTER TABLE "marketing_campaigns" ADD COLUMN IF NOT EXISTS "sent_at" timestamp;
            
            ALTER TABLE "marketing_campaigns" ADD COLUMN IF NOT EXISTS "segment_criteria" text;
            ALTER TABLE "marketing_campaigns" ADD COLUMN IF NOT EXISTS "scheduled_at" timestamp;
            ALTER TABLE "marketing_campaigns" ADD COLUMN IF NOT EXISTS "total_recipients" integer DEFAULT 0;
            ALTER TABLE "marketing_campaigns" ADD COLUMN IF NOT EXISTS "success_count" integer DEFAULT 0;
            ALTER TABLE "marketing_campaigns" ADD COLUMN IF NOT EXISTS "failure_count" integer DEFAULT 0;
        `)

        console.log("Menambahkan tabel campaign_recipients jika belum ada...")
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS "campaign_recipients" (
                "id" serial PRIMARY KEY NOT NULL,
                "campaign_id" integer NOT NULL,
                "customer_name" varchar(255) NOT NULL,
                "email" varchar(255) NOT NULL,
                "status" varchar(50) DEFAULT 'sent' NOT NULL,
                "error_message" text,
                "sent_at" timestamp DEFAULT now() NOT NULL
            );
        `)

        console.log("Menambahkan foreign key jika belum ada...")
        try {
            await db.execute(sql`
                ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE cascade ON UPDATE no action;
            `)
        } catch (e: any) {
            console.log("Warning FK:", e.message)
        }

        console.log("Setup Selesai!")
    } catch (e) {
        console.error("Error:", e)
    } finally {
        process.exit()
    }
}

runRaw()
