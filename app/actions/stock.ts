"use server"

import { db } from "@/db"
import { stockLevels, products } from "@/db/schema"
import { eq, and, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { recordStockMovement } from "./stock-movement"
import { getAuthenticatedSession } from "@/lib/rbac"

import { stockSchema } from "@/lib/schemas"

export async function getStocks() {
    // Optimized query - hanya ambil kolom yang diperlukan
    return await db.query.stockLevels.findMany({
        columns: {
            id: true,
            productId: true,
            warehouseId: true,
            totalStock: true,
            minStock: true,
            valuationValue: true,
        },
        with: {
            product: {
                columns: {
                    materialNumber: true,
                    materialDescription: true,
                    plant: true,
                    category: true,
                    oldMaterialNo: true,
                    costSap: true,
                }
            },
            warehouse: {
                columns: {
                    sloc: true,
                    description: true,
                    type: true,
                }
            },
        },
    })
}

export async function upsertStock(data: z.infer<typeof stockSchema>, id?: number) {
    try {
        const session = await getAuthenticatedSession('stocks', id ? 'edit' : 'create')
        const userId = session.user.id

        await db.transaction(async (tx) => {
            let oldStock = 0
            let targetStockId: number | undefined = id

            if (!targetStockId) {
                const existing = await tx.query.stockLevels.findFirst({
                    where: and(
                        eq(stockLevels.productId, data.productId),
                        eq(stockLevels.warehouseId, data.warehouseId)
                    )
                })
                if (existing) {
                    oldStock = existing.totalStock
                    targetStockId = existing.id
                }
            } else {
                const existing = await tx.query.stockLevels.findFirst({
                    where: eq(stockLevels.id, targetStockId)
                })
                if (existing) {
                    oldStock = existing.totalStock
                }
            }

            if (targetStockId) {
                await tx.update(stockLevels)
                    .set({
                        ...data,
                        valuationValue: data.valuationValue?.toString(),
                        updatedAt: new Date(),
                    })
                    .where(eq(stockLevels.id, targetStockId))
            } else {
                await tx.insert(stockLevels).values({
                    ...data,
                    valuationValue: data.valuationValue?.toString(),
                })
            }

            // Record Movement (Adjustment)
            const delta = data.totalStock - oldStock
            if (delta !== 0) {
                await recordStockMovement(tx, {
                    productId: data.productId,
                    warehouseId: data.warehouseId,
                    quantity: delta,
                    type: "ADJUSTMENT",
                    referenceNumber: "Manual Adjustment",
                    recordedBy: userId,
                })
            }
        })
        revalidatePath("/dashboard/stocks")
        return { success: true }
    } catch (error) {
        console.error("Upsert stock error:", error)
        return { success: false, error: "Failed to update stock" }
    }
}

export async function deleteStock(id: number) {
    try {
        const session = await getAuthenticatedSession('stocks', 'delete')
        const userId = session.user.id

        return await db.transaction(async (tx) => {
            const existing = await tx.query.stockLevels.findFirst({
                where: eq(stockLevels.id, id)
            })

            if (existing) {
                // Record Movement (Adjustment/Removal)
                await recordStockMovement(tx, {
                    productId: existing.productId,
                    warehouseId: existing.warehouseId,
                    quantity: -existing.totalStock,
                    type: "ADJUSTMENT",
                    referenceNumber: "Manual Removal",
                    recordedBy: userId,
                })

                await tx.delete(stockLevels).where(eq(stockLevels.id, id))
            }

            revalidatePath("/dashboard/stocks")
            return { success: true }
        })
    } catch (error) {
        console.error("Delete stock error:", error)
        return { success: false, error: "Failed to delete stock" }
    }
}

export async function bulkDeleteStocks(ids: number[]) {
    try {
        await db.delete(stockLevels).where(inArray(stockLevels.id, ids))
        revalidatePath("/dashboard/stocks")
        return { success: true }
    } catch (_error) {
        return { success: false, error: "Failed to delete stocks" }
    }
}

export async function bulkUpdateStockMinStock(ids: number[], minStock: number) {
    try {
        await db.update(stockLevels)
            .set({ minStock, updatedAt: new Date() })
            .where(inArray(stockLevels.id, ids))
        revalidatePath("/dashboard/stocks")
        return { success: true }
    } catch (_error) {
        return { success: false, error: "Failed to update stock min levels" }
    }
}

export async function importStocks(data: (typeof stockLevels.$inferInsert)[]) {
    try {
        for (const item of data) {
            if (!item.productId || !item.warehouseId) continue

            await db.insert(stockLevels)
                .values(item)
                .onConflictDoUpdate({
                    target: [stockLevels.productId, stockLevels.warehouseId],
                    set: {
                        totalStock: item.totalStock,
                        valuationValue: item.valuationValue,
                        minStock: item.minStock,
                        updatedAt: new Date(),
                    },
                })
        }
        revalidatePath("/dashboard/stocks")
        return { success: true }
    } catch (_error) {
        return { success: false, error: "Failed to import stocks" }
    }
}

// ─── Export Inventory Comparison to Excel ──────────────────────────────────────
export async function getStockByMaterialNumber(materialNumber: string) {
    try {
        const product = await db.query.products.findFirst({
            where: eq(products.materialNumber, materialNumber)
        })
        
        if (!product) {
            return { success: false, error: "Product not found" }
        }

        const stocks = await db.query.stockLevels.findMany({
            where: eq(stockLevels.productId, product.id),
            with: {
                warehouse: {
                    columns: {
                        sloc: true,
                        description: true,
                    }
                }
            }
        })
        
        return { success: true, data: stocks }
    } catch (error) {
        console.error("getStockByMaterialNumber error:", error)
        return { success: false, error: "Failed to fetch stock" }
    }
}

// ─── Export Inventory Comparison to Excel ──────────────────────────────────────
export async function exportInventoryComparisonToExcel() {
    "use server"
    
    try {
        await getAuthenticatedSession("stocks", "read")
        
        // Import xlsx di server side
        const XLSX = await import("xlsx")
        
        // Fetch comparison data dari API endpoint yang sama
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/inventory-comparison`, {
            cache: "no-store"
        })
        
        if (!response.ok) {
            return { success: false, message: "Failed to fetch comparison data" }
        }
        
        const result = await response.json()
        
        if (result.status !== "OK" || !result.data) {
            return { success: false, message: result.message || "No data available" }
        }
        
        const comparisonData = result.data
        const stats = result.stats
        
        // Prepare data untuk Excel
        const excelData = comparisonData.map((row: {
            materialNumber: string
            description: string
            sloc: string
            slocDesc: string
            warehouseType: string
            plant: string
            category: string
            localStock: number
            sapStock: number
            gap: number
            status: string
        }, index: number) => ({
            "No": index + 1,
            "Material Number": row.materialNumber,
            "Description": row.description,
            "SLoc": row.sloc,
            "SLoc Description": row.slocDesc,
            "Warehouse Type": row.warehouseType,
            "Plant": row.plant,
            "Category": row.category,
            "Stock Lokal": row.localStock,
            "Stock SAP": row.sapStock,
            "Gap": row.gap,
            "Status": row.status === "match" ? "Match" : row.status === "over" ? "Over Stock" : "Under Stock",
        }))
        
        // Create workbook
        const workbook = XLSX.utils.book_new()
        
        // Add Summary sheet
        const summaryData = [
            ["Inventory Comparison Report"],
            ["Generated at", new Date().toLocaleString("id-ID")],
            [""],
            ["Summary Statistics"],
            ["Total Items Compared", stats.total],
            ["Matched Items", stats.matched],
            ["Over Stock Items", stats.over],
            ["Under Stock Items", stats.under],
            ["Items with Gap", stats.withGap],
            ["Total Absolute Gap", stats.totalAbsGap],
        ]
        const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
        XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary")
        
        // Add Comparison Data sheet
        const dataSheet = XLSX.utils.json_to_sheet(excelData)
        
        // Set column widths
        dataSheet["!cols"] = [
            { wch: 5 },  // No
            { wch: 18 }, // Material Number
            { wch: 40 }, // Description
            { wch: 8 },  // SLoc
            { wch: 25 }, // SLoc Description
            { wch: 18 }, // Warehouse Type
            { wch: 10 }, // Plant
            { wch: 15 }, // Category
            { wch: 12 }, // Stock Lokal
            { wch: 12 }, // Stock SAP
            { wch: 12 }, // Gap
            { wch: 15 }, // Status
        ]
        
        XLSX.utils.book_append_sheet(workbook, dataSheet, "Comparison Data")
        
        // Generate buffer
        const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })
        const base64 = buffer.toString("base64")
        
        const filename = `Inventory_Comparison_${new Date().toISOString().split("T")[0]}.xlsx`
        
        return {
            success: true,
            data: {
                buffer: base64,
                filename,
                mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            },
        }
    } catch (error) {
        console.error("Export to Excel error:", error)
        return {
            success: false,
            message: error instanceof Error ? error.message : "Failed to export to Excel",
        }
    }
}
