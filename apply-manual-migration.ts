import { db } from "./db";
import { sql } from "drizzle-orm";

async function main() {
    try {
        console.log("Applying manual fix for fleet_trip_id...");
        await db.execute(sql`
            ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "fleet_trip_id" integer;
        `);
        console.log("Column added.");

        // Add FK
        try {
            await db.execute(sql`
                DO $$ BEGIN
                 ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_fleet_trip_id_fleet_trips_id_fk" FOREIGN KEY ("fleet_trip_id") REFERENCES "public"."fleet_trips"("id") ON DELETE no action ON UPDATE no action;
                EXCEPTION
                 WHEN duplicate_object THEN null;
                END $$;
            `);
            console.log("FK added.");
        } catch (e: unknown) {
            console.log("FK error/exists:", e instanceof Error ? e.message : String(e));
        }

    } catch (error) {
        console.error("Error manual migration:", error);
    }
    process.exit(0);
}

main();
