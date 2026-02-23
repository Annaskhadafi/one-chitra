-- Add new columns as nullable first
ALTER TABLE "stock_opname_sessions" ADD COLUMN "opname_date" timestamp;--> statement-breakpoint
ALTER TABLE "stock_opname_sessions" ADD COLUMN "opname_time" varchar(10);--> statement-breakpoint
ALTER TABLE "stock_opname_sessions" ADD COLUMN "location" varchar(200);--> statement-breakpoint

-- Set default values for any existing records
UPDATE "stock_opname_sessions" 
SET "opname_date" = COALESCE("created_at", NOW()),
    "opname_time" = '00:00',
    "location" = 'Not specified'
WHERE "opname_date" IS NULL;--> statement-breakpoint

-- Make columns NOT NULL after setting defaults
ALTER TABLE "stock_opname_sessions" ALTER COLUMN "opname_date" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_opname_sessions" ALTER COLUMN "opname_time" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_opname_sessions" ALTER COLUMN "location" SET NOT NULL;