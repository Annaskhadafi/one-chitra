CREATE TABLE IF NOT EXISTS "logistics_master_prices" (
    "id" serial PRIMARY KEY NOT NULL,
    "from_location" varchar(160) NOT NULL,
    "to_location" varchar(200) NOT NULL,
    "cost" numeric(16, 2) DEFAULT '0' NOT NULL,
    "truck_type" varchar(120),
    "status_tb" text,
    "ring_24" integer,
    "ring_25" integer,
    "ring_29" integer,
    "ring_33" integer,
    "ring_35" integer,
    "ring_49" integer,
    "ring_51" integer,
    "ring_57" integer,
    "ring_63" integer,
    "product_type" varchar(80),
    "notes" text,
    "created_by_id" text,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "logistics_master_prices"
 ADD CONSTRAINT "logistics_master_prices_created_by_id_user_id_fk"
 FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
