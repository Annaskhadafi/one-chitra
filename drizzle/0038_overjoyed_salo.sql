CREATE TABLE "business_cards" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"company" varchar(255),
	"job_title" varchar(255),
	"phone" varchar(255),
	"email" varchar(255),
	"address" text,
	"business_category" varchar(255),
	"image_url" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_contract_details" (
	"id" serial PRIMARY KEY NOT NULL,
	"contract_id" integer NOT NULL,
	"material_no" text NOT NULL,
	"qty_contract" integer DEFAULT 0 NOT NULL,
	"contract_price" numeric(20, 2) DEFAULT '0' NOT NULL,
	"forecast_qty_per_month" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_contracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"customer_id" text NOT NULL,
	"customer_name" text NOT NULL,
	"contract_number" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"material_no" text,
	"material_group" text,
	"incentive_amount" numeric(20, 2) NOT NULL,
	"is_percentage" boolean DEFAULT false NOT NULL,
	"active_status" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"start_date" date NOT NULL,
	"end_date" date,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "business_category" varchar(255);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "business_category_source" varchar(100);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "business_category_enriched_at" timestamp;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "material_number_ptro" varchar(100);--> statement-breakpoint
ALTER TABLE "campaign_contract_details" ADD CONSTRAINT "campaign_contract_details_contract_id_campaign_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."campaign_contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_contracts" ADD CONSTRAINT "campaign_contracts_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_products" ADD CONSTRAINT "campaign_products_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;