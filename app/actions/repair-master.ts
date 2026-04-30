"use server"

import { asc, eq, inArray, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { db } from "@/db"
import { repairMasterItems, repairMasterSites } from "@/db/schema"
import { DEFAULT_REPAIR_SITES, normalizeRepairMasterCode } from "@/lib/repair-master"
import { repairMasterItemSchema, repairMasterSiteSchema } from "@/lib/schemas"

const REPAIR_MASTER_PATH = "/dashboard/master-barang-repair"

function cleanText(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed || null
}

async function ensureRepairMasterTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "repair_master_items" (
      "id" serial PRIMARY KEY NOT NULL,
      "material_code" varchar(100) NOT NULL,
      "material_name" text NOT NULL,
      "valuation_stock_value" varchar(100),
      "currency" varchar(20),
      "valuated_stock" varchar(100),
      "uom" varchar(30),
      "category" varchar(100),
      "smu" varchar(50),
      "default_qty" varchar(50),
      "standard_time" varchar(50),
      "notes" text,
      "is_active" boolean DEFAULT true NOT NULL,
      "sort_order" integer DEFAULT 0 NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL,
      CONSTRAINT "unq_repair_master_item_code" UNIQUE("material_code")
    )
  `)

  await db.execute(sql`ALTER TABLE "repair_master_items" ADD COLUMN IF NOT EXISTS "valuation_stock_value" varchar(100)`)
  await db.execute(sql`ALTER TABLE "repair_master_items" ADD COLUMN IF NOT EXISTS "currency" varchar(20)`)
  await db.execute(sql`ALTER TABLE "repair_master_items" ADD COLUMN IF NOT EXISTS "valuated_stock" varchar(100)`)
  await db.execute(sql`ALTER TABLE "repair_master_items" ADD COLUMN IF NOT EXISTS "uom" varchar(30)`)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "repair_master_sites" (
      "id" serial PRIMARY KEY NOT NULL,
      "site_code" varchar(50) NOT NULL,
      "site_name" text NOT NULL,
      "sort_order" integer DEFAULT 0 NOT NULL,
      "is_active" boolean DEFAULT true NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL,
      CONSTRAINT "unq_repair_master_site_code" UNIQUE("site_code")
    )
  `)
}

async function ensureDefaultRepairSites() {
  await ensureRepairMasterTables()

  await db
    .insert(repairMasterSites)
    .values(
      DEFAULT_REPAIR_SITES.map((site, index) => ({
        siteCode: site.siteCode,
        siteName: site.siteName,
        sortOrder: index + 1,
      })),
    )
    .onConflictDoNothing({ target: repairMasterSites.siteCode })
}

export async function getRepairMasterData() {
  await ensureDefaultRepairSites()

  const [items, sites] = await Promise.all([
    db.select().from(repairMasterItems).orderBy(asc(repairMasterItems.sortOrder), asc(repairMasterItems.materialCode)),
    db.select().from(repairMasterSites).orderBy(asc(repairMasterSites.sortOrder), asc(repairMasterSites.siteCode)),
  ])

  return { items, sites }
}

export async function upsertRepairMasterItem(data: z.infer<typeof repairMasterItemSchema>, id?: number) {
  try {
    await ensureRepairMasterTables()

    const parsed = repairMasterItemSchema.parse(data)
    const materialCode = normalizeRepairMasterCode(parsed.materialCode)

    const existing = await db
      .select({ id: repairMasterItems.id })
      .from(repairMasterItems)
      .where(eq(repairMasterItems.materialCode, materialCode))
      .limit(1)

    if (existing[0] && existing[0].id !== id) {
      return { success: false, error: "Material Code sudah digunakan" }
    }

    const values = {
      materialCode,
      materialName: parsed.materialName.trim(),
      valuationStockValue: cleanText(parsed.valuationStockValue),
      currency: cleanText(parsed.currency)?.toUpperCase() ?? null,
      valuatedStock: cleanText(parsed.valuatedStock),
      uom: cleanText(parsed.uom)?.toUpperCase() ?? null,
      category: cleanText(parsed.category),
      smu: cleanText(parsed.smu),
      defaultQty: cleanText(parsed.defaultQty),
      standardTime: cleanText(parsed.standardTime),
      notes: cleanText(parsed.notes),
      isActive: parsed.isActive,
      updatedAt: new Date(),
    }

    if (id) {
      await db.update(repairMasterItems).set(values).where(eq(repairMasterItems.id, id))
    } else {
      await db.insert(repairMasterItems).values({ ...values, sortOrder: 0 })
    }

    revalidatePath(REPAIR_MASTER_PATH)
    return { success: true }
  } catch (error) {
    console.error("Upsert Repair Master Item Error:", error)
    return { success: false, error: "Gagal menyimpan barang repair" }
  }
}

export async function deleteRepairMasterItem(id: number) {
  try {
    await ensureRepairMasterTables()

    await db.delete(repairMasterItems).where(eq(repairMasterItems.id, id))
    revalidatePath(REPAIR_MASTER_PATH)
    return { success: true }
  } catch (error) {
    console.error("Delete Repair Master Item Error:", error)
    return { success: false, error: "Gagal menghapus barang repair" }
  }
}

export async function bulkDeleteRepairMasterItems(ids: number[]) {
  try {
    await ensureRepairMasterTables()

    await db.delete(repairMasterItems).where(inArray(repairMasterItems.id, ids))
    revalidatePath(REPAIR_MASTER_PATH)
    return { success: true }
  } catch (error) {
    console.error("Bulk Delete Repair Master Item Error:", error)
    return { success: false, error: "Gagal menghapus barang repair" }
  }
}

export async function upsertRepairMasterSite(data: z.infer<typeof repairMasterSiteSchema>, id?: number) {
  try {
    await ensureRepairMasterTables()

    const parsed = repairMasterSiteSchema.parse(data)
    const siteCode = normalizeRepairMasterCode(parsed.siteCode)

    const existing = await db
      .select({ id: repairMasterSites.id })
      .from(repairMasterSites)
      .where(eq(repairMasterSites.siteCode, siteCode))
      .limit(1)

    if (existing[0] && existing[0].id !== id) {
      return { success: false, error: "Site Code sudah digunakan" }
    }

    const values = {
      siteCode,
      siteName: parsed.siteName.trim(),
      isActive: parsed.isActive,
      updatedAt: new Date(),
    }

    if (id) {
      await db.update(repairMasterSites).set(values).where(eq(repairMasterSites.id, id))
    } else {
      await db.insert(repairMasterSites).values({ ...values, sortOrder: 0 })
    }

    revalidatePath(REPAIR_MASTER_PATH)
    return { success: true }
  } catch (error) {
    console.error("Upsert Repair Master Site Error:", error)
    return { success: false, error: "Gagal menyimpan site repair" }
  }
}

export async function deleteRepairMasterSite(id: number) {
  try {
    await ensureRepairMasterTables()

    await db.delete(repairMasterSites).where(eq(repairMasterSites.id, id))
    revalidatePath(REPAIR_MASTER_PATH)
    return { success: true }
  } catch (error) {
    console.error("Delete Repair Master Site Error:", error)
    return { success: false, error: "Gagal menghapus site repair" }
  }
}
