import { db } from "../db";
import { sql } from "drizzle-orm";
import { parseNavigationConfigFromSetting } from "../lib/navigation-menu";

async function main() {
    try {
        const res = await db.execute(sql`SELECT value FROM settings WHERE key = 'navbar_menu_config_v2';`);
        const raw = res.rows[0]?.value as string;

        const merged = parseNavigationConfigFromSetting(raw);

        const marketingSection = merged.find(s => s.title === "Business & Analytics");
        console.log(JSON.stringify(marketingSection?.items, null, 2));

        process.exit(0);
    } catch (e) {
        console.error("Error:", e);
        process.exit(1);
    }
}
main();
