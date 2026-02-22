import { db } from "../db"
import { user } from "../db/schema/auth"

async function main() {
    const users = await db.select().from(user)
    users.forEach(u => {
        console.log(`[USER] Email: ${JSON.stringify(u.email)} | Role: ${JSON.stringify(u.role)}`)
    })
}

main().catch(error => {
    console.error("Script failed:", error)
}).finally(() => {
    process.exit(0)
})
