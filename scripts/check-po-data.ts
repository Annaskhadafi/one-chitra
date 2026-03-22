import { db } from "../db";
import { salesRevenueSap } from "../db/schema/sap";
import { isNull, isNotNull, ne, gte, eq, count, or, asc, and } from "drizzle-orm";

async function main() {
    console.log("Checking PO Numbers via Drizzle...");

    // Total 2026 data
    const total2026 = await db.select({ value: count() })
        .from(salesRevenueSap)
        .where(gte(salesRevenueSap.billingDate, '2026-01-01'));
    console.log("Total 2026 data:", total2026[0].value);

    // 2026 data WITH PO NO
    const withPo = await db.select({ value: count() })
        .from(salesRevenueSap)
        .where(
            and(
                gte(salesRevenueSap.billingDate, '2026-01-01'),
                isNotNull(salesRevenueSap.poNo),
                ne(salesRevenueSap.poNo, '')
            )
        );
    console.log("2026 data WITH PO:", withPo[0].value);

    process.exit(0);
}
main();
