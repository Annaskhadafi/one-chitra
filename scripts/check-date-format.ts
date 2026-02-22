import { db } from "../db";
import { historyOrders } from "../db/schema/history-orders";
import { ilike, sql, and } from "drizzle-orm";

async function checkDate() {
    console.log("Checking R49 dates and raw values...");

    const samples = await db.select({
        billingDate: historyOrders.billingDate,
        revType: historyOrders.revType,
        matGrpDesc: historyOrders.matGrpDesc
    })
        .from(historyOrders)
        .where(and(
            ilike(historyOrders.matGrpDesc, 'EARTHMOVER TIRES R49'),
            ilike(historyOrders.revType, '%Trading%')
        ))
        .limit(5);

    console.log("SAMPLES:");
    samples.forEach(s => console.log({
        date: `|${s.billingDate}|`,
        rev: `|${s.revType}|`,
        grp: `|${s.matGrpDesc}|`
    }));

    process.exit(0);
}

checkDate();
