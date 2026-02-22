"use server"

import { db } from "@/db"
import { stockLevels } from "@/db/schema"
import { gt, and, lte, sql } from "drizzle-orm"
import type { ReorderAlert } from "@/lib/types"

/**
 * Returns all stock entries below their minimum stock level.
 * urgency: 'critical' = stock is 0, 'warning' = stock < min, 'ok' = fine (filtered out)
 */
export async function getReorderAlerts(): Promise<ReorderAlert[]> {
    const rows = await db.query.stockLevels.findMany({
        where: and(
            gt(stockLevels.minStock, 0),
            lte(stockLevels.totalStock, stockLevels.minStock)
        ),
        with: {
            product: true,
            warehouse: true,
        },
        orderBy: (sl, { asc }) => [asc(sl.totalStock)],
    })

    // Filter only rows where product and warehouse exist, add urgency label
    const alerts: ReorderAlert[] = rows
        .filter((r) => r.product && r.warehouse)
        .map((r) => ({
            ...r,
            product: r.product!,
            warehouse: r.warehouse!,
            urgency: r.totalStock === 0 ? "critical" : "warning",
        })) as ReorderAlert[]

    return alerts
}

/**
 * Summary stats for the alert dashboard card.
 */
export async function getReorderAlertSummary() {
    const alerts = await getReorderAlerts()
    const critical = alerts.filter((a) => a.urgency === "critical").length
    const warning = alerts.filter((a) => a.urgency === "warning").length
    return { total: alerts.length, critical, warning }
}
