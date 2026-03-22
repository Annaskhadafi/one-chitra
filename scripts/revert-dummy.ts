import "dotenv/config"
import { db } from "../db"
import {
    deliveries,
    deliveryItems,
    stockLevels,
    stockMovements,
    stockTransfers,
    stockTransferItems,
    salesOrders
} from "../db/schema"
import { eq, inArray, sql, and } from "drizzle-orm"

async function run() {
    const targetNumbers = ["DLV-20260312-0002", "DLV-20260312-0003"]
    console.log(`[CLEANUP] Persiapan menghapus Data Dummy: ${targetNumbers.join(", ")}...\n`)

    try {
        const targetDeliveries = await db.query.deliveries.findMany({
            where: inArray(deliveries.deliveryNumber, targetNumbers),
            with: { items: true },
        })

        if (targetDeliveries.length === 0) {
            console.log("[PASS] Tidak ada data pengiriman dengan nomor tersebut (kemungkinan sudah dihapus).")
            process.exit(0)
        }

        console.log(`[CLEANUP] Menemukan ${targetDeliveries.length} data yang cocok. Membuka Transaksi Database...`)

        await db.transaction(async (tx) => {
            const affectedSoIds = new Set<number>()

            for (const order of targetDeliveries) {
                console.log(` \n>>> Mulai perbaikan [${order.deliveryNumber}] (ID: ${order.id})`)
                affectedSoIds.add(order.salesOrderId)

                // 1. REKAM JEJAK & PEMULIHAN STOK (Jika tidak Cancelled)
                if (order.status !== "cancelled" && order.warehouseId) {
                    console.log(`    -> Sistem mendeteksi pemotongan stok pada gudang ID ${order.warehouseId}. Memulihkan...`)
                    for (const item of order.items) {
                        if (item.deliveredQuantity > 0) {
                            // Kembalikan saldo!
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
                } else {
                    console.log("    -> Data ini 'cancelled' atau tiada Gudang, tidak perlu pemulihan Stok.")
                }

                // 2. HAPUS STOCK MOVEMENTS Historikal (Histori Mutasi)
                if (order.deliveryNumber) {
                    console.log("    -> Membersihkan riwayat 'Stock Movements' (Buku Mutasi)...")
                    // Termasuk pergerakan AUTO ST (Transfer) jika ada
                    const stAutoRef = `ST-AUTO-${order.deliveryNumber}`
                    await tx.delete(stockMovements)
                        .where(inArray(stockMovements.referenceNumber, [order.deliveryNumber, stAutoRef]))
                }

                // 3. HAPUS STOCK TRANSFERS & ITEMS
                console.log("    -> Menghapus jejak 'Stock Transfers' terkait...")
                const transfers = await tx.query.stockTransfers.findMany({
                    where: eq(stockTransfers.deliveryId, order.id)
                })

                for (const t of transfers) {
                    await tx.delete(stockTransferItems).where(eq(stockTransferItems.transferId, t.id))
                    await tx.delete(stockTransfers).where(eq(stockTransfers.id, t.id))
                }

                // 4. HAPUS DELIVERY ITEMS
                console.log("    -> Menghancurkan muatan list barang (Delivery Items)...")
                await tx.delete(deliveryItems).where(eq(deliveryItems.deliveryId, order.id))

                // 5. HAPUS ENTITAS DELIVERY
                console.log(`    -> Menghapus Induk Delivery: ${order.deliveryNumber}...`)
                await tx.delete(deliveries).where(eq(deliveries.id, order.id))
            }

            console.log(`\n[CLEANUP] Memeriksa Sales Orders yang terkena dampaknya...`)
            for (const soId of Array.from(affectedSoIds)) {
                console.log(`    -> Mensinkronisasi ulang status SO ID ${soId} ke 'confirmed' agar bisa digunakan secara normal.`)
                await tx.update(salesOrders)
                    .set({ status: "confirmed", updatedAt: new Date() })
                    .where(eq(salesOrders.id, soId))
            }

            console.log("\n[SUCCESS] Pembersihan Tuntas dan Stok Berhasil Dikembalikan! Commit Database.")
        })

    } catch (error) {
        console.error("\n[ERROR FATAL] Gagal menghapus Data Dummy:", error)
        process.exit(1)
    }
}

run()
