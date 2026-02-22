import { db } from "../db";
import { historyOrders } from "../db/schema/history-orders";
import { ilike, sql, and } from "drizzle-orm";

async function checkYears() {
    console.log("Checking R49 years...");

    const years = await db.select({
        year: sql<string>`split_part(${historyOrders.billingDate}, '/', 3)`,
        count: sql<number>`count(*)`
    })
        .from(historyOrders)
        .where(and(
            ilike(historyOrders.matGrpDesc, 'EARTHMOVER TIRES R49'),
            ilike(historyOrders.revType, '%Trading%')
        ))
        .groupBy(sql`split_part(${historyOrders.billingDate}, '/', 3)`)
        .orderBy(desc(sql`split_part(${historyOrders.billingDate}, '/', 3)`));

    console.log("YEARS_WITH_R49_TRADING:");
    console.table(years);

    process.exit(0);
}

import { desc } from "drizzle-orm";
checkYears();
