import { db } from "../db";
import { historyOrders } from "../db/schema/history-orders";
import { ilike, sql, and } from "drizzle-orm";

async function checkCombined() {
    console.log("--- START FILTER CHECK ---");

    const result = await db.select({
        count: sql<number>`count(*)`
    })
        .from(historyOrders)
        .where(and(
            ilike(historyOrders.matGrpDesc, 'EARTHMOVER TIRES R49'),
            ilike(historyOrders.revType, '%Trading%')
        ));

    console.log(`TOTAL_MATCHING_RECORDS: ${result[0].count}`);

    const revTypesRaw = await db.selectDistinct({ v: historyOrders.revType })
        .from(historyOrders)
        .where(ilike(historyOrders.matGrpDesc, 'EARTHMOVER TIRES R49'));

    console.log("REV_TYPES_FOR_R49:");
    revTypesRaw.forEach(r => console.log(`|${r.v}|`));

    console.log("--- END FILTER CHECK ---");
    process.exit(0);
}

checkCombined();
