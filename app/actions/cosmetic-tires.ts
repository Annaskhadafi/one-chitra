"use server"

import { db } from "@/db"
import { cosmeticTires } from "@/db/schema"
import { getAuthenticatedSession } from "@/lib/rbac"
import { desc, eq, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const cosmeticTireSchema = z.object({
    tyreSize: z.string().trim().max(150).optional().nullable(),
    pattern: z.string().trim().max(150).optional().nullable(),
    serialNumber: z.string().trim().max(150).optional().nullable(),
    month: z.string().trim().max(50).optional().nullable(),
    city: z.string().trim().max(150).optional().nullable(),
    year: z.string().trim().max(50).optional().nullable(),
    materialNumber: z.string().trim().max(150).optional().nullable(),
    description: z.string().trim().optional().nullable(),
})

export type CosmeticTireInput = z.infer<typeof cosmeticTireSchema>

async function ensureCosmeticTiresTable() {
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "cosmetic_tires" (
            "id" serial PRIMARY KEY NOT NULL,
            "tyre_size" varchar(150),
            "pattern" varchar(150),
            "serial_number" varchar(150),
            "month" varchar(50),
            "city" varchar(150),
            "year" varchar(50),
            "material_number" varchar(150),
            "description" text,
            "created_by" text REFERENCES "user"("id"),
            "created_at" timestamp DEFAULT now() NOT NULL,
            "updated_at" timestamp DEFAULT now() NOT NULL
        )
    `)
}

function normalizeInput(data: CosmeticTireInput) {
    const parsed = cosmeticTireSchema.parse(data)
    return {
        tyreSize: parsed.tyreSize || null,
        pattern: parsed.pattern || null,
        serialNumber: parsed.serialNumber || null,
        month: parsed.month || null,
        city: parsed.city || null,
        year: parsed.year || null,
        materialNumber: parsed.materialNumber || null,
        description: parsed.description || null,
    }
}

export async function getCosmeticTires() {
    await getAuthenticatedSession("marketing", "view")
    await ensureCosmeticTiresTable()

    return await db
        .select({
            id: cosmeticTires.id,
            tyreSize: cosmeticTires.tyreSize,
            pattern: cosmeticTires.pattern,
            serialNumber: cosmeticTires.serialNumber,
            month: cosmeticTires.month,
            city: cosmeticTires.city,
            year: cosmeticTires.year,
            materialNumber: cosmeticTires.materialNumber,
            description: cosmeticTires.description,
            createdAt: cosmeticTires.createdAt,
            updatedAt: cosmeticTires.updatedAt,
        })
        .from(cosmeticTires)
        .orderBy(desc(cosmeticTires.createdAt))
}

export async function createCosmeticTire(data: CosmeticTireInput) {
    try {
        const session = await getAuthenticatedSession("marketing", "create")
        await ensureCosmeticTiresTable()
        const values = normalizeInput(data)

        const [created] = await db
            .insert(cosmeticTires)
            .values({
                ...values,
                createdBy: session.user.id,
            })
            .returning()

        revalidatePath("/dashboard/marketing/slow-moving")
        return { success: true, data: created }
    } catch (error) {
        console.error("Create cosmetic tire error:", error)
        return { success: false, error: "Gagal menambah cosmetic tire" }
    }
}

export async function importCosmeticTires(data: CosmeticTireInput[]) {
    try {
        const session = await getAuthenticatedSession("marketing", "create")
        await ensureCosmeticTiresTable()

        const values = z.array(cosmeticTireSchema).parse(data)
            .map(normalizeInput)
            .filter((item) =>
                Boolean(
                    item.tyreSize ||
                    item.pattern ||
                    item.serialNumber ||
                    item.month ||
                    item.city ||
                    item.year ||
                    item.materialNumber ||
                    item.description
                )
            )

        if (values.length === 0) {
            return { success: false, error: "Tidak ada data valid untuk diimport" }
        }

        const createdRows = await db
            .insert(cosmeticTires)
            .values(values.map((item) => ({
                ...item,
                createdBy: session.user.id,
            })))
            .returning()

        revalidatePath("/dashboard/marketing/slow-moving")
        return { success: true, data: createdRows, count: createdRows.length }
    } catch (error) {
        console.error("Import cosmetic tires error:", error)
        return { success: false, error: "Gagal import cosmetic tire" }
    }
}

export async function updateCosmeticTire(id: number, data: CosmeticTireInput) {
    try {
        await getAuthenticatedSession("marketing", "edit")
        await ensureCosmeticTiresTable()
        const values = normalizeInput(data)

        const [updated] = await db
            .update(cosmeticTires)
            .set({
                ...values,
                updatedAt: new Date(),
            })
            .where(eq(cosmeticTires.id, id))
            .returning()

        revalidatePath("/dashboard/marketing/slow-moving")
        return { success: true, data: updated }
    } catch (error) {
        console.error("Update cosmetic tire error:", error)
        return { success: false, error: "Gagal mengubah cosmetic tire" }
    }
}

export async function deleteCosmeticTire(id: number) {
    try {
        await getAuthenticatedSession("marketing", "delete")
        await ensureCosmeticTiresTable()

        await db.delete(cosmeticTires).where(eq(cosmeticTires.id, id))

        revalidatePath("/dashboard/marketing/slow-moving")
        return { success: true }
    } catch (error) {
        console.error("Delete cosmetic tire error:", error)
        return { success: false, error: "Gagal menghapus cosmetic tire" }
    }
}
