CREATE TYPE "public"."email_recipient_role" AS ENUM('admin', 'manager', 'staff', 'customer', 'all');--> statement-breakpoint
CREATE TYPE "public"."email_template_type" AS ENUM('magic_link', 'notification', 'welcome', 'password_reset', 'order_confirmation', 'delivery_update', 'custom');--> statement-breakpoint
CREATE TYPE "public"."stock_opname_status" AS ENUM('open', 'closed', 'cancelled');--> statement-breakpoint
CREATE TABLE "email_logs" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"template_id" varchar(36),
	"to_email" varchar(255) NOT NULL,
	"subject" varchar(500) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "email_template_type" NOT NULL,
	"subject" varchar(500) NOT NULL,
	"html_content" text NOT NULL,
	"text_content" text,
	"variables" jsonb DEFAULT '[]'::jsonb,
	"recipient_roles" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"icon" varchar(100) DEFAULT 'Globe' NOT NULL,
	"color" varchar(50) DEFAULT '#3b82f6' NOT NULL,
	"url" text NOT NULL,
	"new_tab" boolean DEFAULT true NOT NULL,
	"category" varchar(100) DEFAULT 'General' NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "smtp_settings" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"host" varchar(255) DEFAULT 'smtp.gmail.com' NOT NULL,
	"port" varchar(10) DEFAULT '587' NOT NULL,
	"secure" boolean DEFAULT false NOT NULL,
	"username" varchar(255) NOT NULL,
	"password" varchar(255) NOT NULL,
	"from_email" varchar(255) NOT NULL,
	"from_name" varchar(255) DEFAULT 'One Chitra' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_opname_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"system_qty" integer DEFAULT 0 NOT NULL,
	"counted_qty" integer,
	"variance" integer,
	"notes" text,
	"counted_by_id" text,
	"counted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_opname_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"warehouse_id" integer NOT NULL,
	"status" "stock_opname_status" DEFAULT 'open' NOT NULL,
	"notes" text,
	"created_by_id" text,
	"closed_by_id" text,
	"closed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" DROP CONSTRAINT "products_material_number_sloc_unique";--> statement-breakpoint
ALTER TABLE "stock_movements" ALTER COLUMN "recorded_by" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "stock_opname_items" ADD CONSTRAINT "stock_opname_items_session_id_stock_opname_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."stock_opname_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_opname_items" ADD CONSTRAINT "stock_opname_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_opname_items" ADD CONSTRAINT "stock_opname_items_counted_by_id_user_id_fk" FOREIGN KEY ("counted_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_opname_sessions" ADD CONSTRAINT "stock_opname_sessions_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_opname_sessions" ADD CONSTRAINT "stock_opname_sessions_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_opname_sessions" ADD CONSTRAINT "stock_opname_sessions_closed_by_id_user_id_fk" FOREIGN KEY ("closed_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;