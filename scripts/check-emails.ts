import { db } from "../db"
import { customers } from "../db/schema"
import { isNotNull, count } from "drizzle-orm"

async function checkEmails() {
    try {
        const total = await db.select({ count: count() }).from(customers)
        const withEmail = await db.select({ count: count() }).from(customers).where(isNotNull(customers.email))
        console.log("Total pelanggan:", total[0].count)
        console.log("Pelanggan dengan Email:", withEmail[0].count)
    } catch (e) {
        console.error(e)
    } finally {
        process.exit(0)
    }
}
checkEmails()
