import { db } from "../db";
import { salesRevenueSap as historyOrders } from "../db/schema/sap";
import { ilike, sql, and, or } from "drizzle-orm";

async function inspectR49() {
    console.log("Inspecting R49 data...");

    // 1. Search for R49
    const samples = await db.select({
        matGrpDesc: historyOrders.matGrpDesc,
        materialDescription: historyOrders.materialDescription,
        revType: historyOrders.revType,
    })
        .from(historyOrders)
        .where(or(
            ilike(historyOrders.matGrpDesc, '%R49%'),
            ilike(historyOrders.materialDescription, '%R49%')
        ))
        .limit(10);

    console.log("\nRaw R49 Samples:");
    samples.forEach(s => {
        console.log({
            matGrpDesc: `|${s.matGrpDesc}|`,
            materialDescription: `|${s.materialDescription}|`,
            revType: `|${s.revType}|`
        });
    });

    // 2. Count by matGrpDesc for R49
    const counts = await db.select({
        matGrpDesc: historyOrders.matGrpDesc,
        count: sql<number>`count(*)`
    })
        .from(historyOrders)
        .where(ilike(historyOrders.matGrpDesc, '%R49%'))
        .groupBy(historyOrders.matGrpDesc);

    console.log("\nCounts for matGrpDesc containing 'R49':");
    console.table(counts);

    process.exit(0);
}

inspectR49();
