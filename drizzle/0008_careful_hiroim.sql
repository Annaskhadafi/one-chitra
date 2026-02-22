CREATE TABLE "competitor_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_consultant_id" text,
	"info_date" timestamp NOT NULL,
	"competitor_name" text NOT NULL,
	"customer_name" text NOT NULL,
	"industry_category" text NOT NULL,
	"location" text NOT NULL,
	"activity_type" text NOT NULL,
	"market_response" text NOT NULL,
	"business_impact" text NOT NULL,
	"description" text,
	"created_by_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competitor_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"info_date" timestamp NOT NULL,
	"business_consultant_id" text,
	"consultant_name" text,
	"customer_name" text NOT NULL,
	"product_size" text NOT NULL,
	"category" text NOT NULL,
	"brand" text NOT NULL,
	"supplier" text NOT NULL,
	"currency" text NOT NULL,
	"price" text NOT NULL,
	"remark" text,
	"created_by_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lost_sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_consultant_id" text,
	"product_type" text NOT NULL,
	"offering_date" timestamp NOT NULL,
	"customer_name" text NOT NULL,
	"product_detail" text NOT NULL,
	"total_offering" text NOT NULL,
	"reason" text NOT NULL,
	"remark" text,
	"created_by_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"warehouse_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"type" varchar(50) NOT NULL,
	"reference_number" varchar(100),
	"recorded_by" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "competitor_activities" ADD CONSTRAINT "competitor_activities_business_consultant_id_user_id_fk" FOREIGN KEY ("business_consultant_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_activities" ADD CONSTRAINT "competitor_activities_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_prices" ADD CONSTRAINT "competitor_prices_business_consultant_id_user_id_fk" FOREIGN KEY ("business_consultant_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_prices" ADD CONSTRAINT "competitor_prices_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lost_sales" ADD CONSTRAINT "lost_sales_business_consultant_id_user_id_fk" FOREIGN KEY ("business_consultant_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lost_sales" ADD CONSTRAINT "lost_sales_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_recorded_by_user_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;