CREATE TABLE "chat_user_stickers" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"name" varchar(120) NOT NULL,
	"url" text NOT NULL,
	"content_type" varchar(120),
	"size" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cosmetic_tires" (
	"id" serial PRIMARY KEY NOT NULL,
	"tyre_size" varchar(150),
	"pattern" varchar(150),
	"serial_number" varchar(150),
	"month" varchar(50),
	"city" varchar(150),
	"year" varchar(50),
	"material_number" varchar(150),
	"description" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_cost_credits" (
	"id" serial PRIMARY KEY NOT NULL,
	"credit_date" date NOT NULL,
	"amount" numeric(20, 2) DEFAULT '0' NOT NULL,
	"remarks" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instagram_image_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"prompt" text NOT NULL,
	"enhanced_prompt" text,
	"format" text NOT NULL,
	"content_type" text NOT NULL,
	"visual_style" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"mime_type" text DEFAULT 'image/png' NOT NULL,
	"size_bytes" integer,
	"image_url" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"download_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "logistics_master_prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_location" varchar(160) NOT NULL,
	"to_location" varchar(200) NOT NULL,
	"cost" numeric(16, 2) DEFAULT '0' NOT NULL,
	"truck_type" varchar(120),
	"status_tb" text,
	"ring_24" integer,
	"ring_25" integer,
	"ring_29" integer,
	"ring_33" integer,
	"ring_35" integer,
	"ring_49" integer,
	"ring_51" integer,
	"ring_57" integer,
	"ring_63" integer,
	"product_type" varchar(80),
	"notes" text,
	"created_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "repair_master_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"material_code" varchar(100) NOT NULL,
	"material_name" text NOT NULL,
	"valuation_stock_value" varchar(100),
	"currency" varchar(20),
	"valuated_stock" varchar(100),
	"uom" varchar(30),
	"category" varchar(100),
	"smu" varchar(50),
	"default_qty" varchar(50),
	"standard_time" varchar(50),
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unq_repair_master_item_code" UNIQUE("material_code")
);
--> statement-breakpoint
CREATE TABLE "repair_master_sites" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_code" varchar(50) NOT NULL,
	"site_name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unq_repair_master_site_code" UNIQUE("site_code")
);
--> statement-breakpoint
CREATE TABLE "slow_moving_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"material_key" varchar(150) NOT NULL,
	"material_number" varchar(150) NOT NULL,
	"description" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "slow_moving_products_material_key_unique" UNIQUE("material_key")
);
--> statement-breakpoint
CREATE TABLE "stock_booking_consumptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"stock_booking_id" integer NOT NULL,
	"delivery_id" integer NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stock_booking_consumptions_booking_delivery_unique" UNIQUE("stock_booking_id","delivery_id")
);
--> statement-breakpoint
CREATE TABLE "stock_customer_bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"stock_level_id" integer NOT NULL,
	"customer_id" integer NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"remark" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stock_customer_bookings_stock_level_customer_unique" UNIQUE("stock_level_id","customer_id")
);
--> statement-breakpoint
CREATE TABLE "tire_performance_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" varchar(20) NOT NULL,
	"performance_date" varchar(100) NOT NULL,
	"end_user" varchar(150) NOT NULL,
	"mine_site" varchar(150) NOT NULL,
	"manufacture" varchar(150) NOT NULL,
	"specification" text NOT NULL,
	"avg_hours" numeric(14, 2) DEFAULT '0' NOT NULL,
	"record_count" integer DEFAULT 0 NOT NULL,
	"remarks" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iw39_pmo_report_sap" (
	"pmo_report_id" integer PRIMARY KEY NOT NULL,
	"order_type" text,
	"wo_number_sap" text,
	"wo_create_on" date,
	"customer_id" text,
	"customer_name" text,
	"basic_start" date,
	"basic_finish" date,
	"po_number" text,
	"po_date" date,
	"work_description" text,
	"system_status" text,
	"actual_total_cost" numeric(20, 2),
	"actual_total_revenue" numeric(20, 2),
	"extracted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "table_name" varchar(100);--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "record_id" varchar(100);--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "attachments" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "reactions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "mentioned_user_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "is_deleted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "edited_at" timestamp;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "pinned_at" timestamp;--> statement-breakpoint
ALTER TABLE "delivery_cost_request_items" ADD COLUMN "realization_status" text DEFAULT 'Done';--> statement-breakpoint
ALTER TABLE "delivery_cost_request_items" ADD COLUMN "realization_remarks" text;--> statement-breakpoint
ALTER TABLE "delivery_cost_request_items" ADD COLUMN "realization_details" jsonb;--> statement-breakpoint
ALTER TABLE "email_logs" ADD COLUMN "action_url" text;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD COLUMN "trip_destination" varchar(255);--> statement-breakpoint
ALTER TABLE "chat_user_stickers" ADD CONSTRAINT "chat_user_stickers_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cosmetic_tires" ADD CONSTRAINT "cosmetic_tires_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instagram_image_history" ADD CONSTRAINT "instagram_image_history_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_master_prices" ADD CONSTRAINT "logistics_master_prices_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slow_moving_products" ADD CONSTRAINT "slow_moving_products_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_booking_consumptions" ADD CONSTRAINT "stock_booking_consumptions_stock_booking_id_stock_customer_bookings_id_fk" FOREIGN KEY ("stock_booking_id") REFERENCES "public"."stock_customer_bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_booking_consumptions" ADD CONSTRAINT "stock_booking_consumptions_delivery_id_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_customer_bookings" ADD CONSTRAINT "stock_customer_bookings_stock_level_id_stock_levels_id_fk" FOREIGN KEY ("stock_level_id") REFERENCES "public"."stock_levels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_customer_bookings" ADD CONSTRAINT "stock_customer_bookings_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tire_performance_records" ADD CONSTRAINT "tire_performance_records_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_idx" ON "push_subscriptions" USING btree ("user_id");