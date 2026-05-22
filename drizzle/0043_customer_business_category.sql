ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "business_category" varchar(255);
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "business_category_source" varchar(100);
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "business_category_enriched_at" timestamp;
