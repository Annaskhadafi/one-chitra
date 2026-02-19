import { db } from "./db";
import { sql } from "drizzle-orm";

async function main() {
    try {
        console.log("Checking applied migrations...");
        // Check if table exists first
        const table = await db.execute(sql`SELECT to_regclass('public.__drizzle_migrations')`);
        if (!table.rows[0].to_regclass) {
            // Try default name
            const table2 = await db.execute(sql`SELECT to_regclass('public.drizzle_migrations')`);
            if (!table2.rows[0].to_regclass) {
                console.log("No migration table found.");
                return;
            }
        }

        // Assuming default table name for now, usually __drizzle_migrations or similar?
        // Let's just try to select from likely names.
        try {
            const res = await db.execute(sql`SELECT * FROM "drizzle"."__drizzle_migrations" ORDER BY created_at DESC LIMIT 5`);
            console.log("Drizzle schema migrations:", res.rows);
        } catch (e) {
            try {
                const res = await db.execute(sql`SELECT * FROM "__drizzle_migrations" ORDER BY created_at DESC LIMIT 5`);
                console.log("Public schema migrations:", res.rows);
            } catch (e2) {
                console.log("Could not query migrations table.");
            }
        }

    } catch (error) {
        console.error("Error checking DB:", error);
    }
    process.exit(0);
}

main();
