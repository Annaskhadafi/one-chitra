import { db } from "./index"
import { sql } from "drizzle-orm"

async function applyAIForecastMigration() {
    console.log("Applying AI Forecast enhancement migration...")

    // 1. Add new columns to ai_inventory_predictions table
    console.log("Adding columns to ai_inventory_predictions...")
    
    await db.execute(sql`
        ALTER TABLE "ai_inventory_predictions"
            ADD COLUMN IF NOT EXISTS "actual_sales" integer;
    `)
    console.log("✓ Column actual_sales added")

    await db.execute(sql`
        ALTER TABLE "ai_inventory_predictions"
            ADD COLUMN IF NOT EXISTS "accuracy_percentage" real;
    `)
    console.log("✓ Column accuracy_percentage added")

    await db.execute(sql`
        ALTER TABLE "ai_inventory_predictions"
            ADD COLUMN IF NOT EXISTS "batch_id" varchar(100);
    `)
    console.log("✓ Column batch_id added")

    await db.execute(sql`
        ALTER TABLE "ai_inventory_predictions"
            ADD COLUMN IF NOT EXISTS "current_stock" integer;
    `)
    console.log("✓ Column current_stock added")

    // 2. Create indexes for performance optimization
    console.log("Creating indexes on ai_inventory_predictions...")
    
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "ai_predictions_product_code_idx" 
        ON "ai_inventory_predictions" ("product_code");
    `)
    console.log("✓ Index on product_code created")

    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "ai_predictions_type_idx" 
        ON "ai_inventory_predictions" ("prediction_type");
    `)
    console.log("✓ Index on prediction_type created")

    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "ai_predictions_created_at_idx" 
        ON "ai_inventory_predictions" ("created_at");
    `)
    console.log("✓ Index on created_at created")

    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "ai_predictions_batch_id_idx" 
        ON "ai_inventory_predictions" ("batch_id");
    `)
    console.log("✓ Index on batch_id created")

    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "ai_predictions_accuracy_idx" 
        ON "ai_inventory_predictions" ("accuracy_percentage");
    `)
    console.log("✓ Index on accuracy_percentage created")

    // 3. Create restock_notifications table
    console.log("Creating restock_notifications table...")
    
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "restock_notifications" (
            "id" serial PRIMARY KEY NOT NULL,
            "product_code" varchar(100) NOT NULL,
            "product_name" text,
            "current_stock" integer NOT NULL,
            "recommended_stock" integer NOT NULL,
            "urgency_level" varchar(20) NOT NULL,
            "prediction_id" integer,
            "is_acknowledged" integer DEFAULT 0 NOT NULL,
            "acknowledged_at" timestamp,
            "created_at" timestamp DEFAULT now() NOT NULL
        );
    `)
    console.log("✓ Table restock_notifications created")

    // 4. Add foreign key for prediction_id
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "restock_notifications"
                ADD CONSTRAINT "restock_notifications_prediction_id_fk"
                FOREIGN KEY ("prediction_id")
                REFERENCES "ai_inventory_predictions"("id")
                ON DELETE SET NULL;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)
    console.log("✓ FK prediction_id added")

    // 5. Create indexes on restock_notifications
    console.log("Creating indexes on restock_notifications...")
    
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "notifications_product_code_idx" 
        ON "restock_notifications" ("product_code");
    `)
    console.log("✓ Index on product_code created")

    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "notifications_urgency_idx" 
        ON "restock_notifications" ("urgency_level");
    `)
    console.log("✓ Index on urgency_level created")

    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "notifications_acknowledged_idx" 
        ON "restock_notifications" ("is_acknowledged");
    `)
    console.log("✓ Index on is_acknowledged created")

    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "notifications_created_at_idx" 
        ON "restock_notifications" ("created_at");
    `)
    console.log("✓ Index on created_at created")

    // 6. Create ai_settings table
    console.log("Creating ai_settings table...")
    
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "ai_settings" (
            "id" serial PRIMARY KEY NOT NULL,
            "setting_key" varchar(100) NOT NULL UNIQUE,
            "setting_value" text NOT NULL,
            "description" text,
            "updated_at" timestamp DEFAULT now() NOT NULL,
            "updated_by" varchar(100)
        );
    `)
    console.log("✓ Table ai_settings created")

    // 7. Insert default AI settings
    console.log("Inserting default AI settings...")
    
    await db.execute(sql`
        INSERT INTO "ai_settings" ("setting_key", "setting_value", "description")
        VALUES 
            ('ai_model', 'qwen/qwen3-32b', 'Groq AI model to use for predictions'),
            ('ai_temperature', '0.7', 'Temperature parameter for AI model (0.0-1.0)'),
            ('ai_max_tokens', '4096', 'Maximum tokens for AI response (1000-8192)'),
            ('ai_cache_duration', '24', 'Cache duration in hours (12, 24, or 48)'),
            ('ai_thinking_mode', 'false', 'Enable thinking mode for AI responses')
        ON CONFLICT ("setting_key") DO NOTHING;
    `)
    console.log("✓ Default settings inserted")

    console.log("\n✅ AI Forecast enhancement migration complete!")
    process.exit(0)
}

applyAIForecastMigration().catch((err) => {
    console.error("Migration failed:", err)
    process.exit(1)
})
