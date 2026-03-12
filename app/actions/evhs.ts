"use server"

import { db } from "@/db"
import { 
    evhsReceipts, 
    evhsReceiptItems, 
    evhsVouchers,
    evhsVoucherItems,
    evhsGiRecords,
    evhsGiItems,
    evhsMrko,
    stockTransfers, 
    stockTransferItems, 
    stockLevels,
    products,
    user,
    salesRevenueSap
} from "@/db/schema"
import { eq, desc, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getAuthenticatedSession } from "@/lib/rbac"

// Schema for Receipt Confirmation
const confirmReceiptSchema = z.object({
    transferId: z.number(),
    receivedDate: z.date(),
    doChitraNo: z.string().optional(),
    notes: z.string().optional(),
    items: z.array(z.object({
        productId: z.number(),
        confirmedQty: z.number().min(0),
        serialNumbers: z.array(z.string()).optional(),
    })),
})

/**
 * Get all E-VHS Receipts
 */
export async function getEvhsReceipts() {
    try {
        return await db.query.evhsReceipts.findMany({
            with: {
                transfer: {
                    with: {
                        fromWarehouse: true,
                        toWarehouse: true,
                    }
                },
                confirmedByUser: true,
                items: {
                    with: {
                        product: true
                    }
                },
            },
            orderBy: [desc(evhsReceipts.createdAt)],
        })
    } catch (error) {
        console.error("Error fetching E-VHS receipts:", error)
        return []
    }
}

/**
 * Get Stock Transfers that are not yet confirmed in E-VHS
 * Specifically only those with destination warehouse that has a customerId (VHS Site)
 */
export async function getPendingEvhsTransfers() {
    try {
        // Find transfers where to_warehouse has customer_id and not yet in evhs_receipts
        return await db.query.stockTransfers.findMany({
            where: (transfers, { exists, isNotNull, and, eq, not }) => and(
                // Only transfers to VHS sites (warehouses with customerId)
                // This logic might need refinement based on how VHS warehouses are identified
                // but usually they are the ones with type 'VHS' or linked to a customer
                not(
                    exists(
                        db.select()
                          .from(evhsReceipts)
                          .where(eq(evhsReceipts.transferId, transfers.id))
                    )
                )
            ),
            with: {
                fromWarehouse: true,
                toWarehouse: true,
                items: {
                    with: {
                        product: true
                    }
                },
                delivery: {
                    with: {
                        items: true
                    }
                }
            },
            orderBy: [desc(stockTransfers.createdAt)],
        })
    } catch (error) {
        console.error("Error fetching pending E-VHS transfers:", error)
        return []
    }
}

/**
 * Confirm receipt of E-VHS stock
 */
export async function confirmEvhsReceipt(data: z.infer<typeof confirmReceiptSchema>) {
    try {
        const session = await getAuthenticatedSession('evhs', 'create')
        const userId = session.user.id

        return await db.transaction(async (tx) => {
            // 1. Create Receipt Header
            const [receipt] = await tx.insert(evhsReceipts).values({
                transferId: data.transferId,
                receivedDate: data.receivedDate,
                doChitraNo: data.doChitraNo,
                confirmedBy: userId,
                notes: data.notes,
            }).returning()

            // 2. Create Receipt Items and update stock if necessary
            // (Note: stock usually already updated by stock-transfer.ts "Received" status)
            for (const item of data.items) {
                await tx.insert(evhsReceiptItems).values({
                    receiptId: receipt.id,
                    productId: item.productId,
                    confirmedQty: item.confirmedQty,
                    serialNumbers: item.serialNumbers,
                })
            }

            return { success: true, receiptId: receipt.id }
        })
    } catch (error) {
        console.error("Error confirming E-VHS receipt:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to confirm receipt" }
    } finally {
        revalidatePath("/dashboard/evhs")
    }
}

/**
 * Fitur 2 & 4: Create Voucher VHS
 */
const voucherSchema = z.object({
    woNo: z.string().optional(),
    date: z.date(),
    warehouseId: z.number(),
    remark: z.string().optional(),
    approvedByName: z.string().optional(),
    receivedByName: z.string().optional(),
    items: z.array(z.object({
        productId: z.number(),
        materialNumberCk: z.string().optional(),
        qty: z.number().min(1),
        serialNumber: z.string().optional(),
        stockBalance: z.number().optional(),
        pos: z.string().optional(),
        unitId: z.string().optional(),
    })),
})

export async function createEvhsVoucher(data: z.infer<typeof voucherSchema>) {
    try {
        const session = await getAuthenticatedSession('evhs', 'create')
        const userId = session.user.id

        // Generate VHS Number: VHS/CP/CK/YYYYMMDD-Random
        const now = new Date()
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "")
        const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase()
        const vhsNo = `VHS/CP/CK/${dateStr}-${randomStr}`

        return await db.transaction(async (tx) => {
            const [voucher] = await tx.insert(evhsVouchers).values({
                vhsNo,
                woNo: data.woNo,
                date: data.date.toISOString().slice(0, 10), // Correct Date to string
                warehouseId: data.warehouseId,
                remark: data.remark,
                issuedBy: userId,
                approvedByName: data.approvedByName,
                receivedByName: data.receivedByName,
                status: "completed",
                mrkoStatus: "OPEN",
            }).returning()

            for (const item of data.items) {
                await tx.insert(evhsVoucherItems).values({
                    voucherId: voucher.id,
                    productId: item.productId,
                    materialNumberCk: item.materialNumberCk,
                    qty: item.qty,
                    serialNumber: item.serialNumber,
                    stockBalance: item.stockBalance,
                    pos: item.pos,
                    unitId: item.unitId,
                })
            }

            return { success: true, vhsNo }
        })
    } catch (error) {
        console.error("Error creating VHS voucher:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to create voucher" }
    } finally {
        revalidatePath("/dashboard/evhs")
    }
}

const editUsageSchema = z.object({
    voucherId: z.number(),
    voucherItemId: z.number(),
    woNo: z.string().optional(),
    materialNumberCk: z.string().optional(),
    pos: z.string().optional(),
    unitId: z.string().optional(),
})

export async function updateEvhsUsage(data: z.infer<typeof editUsageSchema>) {
    try {
        await getAuthenticatedSession('evhs', 'edit')
        
        return await db.transaction(async (tx) => {
            if (data.woNo !== undefined) {
                await tx.update(evhsVouchers)
                    .set({ woNo: data.woNo })
                    .where(eq(evhsVouchers.id, data.voucherId))
            }
            
            await tx.update(evhsVoucherItems)
                .set({
                    materialNumberCk: data.materialNumberCk,
                    pos: data.pos,
                    unitId: data.unitId
                })
                .where(eq(evhsVoucherItems.id, data.voucherItemId))
                
            return { success: true }
        })
    } catch (error) {
        console.error("Error updating VHS usage:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to update usage" }
    } finally {
        revalidatePath("/dashboard/evhs")
    }
}

const editVoucherSchema = z.object({
    id: z.number(),
    woNo: z.string().optional(),
    date: z.date(),
    remark: z.string().optional(),
    approvedByName: z.string().optional(),
    receivedByName: z.string().optional(),
})

export async function updateEvhsVoucher(data: z.infer<typeof editVoucherSchema>) {
    try {
        await getAuthenticatedSession('evhs', 'edit')
        
        await db.update(evhsVouchers)
            .set({
                woNo: data.woNo,
                date: data.date.toISOString().slice(0, 10),
                remark: data.remark,
                approvedByName: data.approvedByName,
                receivedByName: data.receivedByName,
            })
            .where(eq(evhsVouchers.id, data.id))
            
        return { success: true }
    } catch (error) {
        console.error("Error updating VHS Voucher:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to update voucher" }
    } finally {
        revalidatePath("/dashboard/evhs")
    }
}

export async function deleteEvhsVoucher(voucherId: number) {
    try {
        await getAuthenticatedSession('evhs', 'delete')
        
        return await db.transaction(async (tx) => {
            // Revert all associated evhsVoucherItems to reset their voucher association
            await tx.delete(evhsVoucherItems)
                .where(eq(evhsVoucherItems.voucherId, voucherId))
                
            // Delete the voucher header
            await tx.delete(evhsVouchers)
                .where(eq(evhsVouchers.id, voucherId))
                
            return { success: true }
        })
    } catch (error) {
        console.error("Error deleting VHS Voucher:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to delete voucher" }
    } finally {
        revalidatePath("/dashboard/evhs")
    }
}

export async function getEvhsVouchers() {
    try {
        return await db.query.evhsVouchers.findMany({
            with: {
                items: {
                    with: {
                        product: true
                    }
                },
                warehouse: true,
                issuedByUser: true,
            },
            orderBy: [desc(evhsVouchers.createdAt)],
        })
    } catch (error) {
        console.error("Error fetching Vouchers:", error)
        return []
    }
}

/**
 * Fitur 3 — GI Records & Matching
 */
export async function getGiRecords() {
    try {
        return await db.query.evhsGiRecords.findMany({
            with: {
                items: true,
                warehouse: true
            },
            orderBy: [desc(evhsGiRecords.createdAt)]
        })
    } catch (error) {
        console.error("Error fetching GI records:", error)
        return []
    }
}

export async function createGiRecord(data: {
    warehouseId: number;
    periodDate: Date;
    documentNo?: string;
    woNo?: string;
    items: { materialNumber: string; qty: number; price?: number }[];
}) {
    try {
        return await db.transaction(async (tx) => {
            const [record] = await tx.insert(evhsGiRecords).values({
                warehouseId: data.warehouseId,
                periodDate: data.periodDate.toISOString().slice(0, 10), // Correct Date to string
                documentNo: data.documentNo,
                woNo: data.woNo,
                source: "manual",
            }).returning()

            for (const item of data.items) {
                await tx.insert(evhsGiItems).values({
                    giRecordId: record.id,
                    materialNumber: item.materialNumber,
                    qty: item.qty.toString(),
                    price: item.price?.toString(),
                    status: "pending",
                })
            }

            return { success: true, recordId: record.id }
        })
    } catch (error) {
        return { success: false, error: "Failed to create GI record" }
    }
}

/**
 * Fitur 6 — MRKO & Invoicing
 */
export async function updateMrko(data: {
    voucherId: number;
    mrkoStatus: string;
    mrkoNo?: string;
    sapInvoiceNo: string;
    settledDate?: Date;
}) {
    try {
        await getAuthenticatedSession('evhs', 'edit')
        
        await db.update(evhsVouchers)
            .set({
                mrkoStatus: data.mrkoStatus,
                mrkoNo: data.mrkoNo,
                sapInvoiceNo: data.sapInvoiceNo,
                settledDate: data.settledDate || new Date(),
                updatedAt: new Date()
            })
            .where(eq(evhsVouchers.id, data.voucherId))
            
        return { success: true }
    } catch (error) {
        console.error("Error updating MRKO:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to update MRKO" }
    } finally {
        revalidatePath("/dashboard/evhs")
    }
}

/**
 * Get Data specifically for MRKO & Invoicing tab
 * Includes Vouchers, GI Matching status, and SAP Invoice sync
 */
export async function getEvhsMrkoData() {
    try {
        const vouchers = await db.query.evhsVouchers.findMany({
            with: {
                items: { with: { product: true } },
                warehouse: true
            },
            orderBy: [desc(evhsVouchers.createdAt)]
        })

        const giRecords = await db.query.evhsGiRecords.findMany({
            with: { items: true }
        })

        // Fetch SAP Revenue to sync invoices
        const sapRevenue = await db.query.salesRevenueSap.findMany({
            where: eq(sql`customer_name`, "PT CIPTA KRIDATAMA")
        })

        return {
            vouchers,
            giRecords,
            sapRevenue
        }
    } catch (error) {
        console.error("Error fetching MRKO data:", error)
        return { vouchers: [], giRecords: [], sapRevenue: [] }
    }
}

/**
 * Fitur: Get Tracking Data (from Receipts to Vouchers)
 */
export async function getEvhsTrackingData() {
    try {
        const receipts = await db.query.evhsReceipts.findMany({
            with: {
                transfer: {
                    with: { toWarehouse: true }
                },
                items: {
                    with: { product: true }
                }
            },
            orderBy: [desc(evhsReceipts.receivedDate)]
        })
        
        const vouchers = await db.query.evhsVouchers.findMany({
            with: {
                items: true
            }
        })
        
        const giRecords = await db.query.evhsGiRecords.findMany({
            with: { items: true }
        })
        
        const trackingRows: any[] = []
        
        for (const receipt of receipts) {
            for (const item of receipt.items) {
                const sns = Array.isArray(item.serialNumbers) 
                    ? item.serialNumbers.filter(Boolean) 
                    : (typeof item.serialNumbers === "string" 
                        ? item.serialNumbers.split(/[\n,]+/).map((s: string) => s.trim()).filter(Boolean) 
                        : [])
                
                if (sns.length > 0) {
                    for (const sn of sns) {
                        let matchedVoucherItem = null
                        let matchedVoucher = null
                        for (const v of vouchers) {
                            const vi = v.items.find((i: any) => i.productId === item.productId && i.serialNumber === sn)
                            if (vi) {
                                matchedVoucherItem = vi
                                matchedVoucher = v
                                break
                            }
                        }
                        
                        let matchedGi = null
                        if (matchedVoucher && matchedVoucher.woNo) {
                            matchedGi = giRecords.find(g => g.items.some(gi => gi.materialNumber === matchedVoucherItem?.materialNumberCk) || (matchedVoucher?.woNo && g.documentNo === matchedVoucher.woNo))
                        }
                        
                        trackingRows.push({
                            id: `${item.id}-${sn}`,
                            dateIn: receipt.receivedDate,
                            cpDo: receipt.doChitraNo,
                            materialNumberCp: item.product.materialNumber,
                            materialNumberCk: matchedVoucherItem?.materialNumberCk || item.product.materialNumberCk || "-",
                            sn: sn,
                            qty: 1,
                            installDate: matchedVoucher?.date || null,
                            pos: matchedVoucherItem?.pos || "",
                            unitId: matchedVoucherItem?.unitId || "",
                            voucherNo: matchedVoucher?.vhsNo || "",
                            voucherId: matchedVoucher?.id || null,
                            voucherItemId: matchedVoucherItem?.id || null,
                            woNo: matchedVoucher?.woNo || "",
                            giNumber: matchedGi?.documentNo || "", 
                            mrko: matchedVoucher?.mrkoStatus === "SETTLED" ? "SETTLED" : (matchedVoucher ? "OPEN" : ""),
                            inv: matchedVoucher?.sapInvoiceNo || "",
                            date: matchedVoucher?.settledDate || null,
                            productId: item.productId,
                            product: item.product,
                            warehouseId: receipt.transfer?.toWarehouseId,
                            warehouse: receipt.transfer?.toWarehouse
                        })
                    }
                } else {
                    const itemUsages = []
                    for (const v of vouchers) {
                        for (const vi of v.items) {
                            if (vi.productId === item.productId && !vi.serialNumber) {
                                itemUsages.push({ voucher: v, voucherItem: vi })
                            }
                        }
                    }
                    
                    trackingRows.push({
                        id: `${item.id}-bulk`,
                        dateIn: receipt.receivedDate,
                        cpDo: receipt.doChitraNo,
                        materialNumberCp: item.product.materialNumber,
                        materialNumberCk: itemUsages.length > 0 && itemUsages[itemUsages.length-1].voucherItem.materialNumberCk 
                            ? itemUsages[itemUsages.length-1].voucherItem.materialNumberCk 
                            : (item.product.materialNumberCk || "-"),
                        sn: "-",
                        qty: item.confirmedQty,
                        installDate: itemUsages.length > 0 ? itemUsages[itemUsages.length-1].voucher.date : null,
                        pos: "",
                        unitId: "",
                        voucherNo: itemUsages.length > 0 ? (itemUsages.length > 1 ? "Multiple Usages" : itemUsages[0].voucher.vhsNo) : "",
                        voucherId: itemUsages.length === 1 ? itemUsages[0].voucher.id : null,
                        voucherItemId: itemUsages.length === 1 ? itemUsages[0].voucherItem.id : null,
                        woNo: itemUsages.length > 0 ? itemUsages[itemUsages.length-1].voucher.woNo : "",
                        giNumber: "",
                        mrko: "",
                        inv: "",
                        date: null,
                        productId: item.productId,
                        product: item.product,
                        warehouseId: receipt.transfer?.toWarehouseId,
                        warehouse: receipt.transfer?.toWarehouse
                    })
                }
            }
        }
        
        return trackingRows
    } catch (error) {
        console.error("Error fetching tracking data:", error)
        return []
    }
}
