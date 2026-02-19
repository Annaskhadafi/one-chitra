CREATE TABLE "fleet_trips" (
	"id" serial PRIMARY KEY NOT NULL,
	"trip_number" varchar(50) NOT NULL,
	"driver_id" integer,
	"vehicle_id" integer,
	"status" varchar(20) DEFAULT 'scheduled' NOT NULL,
	"date" timestamp NOT NULL,
	"notes" text,
	"cost_gasoline" numeric(15, 2) DEFAULT '0',
	"cost_toll" numeric(15, 2) DEFAULT '0',
	"cost_parking" numeric(15, 2) DEFAULT '0',
	"cost_meals" numeric(15, 2) DEFAULT '0',
	"cost_maintenance" numeric(15, 2) DEFAULT '0',
	"cost_others" numeric(15, 2) DEFAULT '0',
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fleet_trips_trip_number_unique_v2" UNIQUE("trip_number")
);
--> statement-breakpoint


ALTER TABLE "fleet_trips" ADD CONSTRAINT "fleet_trips_driver_id_fleet_drivers_id_fk_v2" FOREIGN KEY ("driver_id") REFERENCES "public"."fleet_drivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet_trips" ADD CONSTRAINT "fleet_trips_vehicle_id_fleet_vehicles_id_fk_v2" FOREIGN KEY ("vehicle_id") REFERENCES "public"."fleet_vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet_trips" ADD CONSTRAINT "fleet_trips_created_by_user_id_fk_v2" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;