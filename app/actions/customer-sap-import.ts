"use server"

import { db } from "@/db"
import { customers } from "@/db/schema"
import { salesRevenueSap } from "@/db/schema/sap"
import { sql, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export interface SAPCustomerPreview {
    customerCode: string
    customerName: string
    alreadyExists: boolean
}

export async function getSAPCustomersNotInDB(): Promise<{ success: true; data: SAPCustomerPreview[] } | { success: false; error: string }> {
    try {
        const rows = await db.execute(sql`
            SELECT DISTINCT
                srs.customer AS customer_code,
                srs.customer_name
            FROM sales_revenue_sap srs
            LEFT JOIN customers c ON UPPER(TRIM(c.name)) = UPPER(TRIM(srs.customer_name))
            WHERE srs.customer_name IS NOT NULL
              AND srs.customer IS NOT NULL
              AND srs.customer_name NOT ILIKE '%Chitra Paratama%'
              AND srs.customer_name NOT ILIKE '%TRANSITYRE B.V%'
              AND srs.customer NOT ILIKE '%ITC008%'
              AND srs.customer NOT ILIKE '%1000289A%'
              AND c.id IS NULL
            ORDER BY srs.customer_name
        `)

        const data: SAPCustomerPreview[] = (rows.rows as any[]).map((r) => ({
            customerCode: String(r.customer_code || "").trim(),
            customerName: String(r.customer_name || "").trim(),
            alreadyExists: false,
        }))

        return { success: true, data }
    } catch (err) {
        console.error("[getSAPCustomersNotInDB]", err)
        return { success: false, error: "Failed to fetch SAP customers" }
    }
}

export async function importCustomersFromSAP(
    customerCodes: string[]
): Promise<{ success: true; imported: number; skipped: number } | { success: false; error: string }> {
    try {
        if (!customerCodes.length) return { success: true, imported: 0, skipped: 0 }

        // Fetch selected customers from SAP using drizzle inArray
        const sapRows = await db
            .selectDistinct({
                customerCode: salesRevenueSap.customer,
                customerName: salesRevenueSap.customerName,
            })
            .from(salesRevenueSap)
            .where(
                inArray(salesRevenueSap.customer, customerCodes)
            )

        let imported = 0
        let skipped = 0

        // Batch insert in chunks of 100
        const CHUNK = 100
        const validRows = sapRows.filter((r) => r.customerCode && r.customerName)

        for (let i = 0; i < validRows.length; i += CHUNK) {
            const chunk = validRows.slice(i, i + CHUNK)
            try {
                await db
                    .insert(customers)
                    .values(
                        chunk.map((r) => ({
                            customerCode: String(r.customerCode!).trim(),
                            name: String(r.customerName!).trim(),
                        }))
                    )
                    .onConflictDoNothing({ target: customers.customerCode })
                imported += chunk.length
            } catch (err) {
                console.error("[importCustomersFromSAP] chunk error:", err)
                skipped += chunk.length
            }
        }

        revalidatePath("/dashboard/customers")
        revalidatePath("/dashboard/customer-industry")
        return { success: true, imported, skipped }
    } catch (err) {
        console.error("[importCustomersFromSAP]", err)
        return { success: false, error: "Failed to import customers from SAP" }
    }
}
