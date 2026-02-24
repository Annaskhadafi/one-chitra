ALTER TABLE "stock_movements" ADD COLUMN "customer_id" integer;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "from_warehouse_id" integer;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "to_warehouse_id" integer;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "notes" text;