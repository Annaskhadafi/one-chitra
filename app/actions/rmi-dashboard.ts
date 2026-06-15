"use server"

import { db } from "@/db"
import { rmiRecords, quarterlyExchangeRates } from "@/db/schema"
import { getAuthenticatedSession } from "@/lib/rbac"
import { getRealtimeExchangeRate } from "./settings"
import { and, desc, eq, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const rmiRecordSchema = z.object({
    year: z.number().int().min(2000).max(2100),
    quarter: z.number().int().min(1).max(4),
    naturalRubber: z.number().min(0),
    syntheticRubber: z.number().min(0),
    carbonBlack: z.number().min(0),
    steelCord: z.number().min(0),
    remarks: z.string().optional().nullable(),
})

const quarterlyRateSchema = z.object({
    year: z.number().int().min(2000).max(2100),
    quarter: z.number().int().min(1).max(4),
    averageRate: z.number().min(0),
    rateMonth1: z.number().min(0).optional().default(0),
    rateMonth2: z.number().min(0).optional().default(0),
    rateMonth3: z.number().min(0).optional().default(0),
    remarks: z.string().optional().nullable(),
})

export type RmiRecordInput = z.infer<typeof rmiRecordSchema>
export type QuarterlyRateInput = z.infer<typeof quarterlyRateSchema>

async function ensureRmiTables() {
    // Memastikan tabel rmi_records ada
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "rmi_records" (
            "id" serial PRIMARY KEY NOT NULL,
            "year" integer NOT NULL,
            "quarter" integer NOT NULL,
            "natural_rubber" numeric(14, 4) DEFAULT '0' NOT NULL,
            "synthetic_rubber" numeric(14, 4) DEFAULT '0' NOT NULL,
            "carbon_black" numeric(14, 4) DEFAULT '0' NOT NULL,
            "steel_cord" numeric(14, 4) DEFAULT '0' NOT NULL,
            "rmi_value" numeric(14, 4) DEFAULT '0' NOT NULL,
            "remarks" text,
            "created_by" text,
            "created_at" timestamp DEFAULT now() NOT NULL,
            "updated_at" timestamp DEFAULT now() NOT NULL
        )
    `)

    // Memastikan tabel quarterly_exchange_rates ada
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "quarterly_exchange_rates" (
            "id" serial PRIMARY KEY NOT NULL,
            "year" integer NOT NULL,
            "quarter" integer NOT NULL,
            "average_rate" numeric(14, 2) DEFAULT '0' NOT NULL,
            "rate_month_1" numeric(14, 2) DEFAULT '0' NOT NULL,
            "rate_month_2" numeric(14, 2) DEFAULT '0' NOT NULL,
            "rate_month_3" numeric(14, 2) DEFAULT '0' NOT NULL,
            "remarks" text,
            "created_by" text,
            "created_at" timestamp DEFAULT now() NOT NULL,
            "updated_at" timestamp DEFAULT now() NOT NULL
        )
    `)

    // Tambahkan kolom jika tabel sudah ada tapi belum bermigrasi
    await db.execute(sql`
        ALTER TABLE "quarterly_exchange_rates" 
        ADD COLUMN IF NOT EXISTS "rate_month_1" numeric(14, 2) DEFAULT '0' NOT NULL,
        ADD COLUMN IF NOT EXISTS "rate_month_2" numeric(14, 2) DEFAULT '0' NOT NULL,
        ADD COLUMN IF NOT EXISTS "rate_month_3" numeric(14, 2) DEFAULT '0' NOT NULL;
    `)
}

// Menghitung nilai RMI berdasarkan formula bobot default:
// Natural Rubber (35%), Synthetic Rubber (25%), Carbon Black (20%), Steel Cord (20%)
function calculateRmiValue(nr: number, sr: number, cb: number, sc: number): number {
    return (nr * 0.35) + (sr * 0.25) + (cb * 0.20) + (sc * 0.20)
}

// -------------------------------------------------------------
// EXCHANGE RATE DEPENDENCIES
// -------------------------------------------------------------
export async function getExchangeRateDependencies() {
    try {
        const result = await getRealtimeExchangeRate()
        if (result.success && result.rate) {
            return { success: true, rate: result.rate }
        }
        // Fallback ke nilai contoh di gambar jika API bermasalah
        return { success: true, rate: 17981, isFallback: true }
    } catch (error) {
        console.error("Error fetching exchange rate dependency:", error)
        return { success: true, rate: 17981, isFallback: true }
    }
}

// -------------------------------------------------------------
// RMI RECORDS ACTIONS
// -------------------------------------------------------------
export async function getRmiRecords() {
    try {
        await getAuthenticatedSession("rmi-dashboard", "view")
        await ensureRmiTables()

        const data = await db
            .select()
            .from(rmiRecords)
            .orderBy(desc(rmiRecords.year), desc(rmiRecords.quarter))

        return { success: true, data }
    } catch (error) {
        console.error("Error fetching RMI records:", error)
        return { success: false, error: "Gagal memuat data RMI" }
    }
}

export async function createRmiRecord(data: RmiRecordInput) {
    try {
        const session = await getAuthenticatedSession("rmi-dashboard", "create")
        await ensureRmiTables()
        const parsed = rmiRecordSchema.parse(data)

        // Cek duplikasi year & quarter
        const existing = await db
            .select()
            .from(rmiRecords)
            .where(and(eq(rmiRecords.year, parsed.year), eq(rmiRecords.quarter, parsed.quarter)))
            .limit(1)

        if (existing.length > 0) {
            return { success: false, error: `Data untuk Tahun ${parsed.year} Q${parsed.quarter} sudah ada.` }
        }

        const rmiValue = calculateRmiValue(
            parsed.naturalRubber,
            parsed.syntheticRubber,
            parsed.carbonBlack,
            parsed.steelCord
        )

        const [created] = await db
            .insert(rmiRecords)
            .values({
                year: parsed.year,
                quarter: parsed.quarter,
                naturalRubber: parsed.naturalRubber.toString(),
                syntheticRubber: parsed.syntheticRubber.toString(),
                carbonBlack: parsed.carbonBlack.toString(),
                steelCord: parsed.steelCord.toString(),
                rmiValue: rmiValue.toString(),
                remarks: parsed.remarks,
                createdBy: session.user.id,
            })
            .returning()

        revalidatePath("/dashboard/rmi")
        return { success: true, data: created }
    } catch (error) {
        console.error("Error creating RMI record:", error)
        return { success: false, error: "Gagal menambahkan data RMI" }
    }
}

export async function updateRmiRecord(id: number, data: RmiRecordInput) {
    try {
        const session = await getAuthenticatedSession("rmi-dashboard", "edit")
        await ensureRmiTables()
        const parsed = rmiRecordSchema.parse(data)

        // Cek duplikasi data lain dengan year & quarter yang sama
        const existing = await db
            .select()
            .from(rmiRecords)
            .where(and(
                eq(rmiRecords.year, parsed.year),
                eq(rmiRecords.quarter, parsed.quarter),
                sql`${rmiRecords.id} <> ${id}`
            ))
            .limit(1)

        if (existing.length > 0) {
            return { success: false, error: `Tahun ${parsed.year} Q${parsed.quarter} sudah digunakan di record lain.` }
        }

        const rmiValue = calculateRmiValue(
            parsed.naturalRubber,
            parsed.syntheticRubber,
            parsed.carbonBlack,
            parsed.steelCord
        )

        const [updated] = await db
            .update(rmiRecords)
            .set({
                year: parsed.year,
                quarter: parsed.quarter,
                naturalRubber: parsed.naturalRubber.toString(),
                syntheticRubber: parsed.syntheticRubber.toString(),
                carbonBlack: parsed.carbonBlack.toString(),
                steelCord: parsed.steelCord.toString(),
                rmiValue: rmiValue.toString(),
                remarks: parsed.remarks,
                updatedAt: new Date(),
            })
            .where(eq(rmiRecords.id, id))
            .returning()

        revalidatePath("/dashboard/rmi")
        return { success: true, data: updated }
    } catch (error) {
        console.error("Error updating RMI record:", error)
        return { success: false, error: "Gagal memperbarui data RMI" }
    }
}

export async function deleteRmiRecord(id: number) {
    try {
        await getAuthenticatedSession("rmi-dashboard", "delete")
        await ensureRmiTables()

        await db.delete(rmiRecords).where(eq(rmiRecords.id, id))

        revalidatePath("/dashboard/rmi")
        return { success: true }
    } catch (error) {
        console.error("Error deleting RMI record:", error)
        return { success: false, error: "Gagal menghapus data RMI" }
    }
}

// -------------------------------------------------------------
// QUARTERLY RATES ACTIONS
// -------------------------------------------------------------
export async function getQuarterlyExchangeRates() {
    try {
        await getAuthenticatedSession("rmi-dashboard", "view")
        await ensureRmiTables()

        const data = await db
            .select()
            .from(quarterlyExchangeRates)
            .orderBy(desc(quarterlyExchangeRates.year), desc(quarterlyExchangeRates.quarter))

        return { success: true, data }
    } catch (error) {
        console.error("Error fetching quarterly exchange rates:", error)
        return { success: false, error: "Gagal memuat data Kurs Quarterly" }
    }
}

export async function createQuarterlyRate(data: QuarterlyRateInput) {
    try {
        const session = await getAuthenticatedSession("rmi-dashboard", "create")
        await ensureRmiTables()
        const parsed = quarterlyRateSchema.parse(data)

        // Cek duplikasi
        const existing = await db
            .select()
            .from(quarterlyExchangeRates)
            .where(and(eq(quarterlyExchangeRates.year, parsed.year), eq(quarterlyExchangeRates.quarter, parsed.quarter)))
            .limit(1)

        if (existing.length > 0) {
            return { success: false, error: `Data Kurs untuk Tahun ${parsed.year} Q${parsed.quarter} sudah ada.` }
        }

        const [created] = await db
            .insert(quarterlyExchangeRates)
            .values({
                year: parsed.year,
                quarter: parsed.quarter,
                averageRate: parsed.averageRate.toString(),
                rateMonth1: (parsed.rateMonth1 ?? 0).toString(),
                rateMonth2: (parsed.rateMonth2 ?? 0).toString(),
                rateMonth3: (parsed.rateMonth3 ?? 0).toString(),
                remarks: parsed.remarks,
                createdBy: session.user.id,
            })
            .returning()

        revalidatePath("/dashboard/rmi")
        return { success: true, data: created }
    } catch (error) {
        console.error("Error creating quarterly exchange rate:", error)
        return { success: false, error: "Gagal menambahkan data Kurs" }
    }
}

export async function updateQuarterlyRate(id: number, data: QuarterlyRateInput) {
    try {
        const session = await getAuthenticatedSession("rmi-dashboard", "edit")
        await ensureRmiTables()
        const parsed = quarterlyRateSchema.parse(data)

        // Cek duplikasi lain
        const existing = await db
            .select()
            .from(quarterlyExchangeRates)
            .where(and(
                eq(quarterlyExchangeRates.year, parsed.year),
                eq(quarterlyExchangeRates.quarter, parsed.quarter),
                sql`${quarterlyExchangeRates.id} <> ${id}`
            ))
            .limit(1)

        if (existing.length > 0) {
            return { success: false, error: `Tahun ${parsed.year} Q${parsed.quarter} sudah digunakan di data Kurs lain.` }
        }

        const [updated] = await db
            .update(quarterlyExchangeRates)
            .set({
                year: parsed.year,
                quarter: parsed.quarter,
                averageRate: parsed.averageRate.toString(),
                rateMonth1: (parsed.rateMonth1 ?? 0).toString(),
                rateMonth2: (parsed.rateMonth2 ?? 0).toString(),
                rateMonth3: (parsed.rateMonth3 ?? 0).toString(),
                remarks: parsed.remarks,
                updatedAt: new Date(),
            })
            .where(eq(quarterlyExchangeRates.id, id))
            .returning()

        revalidatePath("/dashboard/rmi")
        return { success: true, data: updated }
    } catch (error) {
        console.error("Error updating quarterly exchange rate:", error)
        return { success: false, error: "Gagal memperbarui data Kurs" }
    }
}

export async function deleteQuarterlyRate(id: number) {
    try {
        await getAuthenticatedSession("rmi-dashboard", "delete")
        await ensureRmiTables()

        await db.delete(quarterlyExchangeRates).where(eq(quarterlyExchangeRates.id, id))

        revalidatePath("/dashboard/rmi")
        return { success: true }
    } catch (error) {
        console.error("Error deleting quarterly exchange rate:", error)
        return { success: false, error: "Gagal menghapus data Kurs" }
    }
}

// -------------------------------------------------------------
// SEEDING DEFAULT HISTORICAL DATA (Jika Database Kosong)
// -------------------------------------------------------------
export async function seedRmiDashboardDefaults() {
    try {
        await ensureRmiTables()

        const rmiCount = await db.select({ count: sql`count(*)` }).from(rmiRecords)
        const rateCount = await db.select({ count: sql`count(*)` }).from(quarterlyExchangeRates)

        const rmiCountVal = Number(rmiCount[0]?.count || 0)
        const rateCountVal = Number(rateCount[0]?.count || 0)

        // Seed data jika kosong
        if (rmiCountVal === 0) {
            const defaultRmi = [
                { year: 2026, quarter: 2, naturalRubber: 2.25, syntheticRubber: 1.95, carbonBlack: 1.40, steelCord: 1.20, rmiValue: 1.795, remarks: "Q2 2026 Index (Quarter Berjalan)" },
                { year: 2026, quarter: 1, naturalRubber: 2.15, syntheticRubber: 1.85, carbonBlack: 1.35, steelCord: 1.15, rmiValue: 1.745, remarks: "Q1 2026 Index" },
                { year: 2025, quarter: 4, naturalRubber: 2.05, syntheticRubber: 1.75, carbonBlack: 1.30, steelCord: 1.10, rmiValue: 1.6625, remarks: "Q4 2025 Index" },
                { year: 2025, quarter: 3, naturalRubber: 1.95, syntheticRubber: 1.65, carbonBlack: 1.25, steelCord: 1.05, rmiValue: 1.580, remarks: "Q3 2025 Index" },
                { year: 2025, quarter: 2, naturalRubber: 1.85, syntheticRubber: 1.60, carbonBlack: 1.20, steelCord: 1.00, rmiValue: 1.5075, remarks: "Q2 2025 Index" },
            ]
            for (const r of defaultRmi) {
                await db.insert(rmiRecords).values({
                    year: r.year,
                    quarter: r.quarter,
                    naturalRubber: r.naturalRubber.toString(),
                    syntheticRubber: r.syntheticRubber.toString(),
                    carbonBlack: r.carbonBlack.toString(),
                    steelCord: r.steelCord.toString(),
                    rmiValue: r.rmiValue.toString(),
                    remarks: r.remarks,
                })
            }
        } else {
            // Cek secara spesifik data Q2 2026
            const existingRmiQ2 = await db
                .select()
                .from(rmiRecords)
                .where(and(eq(rmiRecords.year, 2026), eq(rmiRecords.quarter, 2)))
                .limit(1)
                
            if (existingRmiQ2.length === 0) {
                await db.insert(rmiRecords).values({
                    year: 2026,
                    quarter: 2,
                    naturalRubber: "2.25",
                    syntheticRubber: "1.95",
                    carbonBlack: "1.40",
                    steelCord: "1.20",
                    rmiValue: "1.795",
                    remarks: "Q2 2026 Index (Quarter Berjalan)",
                })
            }
        }

        if (rateCountVal === 0) {
            const defaultRates = [
                { year: 2026, quarter: 2, averageRate: 17600.00, rateMonth1: 17400.00, rateMonth2: 17600.00, rateMonth3: 17800.00, remarks: "Rata-rata Kurs Q2 2026 (Quarter Berjalan)" },
                { year: 2026, quarter: 1, averageRate: 16250.00, rateMonth1: 16100.00, rateMonth2: 16250.00, rateMonth3: 16400.00, remarks: "Rata-rata Kurs Q1 2026" },
                { year: 2025, quarter: 4, averageRate: 16500.00, rateMonth1: 16400.00, rateMonth2: 16500.00, rateMonth3: 16600.00, remarks: "Rata-rata Kurs Q4 2025 (Base Period)" },
                { year: 2025, quarter: 3, averageRate: 16300.00, rateMonth1: 16200.00, rateMonth2: 16300.00, rateMonth3: 16400.00, remarks: "Rata-rata Kurs Q3 2025" },
                { year: 2025, quarter: 2, averageRate: 16100.00, rateMonth1: 16000.00, rateMonth2: 16100.00, rateMonth3: 16200.00, remarks: "Rata-rata Kurs Q2 2025" },
            ]
            for (const r of defaultRates) {
                await db.insert(quarterlyExchangeRates).values({
                    year: r.year,
                    quarter: r.quarter,
                    averageRate: r.averageRate.toString(),
                    rateMonth1: r.rateMonth1.toString(),
                    rateMonth2: r.rateMonth2.toString(),
                    rateMonth3: r.rateMonth3.toString(),
                    remarks: r.remarks,
                })
            }
        } else {
            // Cek secara spesifik data Q2 2026
            const existingRateQ2 = await db
                .select()
                .from(quarterlyExchangeRates)
                .where(and(eq(quarterlyExchangeRates.year, 2026), eq(quarterlyExchangeRates.quarter, 2)))
                .limit(1)

            if (existingRateQ2.length === 0) {
                await db.insert(quarterlyExchangeRates).values({
                    year: 2026,
                    quarter: 2,
                    averageRate: "17600.00",
                    rateMonth1: "17400.00",
                    rateMonth2: "17600.00",
                    rateMonth3: "17800.00",
                    remarks: "Rata-rata Kurs Q2 2026 (Quarter Berjalan)",
                })
            } else if (parseFloat(existingRateQ2[0].averageRate) === 16250.00) {
                // Perbarui ke data yang akurat
                await db.update(quarterlyExchangeRates)
                    .set({
                        averageRate: "17600.00",
                        rateMonth1: "17400.00",
                        rateMonth2: "17600.00",
                        rateMonth3: "17800.00",
                    })
                    .where(eq(quarterlyExchangeRates.id, existingRateQ2[0].id))
            }
        }

        return { success: true }
    } catch (error) {
        console.error("Error seeding RMI defaults:", error)
        return { success: false }
    }
}
