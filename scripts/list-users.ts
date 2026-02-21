import { db } from "../db";
import { user } from "../db/schema";

async function main() {
    const users = await db.select().from(user);
    console.log(JSON.stringify(users, null, 2));
    process.exit(0);
}

main();
