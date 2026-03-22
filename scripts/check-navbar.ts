import { db } from "../db";
import { sql } from "drizzle-orm";

async function main() {
    try {
        const res = await db.execute(sql`SELECT value FROM settings WHERE key = 'navbar_menu_config_v2';`);
        console.log("Navbar setting:", res.rows[0]?.value);
        process.exit(0);
    } catch (e) {
        console.error("Error:", e);
        process.exit(1);
    }
}
main();
