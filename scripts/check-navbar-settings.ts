import { db } from "./db";
import { settings } from "./db/schema";
import { eq } from "drizzle-orm";
import { NAVBAR_MENU_SETTING_KEY } from "./lib/navigation-menu";

async function checkSettings() {
    const result = await db
        .select()
        .from(settings)
        .where(eq(settings.key, NAVBAR_MENU_SETTING_KEY))
        .limit(1);

    console.log("Current Navbar Settings:");
    console.log(JSON.stringify(result, null, 2));
}

checkSettings().catch(console.error);
