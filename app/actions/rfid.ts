"use server"

import { db } from "@/db"
import { rfidScans } from "@/db/schema"
import { getAuthenticatedSession } from "@/lib/rbac"
import { eq, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const rfidScanFormSchema = z.object({
    tagId: z.string().trim().min(1, "Tag ID wajib diisi"),
    serialNumber: z.string().trim().optional(),
    epc: z.string().trim().optional(),
    rssi: z.string().trim().optional(),
    linked: z.boolean().default(false),
    plant: z.string().trim().optional(),
    category: z.string().trim().optional(),
    materialNumber: z.string().trim().optional(),
    materialDescription: z.string().trim().optional(),
    sloc: z.string().trim().optional(),
    slocDescription: z.string().trim().optional(),
    actStock: z.coerce.number().int().optional().nullable(),
    createdBy: z.string().trim().optional(),
    scanType: z.string().trim().optional(),
})

export type RfidScanFormInput = z.infer<typeof rfidScanFormSchema>

export async function createRfidScanAction(data: RfidScanFormInput) {
    try {
        const session = await getAuthenticatedSession("rfid", "create")
        const parsed = rfidScanFormSchema.parse(data)

        const userName = session.user.name || session.user.email || "System"

        const [created] = await db.insert(rfidScans).values({
            tagId: parsed.tagId,
            serialNumber: parsed.serialNumber || null,
            epc: parsed.epc || parsed.tagId,
            rssi: parsed.rssi || null,
            linked: parsed.linked ?? false,
            plant: parsed.plant || null,
            category: parsed.category || null,
            materialNumber: parsed.materialNumber || null,
            materialDescription: parsed.materialDescription || null,
            sloc: parsed.sloc || null,
            slocDescription: parsed.slocDescription || null,
            actStock: parsed.actStock ?? null,
            createdBy: parsed.createdBy || userName,
            scanType: parsed.scanType || "INBOUND",
            userId: session.user.id,
            scannedAt: new Date(),
        }).returning()

        revalidatePath("/dashboard/rfid")
        return { success: true, data: created }
    } catch (error) {
        console.error("Gagal menambah RFID scan:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Gagal menambahkan data RFID",
        }
    }
}

export async function updateRfidScanAction(id: number, data: Partial<RfidScanFormInput>) {
    try {
        await getAuthenticatedSession("rfid", "edit")

        const existing = await db.query.rfidScans.findFirst({
            where: eq(rfidScans.id, id),
        })

        if (!existing) {
            return { success: false, error: "Data RFID tidak ditemukan" }
        }

        const parsed = rfidScanFormSchema.partial().parse(data)

        const [updated] = await db.update(rfidScans)
            .set({
                tagId: parsed.tagId ?? existing.tagId,
                serialNumber: parsed.serialNumber !== undefined ? (parsed.serialNumber || null) : existing.serialNumber,
                epc: parsed.epc !== undefined ? (parsed.epc || existing.epc) : existing.epc,
                rssi: parsed.rssi !== undefined ? (parsed.rssi || null) : existing.rssi,
                linked: parsed.linked !== undefined ? parsed.linked : existing.linked,
                plant: parsed.plant !== undefined ? (parsed.plant || null) : existing.plant,
                category: parsed.category !== undefined ? (parsed.category || null) : existing.category,
                materialNumber: parsed.materialNumber !== undefined ? (parsed.materialNumber || null) : existing.materialNumber,
                materialDescription: parsed.materialDescription !== undefined ? (parsed.materialDescription || null) : existing.materialDescription,
                sloc: parsed.sloc !== undefined ? (parsed.sloc || null) : existing.sloc,
                slocDescription: parsed.slocDescription !== undefined ? (parsed.slocDescription || null) : existing.slocDescription,
                actStock: parsed.actStock !== undefined ? parsed.actStock : existing.actStock,
                createdBy: parsed.createdBy !== undefined ? (parsed.createdBy || null) : existing.createdBy,
                scanType: parsed.scanType !== undefined ? (parsed.scanType || "INBOUND") : existing.scanType,
            })
            .where(eq(rfidScans.id, id))
            .returning()

        revalidatePath("/dashboard/rfid")
        return { success: true, data: updated }
    } catch (error) {
        console.error("Gagal memperbarui RFID scan:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Gagal memperbarui data RFID",
        }
    }
}

export async function updateRfidScanTypeAction(id: number, status: "Masuk" | "Keluar") {
    try {
        await getAuthenticatedSession("rfid", "edit")

        const dbScanType = status === "Keluar" ? "OUTBOUND" : "INBOUND"

        const [updated] = await db.update(rfidScans)
            .set({ scanType: dbScanType })
            .where(eq(rfidScans.id, id))
            .returning()

        revalidatePath("/dashboard/rfid")
        return { success: true, data: updated }
    } catch (error) {
        console.error("Gagal mengubah status scan RFID:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Gagal mengubah status scan RFID",
        }
    }
}

export async function toggleRfidStatusAction(id: number, linked: boolean) {
    try {
        await getAuthenticatedSession("rfid", "edit")

        const [updated] = await db.update(rfidScans)
            .set({ linked })
            .where(eq(rfidScans.id, id))
            .returning()

        revalidatePath("/dashboard/rfid")
        return { success: true, data: updated }
    } catch (error) {
        console.error("Gagal mengubah status RFID scan:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Gagal mengubah status RFID",
        }
    }
}

export async function deleteRfidScanAction(id: number) {
    try {
        await getAuthenticatedSession("rfid", "delete")

        const [deleted] = await db.delete(rfidScans)
            .where(eq(rfidScans.id, id))
            .returning()

        if (!deleted) {
            return { success: false, error: "Data RFID tidak ditemukan" }
        }

        revalidatePath("/dashboard/rfid")
        return { success: true, id: deleted.id }
    } catch (error) {
        console.error("Gagal menghapus RFID scan:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Gagal menghapus data RFID",
        }
    }
}

export async function bulkDeleteRfidScansAction(ids: number[]) {
    try {
        if (!ids || ids.length === 0) {
            return { success: false, error: "Tidak ada data RFID yang dipilih untuk dihapus" }
        }

        await getAuthenticatedSession("rfid", "delete")

        const deletedRows = await db.delete(rfidScans)
            .where(inArray(rfidScans.id, ids))
            .returning()

        revalidatePath("/dashboard/rfid")
        return { success: true, count: deletedRows.length }
    } catch (error) {
        console.error("Gagal menghapus data RFID massal:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Gagal menghapus data RFID massal",
        }
    }
}

export async function getAvailableKeluarRfidScansAction(query?: { materialNumber?: string; materialDescription?: string } | string) {
    try {
        const { getAvailableKeluarRfidScans } = await import("@/lib/rfid")
        const rows = await getAvailableKeluarRfidScans(query)
        return { success: true, data: rows }
    } catch (error) {
        console.error("Gagal mengambil data RFID keluar:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Gagal mengambil data RFID keluar",
            data: [],
        }
    }
}

export async function linkRfidScansToDeliveryAction(doNumber: string, serialNumbers: string[]) {
    try {
        const { linkRfidScansToDelivery } = await import("@/lib/rfid")
        const updated = await linkRfidScansToDelivery(doNumber, serialNumbers)
        revalidatePath("/dashboard/rfid")
        return { success: true, count: updated.length }
    } catch (error) {
        console.error("Gagal menghubungkan RFID ke DO:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Gagal menghubungkan RFID ke DO",
        }
    }
}

