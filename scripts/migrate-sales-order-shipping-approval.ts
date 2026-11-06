import { db } from "../db";
import { sql } from "drizzle-orm";

async function main() {
    console.log("🚀 Menerapkan migrasi kolom shipping approval pada sales_orders...");

    await db.execute(sql`
        ALTER TABLE "sales_orders"
        ADD COLUMN IF NOT EXISTS "shipping_approval_status" varchar(30) DEFAULT '-' NOT NULL,
        ADD COLUMN IF NOT EXISTS "shipping_approval_batch_id" varchar(100),
        ADD COLUMN IF NOT EXISTS "shipping_approval_user_comment" text,
        ADD COLUMN IF NOT EXISTS "shipping_approval_notes" text,
        ADD COLUMN IF NOT EXISTS "shipping_approval_requested_at" timestamp,
        ADD COLUMN IF NOT EXISTS "shipping_approval_requested_by" text REFERENCES "user"("id") ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "shipping_approved_at" timestamp,
        ADD COLUMN IF NOT EXISTS "shipping_approved_by" text REFERENCES "user"("id") ON DELETE SET NULL;

        CREATE INDEX IF NOT EXISTS "sales_orders_shipping_approval_status_idx" 
        ON "sales_orders" ("shipping_approval_status");

        CREATE TABLE IF NOT EXISTS "shipping_approval_requests" (
            "id" varchar(100) PRIMARY KEY,
            "batch_number" varchar(100) NOT NULL,
            "requester_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
            "approver_id" text REFERENCES "user"("id") ON DELETE SET NULL,
            "status" varchar(30) DEFAULT 'Waiting Approve' NOT NULL,
            "user_comment" text,
            "approver_notes" text,
            "total_orders" integer DEFAULT 0 NOT NULL,
            "created_at" timestamp DEFAULT now() NOT NULL,
            "updated_at" timestamp DEFAULT now() NOT NULL,
            "approved_at" timestamp
        );

        CREATE INDEX IF NOT EXISTS "shipping_approval_requests_status_idx" 
        ON "shipping_approval_requests" ("status");
        
        CREATE INDEX IF NOT EXISTS "shipping_approval_requests_requester_idx" 
        ON "shipping_approval_requests" ("requester_id");
    `);

    console.log("✅ Migrasi shipping approval berhasil diterapkan!");
    process.exit(0);
}

main().catch((err) => {
    console.error("❌ Gagal migrasi:", err);
    process.exit(1);
});
