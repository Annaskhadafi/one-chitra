"use server"

import { revalidatePath } from "next/cache"
import { desc, eq } from "drizzle-orm"
import { db } from "@/db"
import { logisticsMasterPrices } from "@/db/schema"
import { logisticsMasterPriceSchema } from "@/lib/schemas"
import { getAuthenticatedSession } from "@/lib/rbac"
import { z } from "zod"

type LogisticsMasterPriceInput = z.infer<typeof logisticsMasterPriceSchema>

function isMissingTableError(error: unknown) {
    if (!error || typeof error !== "object") {
        return false
    }

    const maybeCode = "code" in error ? error.code : undefined
    const maybeMessage = "message" in error ? error.message : undefined

    return maybeCode === "42P01" || (
        typeof maybeMessage === "string" &&
        maybeMessage.toLowerCase().includes("logistics_master_prices")
    )
}

function normalizeNullableString(value?: string | null) {
    const trimmed = value?.trim()
    return trimmed ? trimmed : null
}

function normalizeNullableNumber(value?: number | null) {
    return typeof value === "number" && Number.isFinite(value) ? value : null
}

function buildPayload(data: LogisticsMasterPriceInput, userId: string) {
    return {
        fromLocation: data.fromLocation.trim(),
        toLocation: data.toLocation.trim(),
        cost: data.cost.toString(),
        truckType: normalizeNullableString(data.truckType),
        statusTb: normalizeNullableString(data.statusTb),
        ring24: normalizeNullableNumber(data.ring24),
        ring25: normalizeNullableNumber(data.ring25),
        ring29: normalizeNullableNumber(data.ring29),
        ring33: normalizeNullableNumber(data.ring33),
        ring35: normalizeNullableNumber(data.ring35),
        ring49: normalizeNullableNumber(data.ring49),
        ring51: normalizeNullableNumber(data.ring51),
        ring57: normalizeNullableNumber(data.ring57),
        ring63: normalizeNullableNumber(data.ring63),
        productType: normalizeNullableString(data.productType),
        notes: normalizeNullableString(data.notes),
        createdById: userId,
        updatedAt: new Date(),
    }
}

export async function getLogisticsMasterPrices() {
    await getAuthenticatedSession("logistics-costs", "view")

    try {
        return await db.query.logisticsMasterPrices.findMany({
            orderBy: [desc(logisticsMasterPrices.updatedAt), desc(logisticsMasterPrices.id)],
        })
    } catch (error) {
        if (isMissingTableError(error)) {
            console.warn("logistics_master_prices table is not available yet")
            return []
        }

        throw error
    }
}

export async function upsertLogisticsMasterPrice(data: LogisticsMasterPriceInput, id?: number) {
    try {
        const session = await getAuthenticatedSession("logistics-costs", id ? "edit" : "create")
        const parsed = logisticsMasterPriceSchema.parse(data)
        const payload = buildPayload(parsed, session.user.id)

        if (id) {
            await db
                .update(logisticsMasterPrices)
                .set(payload)
                .where(eq(logisticsMasterPrices.id, id))
        } else {
            await db.insert(logisticsMasterPrices).values(payload)
        }

        revalidatePath("/dashboard/logistics-costs/master-price")
        return { success: true }
    } catch (error) {
        console.error("Upsert logistics master price error:", error)
        if (isMissingTableError(error)) {
            return { success: false, error: "Tabel master price delivery belum ada. Jalankan migrasi database terlebih dahulu." }
        }
        return { success: false, error: "Gagal menyimpan master price logistic" }
    }
}

export async function deleteLogisticsMasterPrice(id: number) {
    try {
        await getAuthenticatedSession("logistics-costs", "delete")
        await db.delete(logisticsMasterPrices).where(eq(logisticsMasterPrices.id, id))
        revalidatePath("/dashboard/logistics-costs/master-price")
        return { success: true }
    } catch (error) {
        console.error("Delete logistics master price error:", error)
        if (isMissingTableError(error)) {
            return { success: false, error: "Tabel master price delivery belum ada. Jalankan migrasi database terlebih dahulu." }
        }
        return { success: false, error: "Gagal menghapus master price logistic" }
    }
}

export async function importLogisticsMasterPrices(
    rows: LogisticsMasterPriceInput[],
    mode: "append" | "replace" = "append"
) {
    try {
        const session = await getAuthenticatedSession("logistics-costs", "create")
        const parsedRows = rows.map((row) => logisticsMasterPriceSchema.parse(row))

        await db.transaction(async (tx) => {
            if (mode === "replace") {
                await tx.delete(logisticsMasterPrices)
            }

            if (parsedRows.length > 0) {
                await tx.insert(logisticsMasterPrices).values(
                    parsedRows.map((row) => buildPayload(row, session.user.id))
                )
            }
        })

        revalidatePath("/dashboard/logistics-costs/master-price")
        return { success: true, imported: parsedRows.length }
    } catch (error) {
        console.error("Import logistics master prices error:", error)
        if (isMissingTableError(error)) {
            return { success: false, error: "Tabel master price delivery belum ada. Jalankan migrasi database terlebih dahulu." }
        }
        return { success: false, error: "Gagal import master price logistic" }
    }
}
