import { sql } from "drizzle-orm"

import { salesRevenueSap } from "@/db/schema/sap"

export const salesRevenueQtyExcludedCondition = sql`
    NULLIF(BTRIM(COALESCE(${salesRevenueSap.c}, '')), '') IS NOT NULL
    OR NULLIF(BTRIM(COALESCE(${salesRevenueSap.cancelled}, '')), '') IS NOT NULL
`

export const salesRevenueCountableQty = sql<number>`
    CASE
        WHEN ${salesRevenueQtyExcludedCondition} THEN 0
        ELSE COALESCE(${salesRevenueSap.qty}, 0)
    END
`
