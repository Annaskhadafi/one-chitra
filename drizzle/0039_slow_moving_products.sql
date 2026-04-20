CREATE TABLE IF NOT EXISTS "slow_moving_products" (
    "id" serial PRIMARY KEY NOT NULL,
    "material_key" varchar(150) NOT NULL,
    "material_number" varchar(150) NOT NULL,
    "description" text,
    "created_by" text,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "slow_moving_products_material_key_unique" UNIQUE("material_key")
);

DO $$ BEGIN
 ALTER TABLE "slow_moving_products" ADD CONSTRAINT "slow_moving_products_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
