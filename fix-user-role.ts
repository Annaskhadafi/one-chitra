
import { db } from "./db";
import { user } from "./db/schema/auth";
import { eq, ilike } from "drizzle-orm";

async function main() {
    const email = "mochamad.khadafi@chitraparatama.co.id";
    console.log(`Updating role for ${email} to 'Admin'...`);

    const res = await db.update(user)
        .set({ role: 'Admin' })
        .where(ilike(user.email, email))
        .returning();

    console.log("Update result:", res);
}

main().catch(console.error).then(() => process.exit(0));
