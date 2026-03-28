CREATE TABLE IF NOT EXISTS "inventory_vendor_lead_times" (
 "id" serial PRIMARY KEY NOT NULL,
 "vendor_name" text NOT NULL,
 "default_lead_time_days" integer,
 "notes" text,
 "is_active" boolean DEFAULT true NOT NULL,
 "created_at" timestamp DEFAULT now() NOT NULL,
 "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "inventory_vendor_lead_time_materials" (
 "id" serial PRIMARY KEY NOT NULL,
 "vendor_id" integer NOT NULL,
 "material_no" text NOT NULL,
 "material_desc" text,
 "lead_time_days" integer NOT NULL,
 "is_preferred" boolean DEFAULT false NOT NULL,
 "created_at" timestamp DEFAULT now() NOT NULL,
 "updated_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "inventory_vendor_lead_time_materials"
 ADD CONSTRAINT "inventory_vendor_lead_time_materials_vendor_id_inventory_vendor_lead_times_id_fk"
 FOREIGN KEY ("vendor_id") REFERENCES "public"."inventory_vendor_lead_times"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "inventory_vendor_lead_times_vendor_name_uidx" ON "inventory_vendor_lead_times" USING btree ("vendor_name");
CREATE INDEX IF NOT EXISTS "inventory_vendor_lead_times_is_active_idx" ON "inventory_vendor_lead_times" USING btree ("is_active");
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_vendor_lead_time_materials_vendor_material_uidx" ON "inventory_vendor_lead_time_materials" USING btree ("vendor_id","material_no");
CREATE INDEX IF NOT EXISTS "inventory_vendor_lead_time_materials_vendor_id_idx" ON "inventory_vendor_lead_time_materials" USING btree ("vendor_id");
CREATE INDEX IF NOT EXISTS "inventory_vendor_lead_time_materials_material_no_idx" ON "inventory_vendor_lead_time_materials" USING btree ("material_no");
CREATE INDEX IF NOT EXISTS "inventory_vendor_lead_time_materials_preferred_idx" ON "inventory_vendor_lead_time_materials" USING btree ("is_preferred");
