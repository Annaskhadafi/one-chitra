import { db } from "./index"
import { sql } from "drizzle-orm"

async function applyCalendarMigration() {
    console.log("Applying calendar migration...")

    // 1. Create enum type (if not exists)
    await db.execute(sql`
        DO $$ BEGIN
            CREATE TYPE calendar_event_type AS ENUM ('marketing', 'reminder');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)
    console.log("✓ Enum calendar_event_type ready")

    // 2. Create calendar_events table (if not exists)
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "calendar_events" (
            "id" serial PRIMARY KEY NOT NULL,
            "title" varchar(255) NOT NULL,
            "description" text,
            "start_date" timestamp with time zone NOT NULL,
            "end_date" timestamp with time zone,
            "all_day" boolean DEFAULT false NOT NULL,
            "type" "calendar_event_type" DEFAULT 'marketing' NOT NULL,
            "color" varchar(20) DEFAULT '#3b82f6',
            "related_customer_id" integer,
            "email_reminder_at" timestamp with time zone,
            "email_reminder_sent" boolean DEFAULT false NOT NULL,
            "email_reminder_to" varchar(255),
            "created_by" varchar,
            "created_at" timestamp DEFAULT now() NOT NULL,
            "updated_at" timestamp DEFAULT now() NOT NULL
        );
    `)
    console.log("✓ Table calendar_events ready")

    // 3. Add FK for related_customer_id (if not exists)
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "calendar_events"
                ADD CONSTRAINT "calendar_events_related_customer_id_customers_id_fk"
                FOREIGN KEY ("related_customer_id")
                REFERENCES "customers"("id")
                ON DELETE SET NULL;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)
    console.log("✓ FK related_customer_id ready")

    // 4. Add FK for created_by (if not exists)
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "calendar_events"
                ADD CONSTRAINT "calendar_events_created_by_user_id_fk"
                FOREIGN KEY ("created_by")
                REFERENCES "user"("id")
                ON DELETE SET NULL;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)
    console.log("✓ FK created_by ready")

    // 5. Add birthday column to customers (if not exists)
    await db.execute(sql`
        ALTER TABLE "customers"
            ADD COLUMN IF NOT EXISTS "birthday" date;
    `)
    console.log("✓ Column customers.birthday ready")

    console.log("\n✅ Calendar migration complete!")
    process.exit(0)
}

applyCalendarMigration().catch((err) => {
    console.error("Migration failed:", err)
    process.exit(1)
})
