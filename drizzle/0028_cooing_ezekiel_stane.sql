CREATE TABLE "ai_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"setting_key" varchar(100) NOT NULL,
	"setting_value" text NOT NULL,
	"description" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" varchar(100),
	CONSTRAINT "ai_settings_setting_key_unique" UNIQUE("setting_key")
);
--> statement-breakpoint
CREATE TABLE "evhs_gi_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"gi_record_id" integer NOT NULL,
	"material_number" varchar(100) NOT NULL,
	"qty" numeric(12, 2) NOT NULL,
	"price" numeric(15, 2),
	"status" varchar(50)
);
--> statement-breakpoint
CREATE TABLE "evhs_gi_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" varchar(20) DEFAULT 'upload' NOT NULL,
	"filename" text,
	"period_date" date,
	"warehouse_id" integer,
	"is_matched" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evhs_mrko" (
	"id" serial PRIMARY KEY NOT NULL,
	"mrko_number" varchar(100),
	"release_date" timestamp,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evhs_receipt_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"receipt_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"confirmed_qty" integer NOT NULL,
	"serial_numbers" text[]
);
--> statement-breakpoint
CREATE TABLE "evhs_receipts" (
	"id" serial PRIMARY KEY NOT NULL,
	"transfer_id" integer NOT NULL,
	"received_date" timestamp DEFAULT now() NOT NULL,
	"do_chitra_no" varchar(100),
	"confirmed_by" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evhs_voucher_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"voucher_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"material_number_ck" varchar(100),
	"qty" integer NOT NULL,
	"stock_balance" integer,
	"serial_number" varchar(100)
);
--> statement-breakpoint
CREATE TABLE "evhs_vouchers" (
	"id" serial PRIMARY KEY NOT NULL,
	"vhs_no" varchar(100) NOT NULL,
	"wo_no" varchar(100),
	"date" date NOT NULL,
	"warehouse_id" integer NOT NULL,
	"remark" text,
	"issued_by" varchar,
	"approved_by_name" varchar(255),
	"received_by_name" varchar(255),
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "evhs_vouchers_vhs_no_unique" UNIQUE("vhs_no")
);
--> statement-breakpoint
CREATE TABLE "restock_notifications" (
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
--> statement-breakpoint
ALTER TABLE "ai_inventory_predictions" ADD COLUMN "actual_sales" integer;--> statement-breakpoint
ALTER TABLE "ai_inventory_predictions" ADD COLUMN "accuracy_percentage" real;--> statement-breakpoint
ALTER TABLE "ai_inventory_predictions" ADD COLUMN "batch_id" varchar(100);--> statement-breakpoint
ALTER TABLE "ai_inventory_predictions" ADD COLUMN "current_stock" integer;--> statement-breakpoint
ALTER TABLE "deliveries" ADD COLUMN "cost_gasoline_dexlite" numeric(15, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "deliveries" ADD COLUMN "cost_gasoline_bio" numeric(15, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "delivery_cost_request_items" ADD COLUMN "fuel_cost_dexlite" numeric(20, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "delivery_cost_request_items" ADD COLUMN "fuel_cost_bio" numeric(20, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "fleet_trips" ADD COLUMN "cost_gasoline_dexlite" numeric(15, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "fleet_trips" ADD COLUMN "cost_gasoline_bio" numeric(15, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "material_number_ck" varchar(100);--> statement-breakpoint
ALTER TABLE "warehouses" ADD COLUMN "customer_id" integer;--> statement-breakpoint
ALTER TABLE "evhs_gi_items" ADD CONSTRAINT "evhs_gi_items_gi_record_id_evhs_gi_records_id_fk" FOREIGN KEY ("gi_record_id") REFERENCES "public"."evhs_gi_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evhs_gi_records" ADD CONSTRAINT "evhs_gi_records_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evhs_receipt_items" ADD CONSTRAINT "evhs_receipt_items_receipt_id_evhs_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."evhs_receipts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evhs_receipt_items" ADD CONSTRAINT "evhs_receipt_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evhs_receipts" ADD CONSTRAINT "evhs_receipts_transfer_id_stock_transfers_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."stock_transfers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evhs_receipts" ADD CONSTRAINT "evhs_receipts_confirmed_by_user_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evhs_voucher_items" ADD CONSTRAINT "evhs_voucher_items_voucher_id_evhs_vouchers_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."evhs_vouchers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evhs_voucher_items" ADD CONSTRAINT "evhs_voucher_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evhs_vouchers" ADD CONSTRAINT "evhs_vouchers_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evhs_vouchers" ADD CONSTRAINT "evhs_vouchers_issued_by_user_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restock_notifications" ADD CONSTRAINT "restock_notifications_prediction_id_ai_inventory_predictions_id_fk" FOREIGN KEY ("prediction_id") REFERENCES "public"."ai_inventory_predictions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_product_code_idx" ON "restock_notifications" USING btree ("product_code");--> statement-breakpoint
CREATE INDEX "notifications_urgency_idx" ON "restock_notifications" USING btree ("urgency_level");--> statement-breakpoint
CREATE INDEX "notifications_acknowledged_idx" ON "restock_notifications" USING btree ("is_acknowledged");--> statement-breakpoint
CREATE INDEX "notifications_created_at_idx" ON "restock_notifications" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_predictions_product_code_idx" ON "ai_inventory_predictions" USING btree ("product_code");--> statement-breakpoint
CREATE INDEX "ai_predictions_type_idx" ON "ai_inventory_predictions" USING btree ("prediction_type");--> statement-breakpoint
CREATE INDEX "ai_predictions_created_at_idx" ON "ai_inventory_predictions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ai_predictions_batch_id_idx" ON "ai_inventory_predictions" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "ai_predictions_accuracy_idx" ON "ai_inventory_predictions" USING btree ("accuracy_percentage");--> statement-breakpoint
ALTER TABLE "zmc9_stock_sap" DROP COLUMN "updated_at";--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "unq_material_sloc" UNIQUE("material_number","sloc");