import { db } from "../db"
import { evhsReceipts, evhsReceiptItems, stockTransfers, stockTransferItems } from "../db/schema"
import { eq, and } from "drizzle-orm"

async function main() {
    const warehouseId = 37 // CK MHU
    const productId = 604  // O-RING 3-49
    const qty = 7
    const doChitraNo = "MANUAL-RECEIPT-CKMHU-349"

    console.log("Memulai penambahan manual penerimaan E-VHS untuk O-RING 3-49 di CK MHU...")

    // Check if receipt already exists
    const existingReceipt = await db.query.evhsReceipts.findFirst({
        where: eq(evhsReceipts.doChitraNo, doChitraNo)
    })

    if (existingReceipt) {
        console.log(`Receipt dengan DO ${doChitraNo} sudah ada (ID: ${existingReceipt.id}). Melakukan cleanup/skip.`)
        process.exit(0)
    }

    await db.transaction(async (tx) => {
        // 1. Create Stock Transfer record
        const [transfer] = await tx.insert(stockTransfers).values({
            referenceNumber: `ST-MANUAL-CKMHU-349-${Date.now()}`,
            fromWarehouseId: warehouseId,
            toWarehouseId: warehouseId,
            status: "received",
            receivedStatus: "Received",
            notes: "Transfer manual stok awal E-VHS O-Ring 3-49 di CK MHU",
            transferDate: new Date(),
        }).returning()

        console.log("Stock Transfer dibuat:", transfer.id)

        // 2. Create Stock Transfer Item
        await tx.insert(stockTransferItems).values({
            transferId: transfer.id,
            productId: productId,
            quantity: qty,
        })

        // 3. Create EVHS Receipt Header
        const [receipt] = await tx.insert(evhsReceipts).values({
            transferId: transfer.id,
            receivedDate: new Date("2026-05-01T00:00:00.000Z"), // set backdate so it precedes usages
            doChitraNo: doChitraNo,
            notes: "Penambahan manual penerimaan E-VHS O-Ring 3-49 (7 pcs) untuk site CK MHU",
        }).returning()

        console.log("EVHS Receipt dibuat:", receipt.id)

        // 4. Create EVHS Receipt Item
        const [item] = await tx.insert(evhsReceiptItems).values({
            receiptId: receipt.id,
            productId: productId,
            confirmedQty: qty,
            serialNumbers: [],
        }).returning()

        console.log("EVHS Receipt Item dibuat:", item.id)
    })

    console.log("Penambahan data berhasil diselesaikan!")
    process.exit(0)
}

main().catch((err) => {
    console.error("Gagal menambahkan data:", err)
    process.exit(1)
})
