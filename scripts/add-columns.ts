import { db } from "../db";
import { sql } from "drizzle-orm";

async function main() {
    try {
        console.log("Killing other postgres connections...");
        const res = await db.execute(sql`
            SELECT pg_terminate_backend(pid) 
            FROM pg_stat_activity 
            WHERE pid <> pg_backend_pid() 
            AND datname = current_database();
        `);
        console.log("Killed.", res);

        console.log("Adding status column to delivery_cost_requests...");
        await db.execute(sql`ALTER TABLE delivery_cost_requests ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Pengajuan';`);

        console.log("Adding delivery_id column to delivery_cost_request_items...");
        await db.execute(sql`ALTER TABLE delivery_cost_request_items ADD COLUMN IF NOT EXISTS delivery_id integer REFERENCES deliveries(id) ON DELETE SET NULL;`);

        console.log("Success!");
        process.exit(0);
    } catch (e) {
        console.error("Error:", e);
        process.exit(1);
    }
}

main();
