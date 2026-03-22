import { db } from "@/db"
import {
    deliveries,
    deliveryItems,
    stockLevels,
    stockMovements,
    stockTransfers,
    stockTransferItems,
    salesOrders,
    evhsReceipts,
    evhsReceiptItems
} from "@/db/schema"
import { eq, inArray, sql, and } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
    const targetNumbers = ["DLV-20260312-0002", "DLV-20260312-0003"]
    let logs: string[] = []
    const log = (msg: string) => { console.log(msg); logs.push(msg) }

    log(`[CLEANUP API] Persiapan menghapus Data Dummy: ${targetNumbers.join(", ")}...\n`)

    try {
        const targetDeliveries = await db.query.deliveries.findMany({
            where: inArray(deliveries.deliveryNumber, targetNumbers),
            with: { items: true },
        })

        if (targetDeliveries.length === 0) {
            log("[PASS] Tidak ada data pengiriman dengan nomor tersebut (kemungkinan sudah dihapus).")
            return NextResponse.json({ success: true, logs })
        }

        log(`[CLEANUP API] Menemukan ${targetDeliveries.length} data. Memulai transaksi...`)

        await db.transaction(async (tx) => {
            const affectedSoIds = new Set<number>()

            for (const order of targetDeliveries) {
                log(`\n>>> Mulai perbaikan [${order.deliveryNumber}] (ID: ${order.id})`)
                affectedSoIds.add(order.salesOrderId)

                // 1. REKAM JEJAK & PEMULIHAN STOK
                if (order.status !== "cancelled" && order.warehouseId) {
                    log(`    -> Sistem mendeteksi pemotongan stok pada gudang ID ${order.warehouseId}. Memulihkan...`)
                    for (const item of order.items) {
                        if (item.deliveredQuantity > 0) {
                            await tx.update(stockLevels)
                                .set({
                                    totalStock: sql`${stockLevels.totalStock} + ${item.deliveredQuantity}`,
                                    bookedStock: sql`${stockLevels.bookedStock} + ${item.deliveredQuantity}`,
                                    updatedAt: new Date(),
                                })
                                .where(and(
                                    eq(stockLevels.warehouseId, order.warehouseId),
                                    eq(stockLevels.productId, item.productId)
                                ))
                        }
                    }
                }

                // 2. HAPUS STOCK MOVEMENTS Historikal 
                if (order.deliveryNumber) {
                    log("    -> Membersihkan riwayat 'Stock Movements'...")
                    const stAutoRef = `ST-AUTO-${order.deliveryNumber}`
                    await tx.delete(stockMovements)
                        .where(inArray(stockMovements.referenceNumber, [order.deliveryNumber, stAutoRef]))
                }

                // 3. HAPUS EVHS RECEIPTS, STOCK TRANSFERS & ITEMS
                log("    -> Menghapus jejak 'Stock Transfers' dan 'EVHS Receipts' terkait...")
                const transfers = await tx.query.stockTransfers.findMany({
                    where: eq(stockTransfers.deliveryId, order.id)
                })

                for (const t of transfers) {
                    // Hapus EVHS Receipts
                    const evhsRcp = await tx.query.evhsReceipts.findMany({
                        where: eq(evhsReceipts.transferId, t.id)
                    })
                    for (const rcp of evhsRcp) {
                        await tx.delete(evhsReceiptItems).where(eq(evhsReceiptItems.receiptId, rcp.id))
                        await tx.delete(evhsReceipts).where(eq(evhsReceipts.id, rcp.id))
                    }

                    await tx.delete(stockTransferItems).where(eq(stockTransferItems.transferId, t.id))
                    await tx.delete(stockTransfers).where(eq(stockTransfers.id, t.id))
                }

                // 4. HAPUS DELIVERY ITEMS
                log("    -> Menghapus Delivery Items...")
                await tx.delete(deliveryItems).where(eq(deliveryItems.deliveryId, order.id))

                // 5. HAPUS ENTITAS DELIVERY
                log(`    -> Menghapus Induk Delivery: ${order.deliveryNumber}...`)
                await tx.delete(deliveries).where(eq(deliveries.id, order.id))
            }

            log(`\n[CLEANUP API] Memeriksa Sales Orders (SO) terdampak...`)
            for (const soId of Array.from(affectedSoIds)) {
                log(`    -> Memastikan SO ID ${soId} berstatus 'confirmed'.`)
                await tx.update(salesOrders)
                    .set({ status: "confirmed", updatedAt: new Date() })
                    .where(eq(salesOrders.id, soId))
            }
        })

        log("\n[SUCCESS] Pembersihan Tuntas!")
        return NextResponse.json({ success: true, logs })

    } catch (error: any) {
        log(`\n[ERROR] ${error.message}`)
        return NextResponse.json({ success: false, error: error.message, logs }, { status: 500 })
    }
}
