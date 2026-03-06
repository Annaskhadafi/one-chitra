CREATE TABLE "cover_letter_signers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "me2l_purch_docs_sap" (
	"id" serial PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_revenue_sap" (
	"id" serial PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zmc9_stock_sap" (
	"id" serial PRIMARY KEY NOT NULL,
	"plant_code" text,
	"plant_name" text,
	"material_no" text,
	"old_material_no" text,
	"material_desc" text,
	"stor_loc" text,
	"stor_loc_desc" text,
	"total_stock" numeric(20, 3),
	"base_unit_of_measure" text,
	"value_stock" numeric(20, 3),
	"currency" text,
	"extracted_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "billing_records" DROP CONSTRAINT "billing_records_po_no_unique";--> statement-breakpoint
ALTER TABLE "deliveries" ADD COLUMN "contact_name" varchar(255);--> statement-breakpoint
ALTER TABLE "deliveries" ADD COLUMN "contact_email" varchar(255);--> statement-breakpoint
ALTER TABLE "deliveries" ADD COLUMN "contact_phone" varchar(50);--> statement-breakpoint
ALTER TABLE "deliveries" ADD COLUMN "contact_person" varchar(255);