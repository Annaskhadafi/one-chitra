CREATE TYPE "public"."cost_settlement_category" AS ENUM('gasoline', 'toll', 'parking', 'meals', 'maintenance', 'others');--> statement-breakpoint
CREATE TYPE "public"."cost_settlement_status" AS ENUM('draft', 'submitted', 'approved', 'rejected', 'posted');--> statement-breakpoint
CREATE TYPE "public"."cost_settlement_type" AS ENUM('trip', 'delivery');--> statement-breakpoint
CREATE TABLE "cost_settlement_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"settlement_id" integer NOT NULL,
	"cost_category" "cost_settlement_category" NOT NULL,
	"description" varchar(255) NOT NULL,
	"amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"receipt_date" date,
	"vendor_name" varchar(255),
	"delivery_item_id" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cost_settlement_receipts" (
	"id" serial PRIMARY KEY NOT NULL,
	"settlement_item_id" integer NOT NULL,
	"file_url" varchar(255) NOT NULL,
	"original_file_name" varchar(255) NOT NULL,
	"file_size" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"uploaded_by" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cost_settlement_signatories" (
	"id" serial PRIMARY KEY NOT NULL,
	"settlement_id" integer NOT NULL,
	"signatory_name" varchar(255) NOT NULL,
	"signatory_position" varchar(255) NOT NULL,
	"signatory_role" varchar(100) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cost_settlements" (
	"id" serial PRIMARY KEY NOT NULL,
	"settlement_number" varchar(50) NOT NULL,
	"settlement_type" "cost_settlement_type" NOT NULL,
	"fleet_trip_id" integer,
	"delivery_id" integer,
	"driver_name" varchar(255),
	"vehicle_number" varchar(50),
	"advance_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total_actual_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"variance_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"status" "cost_settlement_status" DEFAULT 'draft' NOT NULL,
	"approval_request_id" varchar(36),
	"settlement_date" date NOT NULL,
	"remarks" text,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "cost_settlements_settlement_number_unique" UNIQUE("settlement_number")
);
--> statement-breakpoint
CREATE TABLE "customer_addresses" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"address" text NOT NULL,
	"label" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cost_settlement_items" ADD CONSTRAINT "cost_settlement_items_settlement_id_cost_settlements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."cost_settlements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_settlement_items" ADD CONSTRAINT "cost_settlement_items_delivery_item_id_delivery_items_id_fk" FOREIGN KEY ("delivery_item_id") REFERENCES "public"."delivery_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_settlement_receipts" ADD CONSTRAINT "cost_settlement_receipts_settlement_item_id_cost_settlement_items_id_fk" FOREIGN KEY ("settlement_item_id") REFERENCES "public"."cost_settlement_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_settlement_receipts" ADD CONSTRAINT "cost_settlement_receipts_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_settlement_signatories" ADD CONSTRAINT "cost_settlement_signatories_settlement_id_cost_settlements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."cost_settlements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_settlements" ADD CONSTRAINT "cost_settlements_fleet_trip_id_fleet_trips_id_fk" FOREIGN KEY ("fleet_trip_id") REFERENCES "public"."fleet_trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_settlements" ADD CONSTRAINT "cost_settlements_delivery_id_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_settlements" ADD CONSTRAINT "cost_settlements_approval_request_id_approval_requests_id_fk" FOREIGN KEY ("approval_request_id") REFERENCES "public"."approval_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_settlements" ADD CONSTRAINT "cost_settlements_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cost_settlement_items_settlement_idx" ON "cost_settlement_items" USING btree ("settlement_id");--> statement-breakpoint
CREATE INDEX "cost_settlement_items_category_idx" ON "cost_settlement_items" USING btree ("cost_category");--> statement-breakpoint
CREATE INDEX "cost_settlement_receipts_item_idx" ON "cost_settlement_receipts" USING btree ("settlement_item_id");--> statement-breakpoint
CREATE INDEX "cost_settlement_signatories_settlement_idx" ON "cost_settlement_signatories" USING btree ("settlement_id");--> statement-breakpoint
CREATE INDEX "cost_settlements_type_idx" ON "cost_settlements" USING btree ("settlement_type");--> statement-breakpoint
CREATE INDEX "cost_settlements_status_idx" ON "cost_settlements" USING btree ("status");--> statement-breakpoint
CREATE INDEX "cost_settlements_settlement_date_idx" ON "cost_settlements" USING btree ("settlement_date");--> statement-breakpoint
CREATE INDEX "cost_settlements_trip_idx" ON "cost_settlements" USING btree ("fleet_trip_id");--> statement-breakpoint
CREATE INDEX "cost_settlements_delivery_idx" ON "cost_settlements" USING btree ("delivery_id");