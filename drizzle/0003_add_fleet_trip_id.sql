ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "fleet_trip_id" integer;
DO $$ BEGIN
 ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_fleet_trip_id_fleet_trips_id_fk" FOREIGN KEY ("fleet_trip_id") REFERENCES "public"."fleet_trips"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
