ALTER TABLE "deliveries" ADD COLUMN "return_do_date" timestamp;--> statement-breakpoint
ALTER TABLE "deliveries" ADD COLUMN "invoice_number" varchar(100);--> statement-breakpoint
ALTER TABLE "deliveries" ADD COLUMN "invoice_date" timestamp;--> statement-breakpoint
ALTER TABLE "deliveries" ADD COLUMN "do_status" varchar(50) DEFAULT 'Pending';