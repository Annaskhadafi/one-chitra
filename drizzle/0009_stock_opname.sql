CREATE TYPE "public"."stock_opname_status" AS ENUM('open', 'closed', 'cancelled');
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
ALTER TABLE "stock_opname_sessions" ADD CONSTRAINT "stock_opname_sessions_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "stock_opname_sessions" ADD CONSTRAINT "stock_opname_sessions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "stock_opname_sessions" ADD CONSTRAINT "stock_opname_sessions_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "stock_opname_items" ADD CONSTRAINT "stock_opname_items_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."stock_opname_sessions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "stock_opname_items" ADD CONSTRAINT "stock_opname_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "stock_opname_items" ADD CONSTRAINT "stock_opname_items_counted_by_id_fkey" FOREIGN KEY ("counted_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
