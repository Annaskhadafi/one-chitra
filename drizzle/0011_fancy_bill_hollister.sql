ALTER TABLE "deliveries" ADD COLUMN "warehouse_to_id" integer;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD COLUMN "delivery_id" integer;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD COLUMN "received_status" varchar(20) DEFAULT 'Scheduled' NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD COLUMN "posting_document_no" varchar(100);--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD COLUMN "batch_no" varchar(100);--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_warehouse_to_id_warehouses_id_fk" FOREIGN KEY ("warehouse_to_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_delivery_id_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id") ON DELETE no action ON UPDATE no action;