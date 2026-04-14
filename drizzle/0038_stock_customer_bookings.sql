CREATE TABLE IF NOT EXISTS "stock_customer_bookings" (
    "id" serial PRIMARY KEY NOT NULL,
    "stock_level_id" integer NOT NULL,
    "customer_id" integer NOT NULL,
    "quantity" integer DEFAULT 0 NOT NULL,
    "remark" text,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stock_customer_bookings"
    ADD CONSTRAINT "stock_customer_bookings_stock_level_id_stock_levels_id_fk"
    FOREIGN KEY ("stock_level_id") REFERENCES "public"."stock_levels"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "stock_customer_bookings"
    ADD CONSTRAINT "stock_customer_bookings_customer_id_customers_id_fk"
    FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "stock_customer_bookings_stock_level_customer_unique"
    ON "stock_customer_bookings" USING btree ("stock_level_id", "customer_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "stock_booking_consumptions" (
    "id" serial PRIMARY KEY NOT NULL,
    "stock_booking_id" integer NOT NULL,
    "delivery_id" integer NOT NULL,
    "quantity" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stock_booking_consumptions"
    ADD CONSTRAINT "stock_booking_consumptions_stock_booking_id_stock_customer_bookings_id_fk"
    FOREIGN KEY ("stock_booking_id") REFERENCES "public"."stock_customer_bookings"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "stock_booking_consumptions"
    ADD CONSTRAINT "stock_booking_consumptions_delivery_id_deliveries_id_fk"
    FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "stock_booking_consumptions_booking_delivery_unique"
    ON "stock_booking_consumptions" USING btree ("stock_booking_id", "delivery_id");
