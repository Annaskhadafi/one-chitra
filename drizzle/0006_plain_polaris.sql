ALTER TABLE "quotation_items" ADD COLUMN "long_description" text;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "closing_status" varchar(50);--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "tags" text;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "currency" varchar(10) DEFAULT 'IDR';--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "reference_number" varchar(100);--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "admin_note" text;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "client_note" text;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "discount_type" varchar(20) DEFAULT 'fixed';