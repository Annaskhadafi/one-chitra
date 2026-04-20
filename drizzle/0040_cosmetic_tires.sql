CREATE TABLE IF NOT EXISTS "cosmetic_tires" (
    "id" serial PRIMARY KEY NOT NULL,
    "tyre_size" varchar(150),
    "pattern" varchar(150),
    "serial_number" varchar(150),
    "month" varchar(50),
    "city" varchar(150),
    "year" varchar(50),
    "material_number" varchar(150),
    "description" text,
    "created_by" text,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "cosmetic_tires" ADD CONSTRAINT "cosmetic_tires_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
