CREATE TYPE "public"."calendar_event_type" AS ENUM('marketing', 'reminder');--> statement-breakpoint
CREATE TYPE "public"."price_list_type" AS ENUM('tier', 'customer', 'promotional');--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone,
	"all_day" boolean DEFAULT false NOT NULL,
	"type" "calendar_event_type" DEFAULT 'marketing' NOT NULL,
	"color" varchar(20) DEFAULT '#3b82f6',
	"related_customer_id" integer,
	"email_reminder_at" timestamp with time zone,
	"email_reminder_sent" boolean DEFAULT false NOT NULL,
	"email_reminder_to" varchar(255),
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"price_list_item_id" integer NOT NULL,
	"field_changed" varchar(50) NOT NULL,
	"old_value" text,
	"new_value" text,
	"reason" text,
	"changed_by_id" text,
	"changed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_list_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"price_list_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"unit_price" numeric(16, 2) DEFAULT '0' NOT NULL,
	"min_qty" integer DEFAULT 1 NOT NULL,
	"max_qty" integer,
	"discount_pct" numeric(5, 2) DEFAULT '0' NOT NULL,
	"margin_floor" numeric(5, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_lists" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"type" "price_list_type" DEFAULT 'tier' NOT NULL,
	"customer_id" integer,
	"currency" varchar(10) DEFAULT 'IDR' NOT NULL,
	"valid_from" timestamp DEFAULT now() NOT NULL,
	"valid_until" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "birthday" date;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_related_customer_id_customers_id_fk" FOREIGN KEY ("related_customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_price_list_item_id_price_list_items_id_fk" FOREIGN KEY ("price_list_item_id") REFERENCES "public"."price_list_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_changed_by_id_user_id_fk" FOREIGN KEY ("changed_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_price_list_id_price_lists_id_fk" FOREIGN KEY ("price_list_id") REFERENCES "public"."price_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;