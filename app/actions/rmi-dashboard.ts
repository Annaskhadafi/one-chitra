"use server"

import { db } from "@/db"
import { rmiRecords, quarterlyExchangeRates, rmiWeights, quotations } from "@/db/schema"
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
    freight: z.number().min(0).optional().default(0),
    fxIndex: z.number().min(0).optional().default(0),
    source: z.string().max(255).optional().nullable(),
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
            "freight" numeric(14, 4) DEFAULT '0' NOT NULL,
            "fx_index" numeric(14, 4) DEFAULT '0' NOT NULL,
            "rmi_value" numeric(14, 4) DEFAULT '0' NOT NULL,
            "source" varchar(255),
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

    // Tambahkan kolom source, freight, fx_index ke rmi_records jika belum ada
    await db.execute(sql`
        ALTER TABLE "rmi_records"
        ADD COLUMN IF NOT EXISTS "source" varchar(255),
        ADD COLUMN IF NOT EXISTS "freight" numeric(14, 4) DEFAULT '0' NOT NULL,
        ADD COLUMN IF NOT EXISTS "fx_index" numeric(14, 4) DEFAULT '0' NOT NULL;
    `)

    // Memastikan tabel rmi_weights ada
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "rmi_weights" (
            "id" serial PRIMARY KEY NOT NULL,
            "label" varchar(255) DEFAULT 'Default' NOT NULL,
            "natural_rubber_weight" numeric(5, 4) DEFAULT '0.35' NOT NULL,
            "synthetic_rubber_weight" numeric(5, 4) DEFAULT '0.20' NOT NULL,
            "carbon_black_weight" numeric(5, 4) DEFAULT '0.20' NOT NULL,
            "steel_cord_weight" numeric(5, 4) DEFAULT '0.15' NOT NULL,
            "freight_weight" numeric(5, 4) DEFAULT '0.05' NOT NULL,
            "fx_weight" numeric(5, 4) DEFAULT '0.05' NOT NULL,
            "base_period_natural_rubber" numeric(14, 4) DEFAULT '2.05' NOT NULL,
            "base_period_synthetic_rubber" numeric(14, 4) DEFAULT '13200.0' NOT NULL,
            "base_period_carbon_black" numeric(14, 4) DEFAULT '1.45' NOT NULL,
            "base_period_steel_cord" numeric(14, 4) DEFAULT '1.10' NOT NULL,
            "base_period_freight" numeric(14, 4) DEFAULT '2800.0' NOT NULL,
            "base_period_exchange_rate" numeric(14, 4) DEFAULT '16500.0' NOT NULL,
            "is_active" boolean DEFAULT true NOT NULL,
            "created_at" timestamp DEFAULT now() NOT NULL,
            "updated_at" timestamp DEFAULT now() NOT NULL
        )
    `)
}

// Konstanta Harga Dasar (Base Period Q4 2025) untuk perhitungan indeks (fallback)
const DEFAULT_BASE_PRICES = {
    naturalRubber: 2.05,
    syntheticRubber: 13200.0,
    carbonBlack: 1.45,
    steelCord: 1.10,
    freight: 2800.0,
    exchangeRate: 16500.0
}

const DEFAULT_WEIGHTS = {
    naturalRubber: 0.35,
    syntheticRubber: 0.20,
    carbonBlack: 0.20,
    steelCord: 0.15,
    freight: 0.05,
    fx: 0.05
}

export type RmiWeightsConfig = {
    naturalRubberWeight: number
    syntheticRubberWeight: number
    carbonBlackWeight: number
    steelCordWeight: number
    freightWeight: number
    fxWeight: number
    basePeriodNaturalRubber: number
    basePeriodSyntheticRubber: number
    basePeriodCarbonBlack: number
    basePeriodSteelCord: number
    basePeriodFreight: number
    basePeriodExchangeRate: number
}

// Menghitung nilai RMI berdasarkan formula indeks berbobot (dynamic)
function calculateRmiValue(
    nr: number,
    sr: number,
    cb: number,
    sc: number,
    fr: number = 0,
    fx: number = 0,
    weights?: RmiWeightsConfig
): number {
    const w = weights ? {
        nr: weights.naturalRubberWeight,
        sr: weights.syntheticRubberWeight,
        cb: weights.carbonBlackWeight,
        sc: weights.steelCordWeight,
        fr: weights.freightWeight,
        fx: weights.fxWeight,
    } : DEFAULT_WEIGHTS

    const bp = weights ? {
        nr: weights.basePeriodNaturalRubber,
        sr: weights.basePeriodSyntheticRubber,
        cb: weights.basePeriodCarbonBlack,
        sc: weights.basePeriodSteelCord,
        fr: weights.basePeriodFreight,
        fx: weights.basePeriodExchangeRate,
    } : DEFAULT_BASE_PRICES

    // Hitung indeks masing-masing komponen (Harga Saat Ini / Harga Base * 100)
    const idxNR = bp.nr > 0 ? (nr / bp.nr) * 100 : 0
    const idxSR = bp.sr > 0 ? (sr / bp.sr) * 100 : 0
    const idxCB = bp.cb > 0 ? (cb / bp.cb) * 100 : 0
    const idxSC = bp.sc > 0 ? (sc / bp.sc) * 100 : 0
    const idxFR = fr > 0 && bp.fr > 0 ? (fr / bp.fr) * 100 : 100
    const idxFX = fx > 0 ? fx : 100

    // RMI = sum(Bobot * Index)
    return (idxNR * w.nr) + (idxSR * w.sr) + (idxCB * w.cb) + (idxSC * w.sc) + (idxFR * w.fr) + (idxFX * w.fx)
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
// RMI WEIGHTS (BOBOT) ACTIONS
// -------------------------------------------------------------
const rmiWeightsSchema = z.object({
    label: z.string().max(255).optional().default("Default"),
    naturalRubberWeight: z.number().min(0).max(1),
    syntheticRubberWeight: z.number().min(0).max(1),
    carbonBlackWeight: z.number().min(0).max(1),
    steelCordWeight: z.number().min(0).max(1),
    freightWeight: z.number().min(0).max(1),
    fxWeight: z.number().min(0).max(1),
    basePeriodNaturalRubber: z.number().min(0),
    basePeriodSyntheticRubber: z.number().min(0),
    basePeriodCarbonBlack: z.number().min(0),
    basePeriodSteelCord: z.number().min(0),
    basePeriodFreight: z.number().min(0),
    basePeriodExchangeRate: z.number().min(0),
})

export type RmiWeightsInput = z.infer<typeof rmiWeightsSchema>

export async function getRmiWeights() {
    try {
        await ensureRmiTables()

        const data = await db
            .select()
            .from(rmiWeights)
            .where(eq(rmiWeights.isActive, true))
            .orderBy(desc(rmiWeights.id))
            .limit(1)

        // Jika belum ada data, seed default
        if (data.length === 0) {
            const [created] = await db
                .insert(rmiWeights)
                .values({
                    label: "Default (Q4 2025)",
                    naturalRubberWeight: "0.35",
                    syntheticRubberWeight: "0.20",
                    carbonBlackWeight: "0.20",
                    steelCordWeight: "0.15",
                    freightWeight: "0.05",
                    fxWeight: "0.05",
                    basePeriodNaturalRubber: "2.05",
                    basePeriodSyntheticRubber: "13200.0",
                    basePeriodCarbonBlack: "1.45",
                    basePeriodSteelCord: "1.10",
                    basePeriodFreight: "2800.0",
                    basePeriodExchangeRate: "16500.0",
                    isActive: true,
                })
                .returning()
            return { success: true, data: created }
        }

        return { success: true, data: data[0] }
    } catch (error) {
        console.error("Error fetching RMI weights:", error)
        return { success: false, error: "Gagal memuat data bobot RMI" }
    }
}

export async function getAllRmiWeights() {
    try {
        await ensureRmiTables()

        const data = await db
            .select()
            .from(rmiWeights)
            .orderBy(desc(rmiWeights.createdAt))

        return { success: true, data }
    } catch (error) {
        console.error("Error fetching all RMI weights:", error)
        return { success: false, error: "Gagal memuat data bobot RMI" }
    }
}

export async function updateRmiWeights(id: number, data: RmiWeightsInput) {
    try {
        await getAuthenticatedSession("rmi-dashboard", "edit")
        await ensureRmiTables()
        const parsed = rmiWeightsSchema.parse(data)

        const [updated] = await db
            .update(rmiWeights)
            .set({
                label: parsed.label,
                naturalRubberWeight: parsed.naturalRubberWeight.toString(),
                syntheticRubberWeight: parsed.syntheticRubberWeight.toString(),
                carbonBlackWeight: parsed.carbonBlackWeight.toString(),
                steelCordWeight: parsed.steelCordWeight.toString(),
                freightWeight: parsed.freightWeight.toString(),
                fxWeight: parsed.fxWeight.toString(),
                basePeriodNaturalRubber: parsed.basePeriodNaturalRubber.toString(),
                basePeriodSyntheticRubber: parsed.basePeriodSyntheticRubber.toString(),
                basePeriodCarbonBlack: parsed.basePeriodCarbonBlack.toString(),
                basePeriodSteelCord: parsed.basePeriodSteelCord.toString(),
                basePeriodFreight: parsed.basePeriodFreight.toString(),
                basePeriodExchangeRate: parsed.basePeriodExchangeRate.toString(),
                updatedAt: new Date(),
            })
            .where(eq(rmiWeights.id, id))
            .returning()

        revalidatePath("/dashboard/rmi")
        return { success: true, data: updated }
    } catch (error) {
        console.error("Error updating RMI weights:", error)
        return { success: false, error: "Gagal memperbarui data bobot RMI" }
    }
}

export async function createRmiWeights(data: RmiWeightsInput) {
    try {
        await getAuthenticatedSession("rmi-dashboard", "create")
        await ensureRmiTables()
        const parsed = rmiWeightsSchema.parse(data)

        // Deactivate all existing active weights
        await db.update(rmiWeights).set({ isActive: false }).where(eq(rmiWeights.isActive, true))

        const [created] = await db
            .insert(rmiWeights)
            .values({
                label: parsed.label,
                naturalRubberWeight: parsed.naturalRubberWeight.toString(),
                syntheticRubberWeight: parsed.syntheticRubberWeight.toString(),
                carbonBlackWeight: parsed.carbonBlackWeight.toString(),
                steelCordWeight: parsed.steelCordWeight.toString(),
                freightWeight: parsed.freightWeight.toString(),
                fxWeight: parsed.fxWeight.toString(),
                basePeriodNaturalRubber: parsed.basePeriodNaturalRubber.toString(),
                basePeriodSyntheticRubber: parsed.basePeriodSyntheticRubber.toString(),
                basePeriodCarbonBlack: parsed.basePeriodCarbonBlack.toString(),
                basePeriodSteelCord: parsed.basePeriodSteelCord.toString(),
                basePeriodFreight: parsed.basePeriodFreight.toString(),
                basePeriodExchangeRate: parsed.basePeriodExchangeRate.toString(),
                isActive: true,
            })
            .returning()

        revalidatePath("/dashboard/rmi")
        return { success: true, data: created }
    } catch (error) {
        console.error("Error creating RMI weights:", error)
        return { success: false, error: "Gagal menambahkan data bobot RMI" }
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

        // Fetch active weights
        const weightsResult = await getRmiWeights()
        const weightsConfig = weightsResult.success && weightsResult.data ? weightsResult.data as RmiWeightsConfig : undefined

        const rmiValue = calculateRmiValue(
            parsed.naturalRubber,
            parsed.syntheticRubber,
            parsed.carbonBlack,
            parsed.steelCord,
            parsed.freight ?? 0,
            parsed.fxIndex ?? 0,
            weightsConfig
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
                freight: (parsed.freight ?? 0).toString(),
                fxIndex: (parsed.fxIndex ?? 0).toString(),
                rmiValue: rmiValue.toString(),
                source: parsed.source || null,
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

        // Fetch active weights
        const weightsResult = await getRmiWeights()
        const weightsConfig = weightsResult.success && weightsResult.data ? weightsResult.data as RmiWeightsConfig : undefined

        const rmiValue = calculateRmiValue(
            parsed.naturalRubber,
            parsed.syntheticRubber,
            parsed.carbonBlack,
            parsed.steelCord,
            parsed.freight ?? 0,
            parsed.fxIndex ?? 0,
            weightsConfig
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
                freight: (parsed.freight ?? 0).toString(),
                fxIndex: (parsed.fxIndex ?? 0).toString(),
                rmiValue: rmiValue.toString(),
                source: parsed.source || null,
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

export async function getSapTireProducts() {
    try {
        await getAuthenticatedSession("rmi-dashboard", "view")
        
        // Query zmc9_stock_sap di-JOIN dengan tabel products untuk filter berdasarkan
        // category = 'TYRE' (kategori resmi ban), bukan filter nama material.
        // Ini memastikan hanya ban asli yang muncul, bukan aksesori seperti sensor/valve/handler.
        // Filter: total_stock > 0 (ready stock), deduplikasi per material_no.
        const result = await db.execute(sql`
            SELECT 
                z.material_no as "materialNo", 
                MAX(z.material_desc) as "materialDesc", 
                SUM(CAST(z.total_stock AS numeric)) as "totalQty", 
                SUM(CAST(z.value_stock AS numeric)) as "totalValue",
                MAX(z.currency) as currency
            FROM public.zmc9_stock_sap z
            INNER JOIN public.products p 
                ON p.material_number = z.material_no
                AND UPPER(p.category) = 'TYRE'
            GROUP BY z.material_no
            HAVING SUM(CAST(z.total_stock AS numeric)) > 0
            ORDER BY MAX(z.material_desc) ASC
        `)

        const tires = result.rows.map(r => ({
            materialNo: String(r.materialNo || ""),
            materialDesc: String(r.materialDesc || ""),
            totalQty: Number(r.totalQty || 0),
            totalValue: Number(r.totalValue || 0),
            currency: String(r.currency || "USD")
        }))

        return { success: true, data: tires }
    } catch (error) {
        console.error("Error fetching SAP tire products:", error)
        return { success: false, error: "Gagal memuat produk ban SAP" }
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
                { year: 2026, quarter: 2, naturalRubber: 2.244, syntheticRubber: 13708.3, carbonBlack: 1.66, steelCord: 1.202, freight: 3549.0, fxIndex: 106.6667, rmiValue: 531.0253, remarks: "Q2 2026 Index (Quarter Berjalan)" },
                { year: 2026, quarter: 1, naturalRubber: 2.15, syntheticRubber: 13500.0, carbonBlack: 1.55, steelCord: 1.15, freight: 3000.0, fxIndex: 98.4848, rmiValue: 433.003, remarks: "Q1 2026 Index" },
                { year: 2025, quarter: 4, naturalRubber: 2.05, syntheticRubber: 13200.0, carbonBlack: 1.45, steelCord: 1.10, freight: 2800.0, fxIndex: 100.0, rmiValue: 385.5075, remarks: "Q4 2025 Index (Base Period)" },
                { year: 2025, quarter: 3, naturalRubber: 1.95, syntheticRubber: 13000.0, carbonBlack: 1.35, steelCord: 1.05, freight: 2700.0, fxIndex: 98.7879, rmiValue: 375.3969, remarks: "Q3 2025 Index" },
                { year: 2025, quarter: 2, naturalRubber: 1.85, syntheticRubber: 12800.0, carbonBlack: 1.25, steelCord: 1.00, freight: 2600.0, fxIndex: 97.5758, rmiValue: 365.2863, remarks: "Q2 2025 Index" },
            ]
            for (const r of defaultRmi) {
                await db.insert(rmiRecords).values({
                    year: r.year,
                    quarter: r.quarter,
                    naturalRubber: r.naturalRubber.toString(),
                    syntheticRubber: r.syntheticRubber.toString(),
                    carbonBlack: r.carbonBlack.toString(),
                    steelCord: r.steelCord.toString(),
                    freight: r.freight.toString(),
                    fxIndex: r.fxIndex.toString(),
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
                    naturalRubber: "2.244",
                    syntheticRubber: "13708.3",
                    carbonBlack: "1.66",
                    steelCord: "1.202",
                    freight: "3549.0",
                    fxIndex: "106.6667",
                    rmiValue: "531.0253",
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
            }
        }

        return { success: true }
    } catch (error) {
        console.error("Error seeding RMI defaults:", error)
        return { success: false }
    }
}

// Action untuk sinkronisasi data dari API eksternal ke database
export async function syncRmiFromExternalApis(year: number, quarter: number) {
    try {
        await getAuthenticatedSession("rmi-dashboard", "create")
        await ensureRmiTables()

        // 1. Fetch Material Price API
        const materialRes = await fetch("https://ics.chitraparatama.com/product/api/apiconnect.php?function=get_material_price")
        const materialJson = await materialRes.json()
        if (materialJson.status !== "OK" || !Array.isArray(materialJson.result)) {
            return { success: false, error: "Gagal mengambil data Material Price dari API" }
        }

        // 2. Fetch Freight Price API
        const freightRes = await fetch("https://ics.chitraparatama.com/product/api/apiconnect.php?function=get_freight_price")
        const freightJson = await freightRes.json()
        if (freightJson.status !== "OK" || !Array.isArray(freightJson.result)) {
            return { success: false, error: "Gagal mengambil data Freight Price dari API" }
        }

        // Tentukan range tanggal untuk kuartal yang dipilih
        // Format tanggal dari API: YYYY-MM-DD
        const startMonth = (quarter - 1) * 3 + 1
        const endMonth = quarter * 3
        const startDateStr = `${year}-${startMonth.toString().padStart(2, "0")}-01`
        const endDateStr = `${year}-${endMonth.toString().padStart(2, "0")}-31` // Sederhana saja untuk pembanding string tanggal

        // Helper filter data berdasarkan kuartal atau fallback ke semua data jika kosong
        const filterByQuarter = (list: any[], dateField: string = "price_date") => {
            const filtered = list.filter(item => {
                const date = item[dateField]
                return date && date >= startDateStr && date <= endDateStr
            })
            return filtered.length > 0 ? filtered : list // Fallback ke semua data (terbaru) jika tidak ada data spesifik kuartal tersebut
        };

        const qMaterials = filterByQuarter(materialJson.result)
        const qFreights = filterByQuarter(freightJson.result)

        // Hitung rata-rata harga untuk setiap material
        const getAveragePrice = (list: any[], name: string) => {
            const filtered = list.filter(item => item.material_name === name)
            if (filtered.length === 0) return 0
            const sum = filtered.reduce((acc, curr) => acc + parseFloat(curr.material_price || 0), 0)
            return sum / filtered.length
        };

        // Konversi dan rata-rata
        // Rubber -> USD Cents, dibagi 100 menjadi USD/Kg
        const rawRubber = getAveragePrice(qMaterials, "Rubber")
        const naturalRubberVal = rawRubber / 100

        // Synthetic Rubber -> CNY/T
        const syntheticRubberVal = getAveragePrice(qMaterials, "Synthetic Rubber")

        // Carbon Black -> USD/Kg
        const carbonBlackVal = getAveragePrice(qMaterials, "Carbon Black (Europe)")

        // HRC Steel -> USD/T, dibagi 1000 menjadi USD/Kg
        const rawSteel = getAveragePrice(qMaterials, "HRC Steel")
        const steelCordVal = rawSteel / 1000

        // Drewry World Container Index -> USD/40ft
        const freightVal = getAveragePrice(qFreights, "Drewry World Container Index")

        // Ambil FX Rate untuk kuartal berjalan dari database
        const rateRecord = await db
            .select()
            .from(quarterlyExchangeRates)
            .where(and(eq(quarterlyExchangeRates.year, year), eq(quarterlyExchangeRates.quarter, quarter)))
            .limit(1)

        // Kurs base Q4 2025 default 16500
        const baseRate = 16500
        const currentRate = rateRecord.length > 0 ? parseFloat(rateRecord[0].averageRate) : 16500
        // FX Index = (Kurs saat ini / Kurs Base) * 100
        const fxIndexVal = (currentRate / baseRate) * 100

        // Hitung RMI value
        // Fetch active weights
        const weightsResult = await getRmiWeights()
        const weightsConfig = weightsResult.success && weightsResult.data ? weightsResult.data as RmiWeightsConfig : undefined

        const rmiValue = calculateRmiValue(
            naturalRubberVal,
            syntheticRubberVal,
            carbonBlackVal,
            steelCordVal,
            freightVal,
            fxIndexVal,
            weightsConfig
        )

        return {
            success: true,
            data: {
                year,
                quarter,
                naturalRubber: parseFloat(naturalRubberVal.toFixed(4)),
                syntheticRubber: parseFloat(syntheticRubberVal.toFixed(4)),
                carbonBlack: parseFloat(carbonBlackVal.toFixed(4)),
                steelCord: parseFloat(steelCordVal.toFixed(4)),
                freight: parseFloat(freightVal.toFixed(4)),
                fxIndex: parseFloat(fxIndexVal.toFixed(4)),
                rmiValue: parseFloat(rmiValue.toFixed(4)),
                source: "API ICS (Auto)",
                remarks: `Disinkronkan otomatis dari API ICS pada ${new Date().toLocaleDateString("id-ID")}`
            }
        }
    } catch (error) {
        console.error("Error syncing RMI from API:", error)
        return { success: false, error: "Terjadi kesalahan internal saat sinkronisasi API" }
    }
}

// Mengambil rincian data harga material & freight per bulan secara dinamis dari API eksternal
export async function getExternalPricesForMonthlyCollapse() {
    try {
        await getAuthenticatedSession("rmi-dashboard", "view")

        // 1. Fetch Material Price API
        const materialRes = await fetch("https://ics.chitraparatama.com/product/api/apiconnect.php?function=get_material_price")
        const materialJson = await materialRes.json()
        if (materialJson.status !== "OK" || !Array.isArray(materialJson.result)) {
            return { success: false, error: "Gagal mengambil data Material Price" }
        }

        // 2. Fetch Freight Price API
        const freightRes = await fetch("https://ics.chitraparatama.com/product/api/apiconnect.php?function=get_freight_price")
        const freightJson = await freightRes.json()
        if (freightJson.status !== "OK" || !Array.isArray(freightJson.result)) {
            return { success: false, error: "Gagal mengambil data Freight Price" }
        }

        // Gabungkan semua data mentah
        const allMaterials = materialJson.result
        const allFreights = freightJson.result

        // Struktur data penampung: key = `${year}-Q${quarter}` -> array berisi 3 bulan
        const monthlyAverages: Record<string, {
            monthIndex: number;
            monthName: string;
            naturalRubber: number;
            syntheticRubber: number;
            carbonBlack: number;
            steelCord: number;
            freight: number;
        }[]> = {}

        // Helper untuk parse tanggal dan tentukan quarter serta nama bulan
        const getMonthName = (monthNum: number) => {
            const names = [
                "Januari", "Februari", "Maret", "April", "Mei", "Juni",
                "Juli", "Agustus", "September", "Oktober", "November", "Desember"
            ]
            return names[monthNum - 1] || ""
        }

        // Kita ingin menghasilkan data bulanan dari tahun 2025 sampai tahun sekarang
        const currentYear = new Date().getFullYear()
        for (let y = 2025; y <= currentYear + 1; y++) {
            for (let q = 1; q <= 4; q++) {
                const qKey = `${y}-Q${q}`
                const startMonth = (q - 1) * 3 + 1 // 1, 4, 7, 10
                
                const monthsInQuarter = [startMonth, startMonth + 1, startMonth + 2]
                
                const qDetails = monthsInQuarter.map(m => {
                    const startStr = `${y}-${m.toString().padStart(2, "0")}-01`
                    const endStr = `${y}-${m.toString().padStart(2, "0")}-31`

                    // Filter data material & freight untuk bulan ini
                    const filterByMonth = (list: any[], dateField: string = "price_date") => {
                        return list.filter(item => {
                            const date = item[dateField]
                            return date && date >= startStr && date <= endStr
                        })
                    }

                    const mMaterials = filterByMonth(allMaterials)
                    const mFreights = filterByMonth(allFreights)

                    const getAvg = (list: any[], name: string) => {
                        const filtered = list.filter(item => item.material_name === name)
                        if (filtered.length === 0) return 0
                        const sum = filtered.reduce((acc, curr) => acc + parseFloat(curr.material_price || 0), 0)
                        return sum / filtered.length
                    }

                    // Hitung rata-rata bulanan
                    const rawRubber = getAvg(mMaterials, "Rubber")
                    const nr = rawRubber > 0 ? rawRubber / 100 : 0
                    
                    const sr = getAvg(mMaterials, "Synthetic Rubber")
                    const cb = getAvg(mMaterials, "Carbon Black (Europe)")
                    
                    const rawSteel = getAvg(mMaterials, "HRC Steel")
                    const sc = rawSteel > 0 ? rawSteel / 1000 : 0
                    
                    const fr = getAvg(mFreights, "Drewry World Container Index")

                    return {
                        monthIndex: m,
                        monthName: getMonthName(m),
                        naturalRubber: parseFloat(nr.toFixed(4)),
                        syntheticRubber: parseFloat(sr.toFixed(4)),
                        carbonBlack: parseFloat(cb.toFixed(4)),
                        steelCord: parseFloat(sc.toFixed(4)),
                        freight: parseFloat(fr.toFixed(4))
                    }
                })

                // Simpan jika ada minimal satu bulan yang memiliki data harga
                const hasAnyData = qDetails.some(d => d.naturalRubber > 0 || d.syntheticRubber > 0 || d.freight > 0)
                if (hasAnyData) {
                    monthlyAverages[qKey] = qDetails
                }
            }
        }

        return { success: true, data: monthlyAverages }
    } catch (error) {
        console.error("Error generating monthly collapse data:", error)
        return { success: false, error: "Gagal memuat detail bulanan" }
    }
}

// -------------------------------------------------------------
// LOST SALE + SAP READY STOCK MATCHING
// -------------------------------------------------------------
export async function getLostSaleStockMatch() {
    try {
        await getAuthenticatedSession("rmi-dashboard", "view")

        // 1. Fetch all quotations with items + product
        const allQuotes = await db.query.quotations.findMany({
            with: {
                items: { with: { product: true } },
                customer: true,
                salesPerson: true,
                createdByUser: true,
            },
            orderBy: [desc(quotations.quotationDate)]
        })

        // 2. Fetch SAP ready stock (all categories, stock > 0)
        const stockResult = await db.execute(sql`
            SELECT 
                z.material_no as "materialNo", 
                MAX(z.material_desc) as "materialDesc", 
                SUM(CAST(z.total_stock AS numeric)) as "totalQty", 
                SUM(CAST(z.value_stock AS numeric)) as "totalValue",
                MAX(z.currency) as currency
            FROM public.zmc9_stock_sap z
            GROUP BY z.material_no
            HAVING SUM(CAST(z.total_stock AS numeric)) > 0
            ORDER BY MAX(z.material_desc) ASC
        `)

        const readyStock = stockResult.rows.map(r => ({
            materialNo: String(r.materialNo || ""),
            materialDesc: String(r.materialDesc || ""),
            totalQty: Number(r.totalQty || 0),
            totalValue: Number(r.totalValue || 0),
            currency: String(r.currency || "USD"),
        }))

        // 3. Tire size regex
        const tireSizeRegex = /(\d{1,3}(\.\d{1,2})?\s?R\s?\d{1,2}(\.\d{1})?)|(\d{3}\/\d{2}\s?R\s?\d{2})|(\d{1,2}\.?\d{0,2}-\d{2})/gi
        const extractTireSize = (desc: string) => {
            const matches = desc.match(tireSizeRegex)
            return matches ? matches[0].replace(/\s+/g, '').toUpperCase() : null
        }

        // 4. Filter lost/rejected/expired quotes
        const lostStatuses = ['rejected', 'expired', 'lost', 'cancelled']
        const lostQuotes = allQuotes.filter(q => lostStatuses.includes(q.status))

        // 5. Build lost items with stock matching
        const lostItems = lostQuotes.flatMap(q =>
            q.items.map(item => {
                if (!item.product) return null
                const desc = item.product.materialDescription || ""
                const isTire = item.product.category?.toUpperCase().includes('TYRE')

                // Find matching ready stock
                let matchedStock: typeof readyStock = []

                if (isTire) {
                    const size = extractTireSize(desc)
                    if (size) {
                        matchedStock = readyStock.filter(s => {
                            const sSize = extractTireSize(s.materialDesc)
                            return sSize === size
                        })
                    }
                }

                // Fallback: fuzzy match by material description
                if (matchedStock.length === 0) {
                    const lowerDesc = desc.toLowerCase()
                    matchedStock = readyStock.filter(s => {
                        const sLower = s.materialDesc.toLowerCase()
                        // Check if significant words overlap
                        const words = lowerDesc.split(/\s+/).filter(w => w.length > 3)
                        return words.some(w => sLower.includes(w))
                    }).slice(0, 3)
                }

                return {
                    quotationNumber: q.quotationNumber,
                    quotationId: q.id,
                    customerName: q.customer?.name || "-",
                    salesName: q.salesPerson?.name || q.createdByUser?.name || "-",
                    productName: desc,
                    productId: item.productId,
                    category: item.product.category,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    status: q.status,
                    date: q.quotationDate,
                    matchedStock: matchedStock.map(s => ({
                        materialNo: s.materialNo,
                        materialDesc: s.materialDesc,
                        totalQty: s.totalQty,
                        totalValue: s.totalValue,
                        currency: s.currency,
                    })),
                    hasMatch: matchedStock.length > 0,
                }
            })
        ).filter(Boolean)

        // 6. Summary stats
        const totalLost = lostItems.length
        const totalMatched = lostItems.filter(i => i.hasMatch).length
        const totalUnmatched = totalLost - totalMatched

        return {
            success: true,
            data: {
                lostItems,
                readyStockCount: readyStock.length,
                totalLost,
                totalMatched,
                totalUnmatched,
            }
        }
    } catch (error) {
        console.error("Error matching lost sale with stock:", error)
        return { success: false, error: "Gagal memuat data lost sale & stock" }
    }
}

