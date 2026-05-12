"use server"

import { db } from "@/db"
import { tirePerformanceRecords } from "@/db/schema"
import { getAuthenticatedSession } from "@/lib/rbac"
import { hasTirePerformanceContent, type TirePerformanceType } from "@/lib/tire-performance"
import { and, desc, eq, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const tirePerformanceTypeSchema = z.enum(["running", "scrap"])

const tirePerformanceSchema = z.object({
    type: tirePerformanceTypeSchema,
    performanceDate: z.string().trim().max(100).optional().nullable(),
    endUser: z.string().trim().max(150).optional().nullable(),
    mineSite: z.string().trim().max(150).optional().nullable(),
    manufacture: z.string().trim().max(150).optional().nullable(),
    specification: z.string().trim().optional().nullable(),
    avgHours: z.union([z.string(), z.number()]).optional().nullable(),
    recordCount: z.union([z.string(), z.number()]).optional().nullable(),
    remarks: z.string().trim().optional().nullable(),
})

export type TirePerformanceActionInput = z.infer<typeof tirePerformanceSchema>

async function ensureTirePerformanceTable() {
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "tire_performance_records" (
            "id" serial PRIMARY KEY NOT NULL,
            "type" varchar(20) NOT NULL,
            "performance_date" varchar(100) NOT NULL,
            "end_user" varchar(150) NOT NULL,
            "mine_site" varchar(150) NOT NULL,
            "manufacture" varchar(150) NOT NULL,
            "specification" text NOT NULL,
            "avg_hours" numeric(14, 2) DEFAULT '0' NOT NULL,
            "record_count" integer DEFAULT 0 NOT NULL,
            "remarks" text,
            "created_by" text REFERENCES "user"("id"),
            "created_at" timestamp DEFAULT now() NOT NULL,
            "updated_at" timestamp DEFAULT now() NOT NULL
        )
    `)
}

function normalizeNumeric(value: unknown) {
    const raw = String(value ?? "")
        .trim()
        .replace(/\s/g, "")
        .replace(/,/g, "")
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : 0
}

function normalizeInput(data: TirePerformanceActionInput) {
    const parsed = tirePerformanceSchema.parse(data)
    return {
        type: parsed.type,
        performanceDate: parsed.performanceDate || "",
        endUser: parsed.endUser || "",
        mineSite: parsed.mineSite || "",
        manufacture: parsed.manufacture || "",
        specification: parsed.specification || "",
        avgHours: normalizeNumeric(parsed.avgHours).toFixed(2),
        recordCount: Math.max(0, Math.round(normalizeNumeric(parsed.recordCount))),
        remarks: parsed.remarks || null,
    }
}

export async function getTirePerformanceRecords(type?: TirePerformanceType) {
    await getAuthenticatedSession("sales-dashboard", "view")
    await ensureTirePerformanceTable()

    const baseQuery = db
        .select({
            id: tirePerformanceRecords.id,
            type: tirePerformanceRecords.type,
            performanceDate: tirePerformanceRecords.performanceDate,
            endUser: tirePerformanceRecords.endUser,
            mineSite: tirePerformanceRecords.mineSite,
            manufacture: tirePerformanceRecords.manufacture,
            specification: tirePerformanceRecords.specification,
            avgHours: tirePerformanceRecords.avgHours,
            recordCount: tirePerformanceRecords.recordCount,
            remarks: tirePerformanceRecords.remarks,
            createdAt: tirePerformanceRecords.createdAt,
            updatedAt: tirePerformanceRecords.updatedAt,
        })
        .from(tirePerformanceRecords)

    if (type) {
        return await baseQuery
            .where(eq(tirePerformanceRecords.type, type))
            .orderBy(desc(tirePerformanceRecords.createdAt))
    }

    return await baseQuery.orderBy(desc(tirePerformanceRecords.createdAt))
}

export async function createTirePerformanceRecord(data: TirePerformanceActionInput) {
    try {
        const session = await getAuthenticatedSession("sales-dashboard", "create")
        await ensureTirePerformanceTable()
        const values = normalizeInput(data)

        const [created] = await db
            .insert(tirePerformanceRecords)
            .values({
                ...values,
                createdBy: session.user.id,
            })
            .returning()

        revalidatePath("/dashboard/tire-performance")
        return { success: true, data: created }
    } catch (error) {
        console.error("Create tire performance error:", error)
        return { success: false, error: "Gagal menambah tire performance" }
    }
}

export async function importTirePerformanceRecords(data: TirePerformanceActionInput[]) {
    try {
        const session = await getAuthenticatedSession("sales-dashboard", "create")
        await ensureTirePerformanceTable()

        const values = z.array(tirePerformanceSchema).parse(data)
            .map(normalizeInput)
            .filter((item) => hasTirePerformanceContent({ ...item, remarks: item.remarks || "" }))

        if (values.length === 0) {
            return { success: false, error: "Tidak ada data valid untuk diimport" }
        }

        const createdRows = await db
            .insert(tirePerformanceRecords)
            .values(values.map((item) => ({
                ...item,
                createdBy: session.user.id,
            })))
            .returning()

        revalidatePath("/dashboard/tire-performance")
        return { success: true, data: createdRows, count: createdRows.length }
    } catch (error) {
        console.error("Import tire performance error:", error)
        return { success: false, error: "Gagal import tire performance" }
    }
}

export async function updateTirePerformanceRecord(id: number, data: TirePerformanceActionInput) {
    try {
        await getAuthenticatedSession("sales-dashboard", "edit")
        await ensureTirePerformanceTable()
        const values = normalizeInput(data)

        const [updated] = await db
            .update(tirePerformanceRecords)
            .set({
                ...values,
                updatedAt: new Date(),
            })
            .where(and(eq(tirePerformanceRecords.id, id), eq(tirePerformanceRecords.type, values.type)))
            .returning()

        revalidatePath("/dashboard/tire-performance")
        return { success: true, data: updated }
    } catch (error) {
        console.error("Update tire performance error:", error)
        return { success: false, error: "Gagal mengubah tire performance" }
    }
}

export async function deleteTirePerformanceRecord(id: number) {
    try {
        await getAuthenticatedSession("sales-dashboard", "delete")
        await ensureTirePerformanceTable()

        await db.delete(tirePerformanceRecords).where(eq(tirePerformanceRecords.id, id))

        revalidatePath("/dashboard/tire-performance")
        return { success: true }
    } catch (error) {
        console.error("Delete tire performance error:", error)
        return { success: false, error: "Gagal menghapus tire performance" }
    }
}
