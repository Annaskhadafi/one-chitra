import os
base = r"D:/[01] PROJECT/one-chitra"

content = '''"use server"

import { db } from "@/db"
import { customers } from "@/db/schema"
import { salesRevenueSap } from "@/db/schema/sap"
import { sql, notIlike, isNotNull, and } from "drizzle-orm"
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
              AND srs.customer_name NOT ILIKE \'%Chitra Paratama%\'
              AND srs.customer_name NOT ILIKE \'%TRANSITYRE B.V%\'
              AND srs.customer NOT ILIKE \'%ITC008%\'
              AND srs.customer NOT ILIKE \'%1000289A%\'
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

export async function importCustomersFromSAP(customerCodes: string[]): Promise<{ success: true; imported: number; skipped: number } | { success: false; error: string }> {
    try {
        if (!customerCodes.length) return { success: true, imported: 0, skipped: 0 }

        // Fetch the selected customers from SAP
        const rows = await db.execute(sql`
            SELECT DISTINCT
                srs.customer AS customer_code,
                srs.customer_name
            FROM sales_revenue_sap srs
            WHERE srs.customer = ANY(${customerCodes})
              AND srs.customer_name IS NOT NULL
            ORDER BY srs.customer_name
        `)

        const sapRows = rows.rows as Array<{ customer_code: string; customer_name: string }>

        let imported = 0
        let skipped = 0

        for (const row of sapRows) {
            const code = String(row.customer_code || "").trim()
            const name = String(row.customer_name || "").trim()
            if (!code || !name) { skipped++; continue }

            try {
                await db.insert(customers)
                    .values({
                        customerCode: code,
                        name: name,
                    })
                    .onConflictDoNothing({ target: customers.customerCode })
                imported++
            } catch {
                skipped++
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
'''

path = os.path.join(base, "app/actions/customer-sap-import.ts")
with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print("written", path)
