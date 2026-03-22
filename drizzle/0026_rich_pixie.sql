CREATE TABLE "ai_inventory_predictions" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_code" varchar(100) NOT NULL,
	"product_name" text,
	"prediction_type" varchar(50) NOT NULL,
	"recommended_stock" integer NOT NULL,
	"rationale" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bundling_histories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scenario_name" text NOT NULL,
	"items_data" jsonb NOT NULL,
	"competitor_price" numeric DEFAULT '0' NOT NULL,
	"target_margin_percentage" numeric NOT NULL,
	"recommended_qty_primary" numeric DEFAULT '0' NOT NULL,
	"final_margin_amount" numeric NOT NULL,
	"final_margin_percentage" numeric NOT NULL,
	"status" text,
	"created_by_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_cost_request_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer,
	"delivery_id" integer,
	"no_pol" text,
	"driver_name" text,
	"trip_destination" text,
	"fuel_cost" numeric(20, 2) DEFAULT '0',
	"meal_allowance" numeric(20, 2) DEFAULT '0',
	"medical_test" numeric(20, 2) DEFAULT '0',
	"toll_road" numeric(20, 2) DEFAULT '0',
	"ferry_cost" numeric(20, 2) DEFAULT '0',
	"portal_cost" numeric(20, 2) DEFAULT '0',
	"wash_grease_cost" numeric(20, 2) DEFAULT '0',
	"escort_cost" numeric(20, 2) DEFAULT '0',
	"total_cost" numeric(20, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_cost_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_date" date NOT NULL,
	"acc_no" text,
	"bank_name" text,
	"account_name" text,
	"remarks" text,
	"request_by" text,
	"known_by_1" text,
	"known_by_2" text,
	"approved_by" text,
	"received_by" text,
	"total_request" numeric(20, 2),
	"total_transfer" numeric(20, 2),
	"total_balance" numeric(20, 2),
	"status" text DEFAULT 'Pengajuan' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"subject" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"segment_criteria" text,
	"scheduled_at" timestamp,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"total_recipients" integer DEFAULT 0,
	"success_count" integer DEFAULT 0,
	"failure_count" integer DEFAULT 0,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "me2l_purch_docs_sap" ADD COLUMN "purch_doc_id" integer PRIMARY KEY NOT NULL;--> statement-breakpoint
ALTER TABLE "me2l_purch_docs_sap" ADD COLUMN "item" integer;--> statement-breakpoint
ALTER TABLE "me2l_purch_docs_sap" ADD COLUMN "purch_group" text;--> statement-breakpoint
ALTER TABLE "me2l_purch_docs_sap" ADD COLUMN "doc_date" date;--> statement-breakpoint
ALTER TABLE "me2l_purch_docs_sap" ADD COLUMN "order_qty" double precision;--> statement-breakpoint
ALTER TABLE "me2l_purch_docs_sap" ADD COLUMN "net_price" double precision;--> statement-breakpoint
ALTER TABLE "me2l_purch_docs_sap" ADD COLUMN "price_unit" integer;--> statement-breakpoint
ALTER TABLE "me2l_purch_docs_sap" ADD COLUMN "delivered_qty" double precision;--> statement-breakpoint
ALTER TABLE "me2l_purch_docs_sap" ADD COLUMN "delivered_val" double precision;--> statement-breakpoint
ALTER TABLE "me2l_purch_docs_sap" ADD COLUMN "invoiced_qty" double precision;--> statement-breakpoint
ALTER TABLE "me2l_purch_docs_sap" ADD COLUMN "invoiced_val" double precision;--> statement-breakpoint
ALTER TABLE "me2l_purch_docs_sap" ADD COLUMN "net_order_value" double precision;--> statement-breakpoint
ALTER TABLE "me2l_purch_docs_sap" ADD COLUMN "purch_org" text;--> statement-breakpoint
ALTER TABLE "me2l_purch_docs_sap" ADD COLUMN "extracted_at" timestamp;--> statement-breakpoint
ALTER TABLE "me2l_purch_docs_sap" ADD COLUMN "plant" text;--> statement-breakpoint
ALTER TABLE "me2l_purch_docs_sap" ADD COLUMN "purchasing_doc" text;--> statement-breakpoint
ALTER TABLE "me2l_purch_docs_sap" ADD COLUMN "vendor_name" text;--> statement-breakpoint
ALTER TABLE "me2l_purch_docs_sap" ADD COLUMN "material" text;--> statement-breakpoint
ALTER TABLE "me2l_purch_docs_sap" ADD COLUMN "tracking_no" text;--> statement-breakpoint
ALTER TABLE "me2l_purch_docs_sap" ADD COLUMN "po_history" text;--> statement-breakpoint
ALTER TABLE "me2l_purch_docs_sap" ADD COLUMN "currency" text;--> statement-breakpoint
ALTER TABLE "me2l_purch_docs_sap" ADD COLUMN "doc_type" text;--> statement-breakpoint
ALTER TABLE "me2l_purch_docs_sap" ADD COLUMN "doc_cat" text;--> statement-breakpoint
ALTER TABLE "me2l_purch_docs_sap" ADD COLUMN "storage_loc" text;--> statement-breakpoint
ALTER TABLE "me2l_purch_docs_sap" ADD COLUMN "order_unit" text;--> statement-breakpoint
ALTER TABLE "me2l_purch_docs_sap" ADD COLUMN "release_state" text;--> statement-breakpoint
ALTER TABLE "me2l_purch_docs_sap" ADD COLUMN "short_text" text;--> statement-breakpoint
ALTER TABLE "me2l_purch_docs_sap" ADD COLUMN "material_group" text;--> statement-breakpoint
ALTER TABLE "me2l_purch_docs_sap" ADD COLUMN "gr_processed_date" timestamp;--> statement-breakpoint
ALTER TABLE "me2l_purch_docs_sap" ADD COLUMN "gr_warehouse_id" integer;--> statement-breakpoint
ALTER TABLE "sales_revenue_sap" ADD COLUMN "sales_rev_id" serial PRIMARY KEY NOT NULL;--> statement-breakpoint
ALTER TABLE "sales_revenue_sap" ADD COLUMN "sorg" text;--> statement-breakpoint
ALTER TABLE "sales_revenue_sap" ADD COLUMN "bill_ty" text;--> statement-breakpoint
ALTER TABLE "sales_revenue_sap" ADD COLUMN "rev_type" text;--> statement-breakpoint
ALTER TABLE "sales_revenue_sap" ADD COLUMN "customer" text;--> statement-breakpoint
ALTER TABLE "sales_revenue_sap" ADD COLUMN "customer_name" text;--> statement-breakpoint
ALTER TABLE "sales_revenue_sap" ADD COLUMN "salesman" text;--> statement-breakpoint
ALTER TABLE "sales_revenue_sap" ADD COLUMN "item" integer;--> statement-breakpoint
ALTER TABLE "sales_revenue_sap" ADD COLUMN "sloc" text;--> statement-breakpoint
ALTER TABLE "sales_revenue_sap" ADD COLUMN "plant" text;--> statement-breakpoint
ALTER TABLE "sales_revenue_sap" ADD COLUMN "material_no" text;--> statement-breakpoint
ALTER TABLE "sales_revenue_sap" ADD COLUMN "material_description" text;--> statement-breakpoint
ALTER TABLE "sales_revenue_sap" ADD COLUMN "size_dimen" text;--> statement-breakpoint
ALTER TABLE "sales_revenue_sap" ADD COLUMN "material_group" text;--> statement-breakpoint
ALTER TABLE "sales_revenue_sap" ADD COLUMN "mat_grp_desc" text;--> statement-breakpoint
ALTER TABLE "sales_revenue_sap" ADD COLUMN "mat_grp1" text;--> statement-breakpoint
ALTER TABLE "sales_revenue_sap" ADD COLUMN "mat_grp1_desc" text;--> statement-breakpoint
ALTER TABLE "sales_revenue_sap" ADD COLUMN "mat_grp2" text;--> statement-breakpoint
ALTER TABLE "sales_revenue_sap" ADD COLUMN "mat_grp2_desc" text;--> statement-breakpoint
ALTER TABLE "sales_revenue_sap" ADD COLUMN "mat_grp3" text;--> statement-breakpoint
ALTER TABLE "sales_revenue_sap" ADD COLUMN "mat_grp3_desc" text;--> statement-breakpoint
ALTER TABLE "sales_revenue_sap" ADD COLUMN "mat_grp4" text;--> statement-breakpoint
ALTER TABLE "sales_revenue_sap" ADD COLUMN "mat_grp4_desc" text;--> statement-breakpoint
ALTER TABLE "sales_revenue_sap" ADD COLUMN "mat_grp5" text;--> statement-breakpoint
ALTER TABLE "sales_revenue_sap" ADD COLUMN "mat_grp5_desc" text;--> statement-breakpoint
ALTER TABLE "sales_revenue_sap" ADD COLUMN "qty" integer;--> statement-breakpoint
ALTER TABLE "sales_revenue_sap" ADD COLUMN "uom" text;--> statement-breakpoint
ALTER TABLE "sales_revenue_sap" ADD COLUMN "curr" text;--> statement-breakpoint
ALTER TABLE "sales_revenue_sap" ADD COLUMN "base_price" double precision;--> statement-breakpoint
ALTER TABLE "sales_revenue_sap" ADD COLUMN "intdept_price" double precision;--> statement-breakpoint
ALTER TABLE "sales_revenue_sap" ADD COLUMN "adjustment_price" double precision;--> statement-breakpoint
ALTER TABLE "sales_revenue_sap" ADD COLUMN "revenue_in_doc_curr" double precision;--> statement-breakpoint
ALTER TABLE "sales_revenue_sap" ADD COLUMN "revenue_in_loc_curr" double precision;--> statement-breakpoint
ALTER TABLE "sales_revenue_sap" ADD COLUMN "billing_no" text;--> statement-breakpoint
ALTER TABLE "sales_revenue_sap" ADD COLUMN "billing_date" date;--> statement-breakpoint
ALTER TABLE "sales_revenue_sap" ADD COLUMN "inco1" text;--> statement-breakpoint
ALTER TABLE "sales_revenue_sap" ADD COLUMN "inco2" text;--> statement-breakpoint
ALTER TABLE "sales_revenue_sap" ADD COLUMN "c" text;--> statement-breakpoint
ALTER TABLE "sales_revenue_sap" ADD COLUMN "cancelled" text;--> statement-breakpoint
ALTER TABLE "sales_revenue_sap" ADD COLUMN "delivery_no" text;--> statement-breakpoint
ALTER TABLE "sales_revenue_sap" ADD COLUMN "sales_order" text;--> statement-breakpoint
ALTER TABLE "sales_revenue_sap" ADD COLUMN "work_order" text;--> statement-breakpoint
ALTER TABLE "sales_revenue_sap" ADD COLUMN "po_no" text;--> statement-breakpoint
ALTER TABLE "sales_revenue_sap" ADD COLUMN "po_date" date;--> statement-breakpoint
ALTER TABLE "sales_revenue_sap" ADD COLUMN "po_type" text;--> statement-breakpoint
ALTER TABLE "sales_revenue_sap" ADD COLUMN "cost_of_sales" double precision;--> statement-breakpoint
ALTER TABLE "sales_revenue_sap" ADD COLUMN "profit_margin" double precision;--> statement-breakpoint
ALTER TABLE "sales_revenue_sap" ADD COLUMN "extracted_at" timestamp;--> statement-breakpoint
ALTER TABLE "zmc9_stock_sap" ADD COLUMN "stock_id" serial PRIMARY KEY NOT NULL;--> statement-breakpoint
ALTER TABLE "bundling_histories" ADD CONSTRAINT "bundling_histories_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_cost_request_items" ADD CONSTRAINT "delivery_cost_request_items_request_id_delivery_cost_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."delivery_cost_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_cost_request_items" ADD CONSTRAINT "delivery_cost_request_items_delivery_id_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "doc_date_idx" ON "me2l_purch_docs_sap" USING btree ("doc_date");--> statement-breakpoint
ALTER TABLE "me2l_purch_docs_sap" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "sales_revenue_sap" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "zmc9_stock_sap" DROP COLUMN "id";