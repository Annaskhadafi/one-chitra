ALTER TABLE "sales_revenue_sap" ALTER COLUMN "sales_rev_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "zmc9_stock_sap" ALTER COLUMN "stock_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "billing_records" ADD COLUMN "evoucher_id" integer;--> statement-breakpoint
ALTER TABLE "billing_records" ADD COLUMN "invoice_type" text;--> statement-breakpoint
ALTER TABLE "zmc9_stock_sap" ADD COLUMN "updated_at" timestamp;