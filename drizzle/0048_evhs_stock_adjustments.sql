CREATE TABLE IF NOT EXISTS "evhs_stock_adjustments" (
    "id" serial PRIMARY KEY NOT NULL,
    "warehouse_id" integer NOT NULL REFERENCES "warehouses"("id"),
    "product_id" integer NOT NULL REFERENCES "products"("id"),
    "quantity" integer NOT NULL,
    "notes" text,
    "created_by" varchar REFERENCES "user"("id"),
    "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "evhs_stock_adjustments_warehouse_product_idx"
    ON "evhs_stock_adjustments" ("warehouse_id", "product_id");
--> statement-breakpoint
ALTER TABLE "evhs_stock_adjustments"
    ADD COLUMN IF NOT EXISTS "serial_numbers" text[];
