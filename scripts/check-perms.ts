import { db } from "../db"
import { permissions } from "../db/schema"
import { eq } from "drizzle-orm"

async function check() {
    console.log("Checking bundling permissions...")
    const perms = await db.select().from(permissions).where(eq(permissions.resource, "bundling"))
    console.log("Found permissions:", perms)
    process.exit(0)
}

check()
