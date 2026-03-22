CREATE TABLE "evhs_master_prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"material_number_cp" varchar(100) NOT NULL,
	"material_number_ck" varchar(100),
	"warehouse_id" integer NOT NULL,
	"price" numeric(15, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_warehouse_access" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"warehouse_id" integer NOT NULL,
	"access_level" varchar(10) DEFAULT 'edit' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_warehouse_access_user_warehouse_unique" UNIQUE("user_id","warehouse_id")
);
--> statement-breakpoint
ALTER TABLE "evhs_gi_records" ADD COLUMN "wo_no" varchar(100);--> statement-breakpoint
ALTER TABLE "evhs_vouchers" ADD COLUMN "mrko_no" varchar(100);--> statement-breakpoint
ALTER TABLE "evhs_master_prices" ADD CONSTRAINT "evhs_master_prices_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_warehouse_access" ADD CONSTRAINT "user_warehouse_access_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_warehouse_access" ADD CONSTRAINT "user_warehouse_access_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;