ALTER TABLE "deliveries" ADD COLUMN "remark" text;--> statement-breakpoint
ALTER TABLE "deliveries" ADD COLUMN "scan_do_document" varchar(255);--> statement-breakpoint
ALTER TABLE "sales_orders" ADD COLUMN "po_document" varchar(255);