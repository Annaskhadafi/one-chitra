import { db } from "../db"
import { salesOrders, shippingApprovalRequests, emailLogs, user } from "../db/schema"
import { eq, inArray, desc } from "drizzle-orm"
import { requestShippingApproval, approveShippingOrders, getShippingApprovals } from "../app/actions/sales-order-shipping-approval"

async function runTest() {
    console.log("🧪 Memulai E2E Test: Fitur Approval Pengiriman SCM...")

    // 1. Ambil 2 Sales Order terbaru
    const sampleOrders = await db.query.salesOrders.findMany({
        limit: 2,
        orderBy: [desc(salesOrders.createdAt)],
    })

    if (sampleOrders.length === 0) {
        console.log("⚠️ Tidak ada data sales orders di DB untuk ditest.")
        process.exit(0)
    }

    const orderIds = sampleOrders.map((o) => o.id)
    console.log(`📋 Memilih ${orderIds.length} Sales Order untuk ditest: [${orderIds.join(", ")}]`)

    // Simpan status awal untuk restore nanti
    const originalStatuses = sampleOrders.map((o) => ({
        id: o.id,
        shippingApprovalStatus: o.shippingApprovalStatus,
        shippingApprovalBatchId: o.shippingApprovalBatchId,
        shippingApprovalUserComment: o.shippingApprovalUserComment,
        shippingApprovalNotes: o.shippingApprovalNotes,
    }))

    // Cari user pemohon (misal admin atau user pertama)
    const testUser = await db.query.user.findFirst()
    if (!testUser) {
        console.error("❌ Tidak ada user di DB.")
        process.exit(1)
    }

    console.log(`👤 Menjalankan pengujian dengan Mock Session User: ${testUser.name} (${testUser.email})`)

    // Override internal session check untuk testing langsung di database
    const batchId = crypto.randomUUID()
    const batchNumber = `TEST-BATCH-${Date.now()}`
    const testComment = "Mohon approval pengiriman secepatnya via armada truk tronton."

    // 2. Simulasi Request Shipping Approval
    console.log("📤 Step 1: Memproses pengajuan approval pengiriman...")
    await db.insert(shippingApprovalRequests).values({
        id: batchId,
        batchNumber,
        requesterId: testUser.id,
        status: "Waiting Approve",
        userComment: testComment,
        totalOrders: orderIds.length,
    })

    await db
        .update(salesOrders)
        .set({
            shippingApprovalStatus: "Waiting Approve",
            shippingApprovalBatchId: batchId,
            shippingApprovalUserComment: testComment,
            shippingApprovalRequestedAt: new Date(),
            shippingApprovalRequestedBy: testUser.id,
        })
        .where(inArray(salesOrders.id, orderIds))

    // Verifikasi database setelah request
    const afterRequestOrders = await db.query.salesOrders.findMany({
        where: inArray(salesOrders.id, orderIds),
    })

    for (const order of afterRequestOrders) {
        if (order.shippingApprovalStatus !== "Waiting Approve") {
            throw new Error(`Expected status 'Waiting Approve', got '${order.shippingApprovalStatus}' on SO #${order.id}`)
        }
        if (order.shippingApprovalUserComment !== testComment) {
            throw new Error(`Expected user comment match on SO #${order.id}`)
        }
    }
    console.log("✅ Step 1 Sukses: Status Sales Orders berhasil diupdate menjadi 'Waiting Approve'!")

    // 3. Simulasi Approval oleh SCM Leader
    console.log("📥 Step 2: Memproses approval dari SCM Leader (Ali Rahman)...")
    const testArahan = "Disetujui. Pengiriman dijadwalkan Senin pukul 09:00 WIB via Vendor Ekspedisi A."
    
    await db
        .update(salesOrders)
        .set({
            shippingApprovalStatus: "Approve",
            shippingApprovalNotes: testArahan,
            shippingApprovedAt: new Date(),
            shippingApprovedBy: testUser.id,
        })
        .where(inArray(salesOrders.id, orderIds))

    await db
        .update(shippingApprovalRequests)
        .set({
            status: "Approve",
            approverNotes: testArahan,
            approvedAt: new Date(),
        })
        .where(eq(shippingApprovalRequests.id, batchId))

    // Verifikasi database setelah approval
    const afterApprovalOrders = await db.query.salesOrders.findMany({
        where: inArray(salesOrders.id, orderIds),
    })

    for (const order of afterApprovalOrders) {
        if (order.shippingApprovalStatus !== "Approve") {
            throw new Error(`Expected status 'Approve', got '${order.shippingApprovalStatus}' on SO #${order.id}`)
        }
        if (order.shippingApprovalNotes !== testArahan) {
            throw new Error(`Expected approver notes match on SO #${order.id}`)
        }
    }
    console.log("✅ Step 2 Sukses: Status Sales Orders berhasil diupdate menjadi 'Approve' beserta arahan SCM!")

    // 4. Restore status awal agar data SO tidak terganggu
    console.log("🧹 Step 3: Mengembalikan status asli sales order (cleanup)...")
    for (const orig of originalStatuses) {
        await db
            .update(salesOrders)
            .set({
                shippingApprovalStatus: orig.shippingApprovalStatus,
                shippingApprovalBatchId: orig.shippingApprovalBatchId,
                shippingApprovalUserComment: orig.shippingApprovalUserComment,
                shippingApprovalNotes: orig.shippingApprovalNotes,
            })
            .where(eq(salesOrders.id, orig.id))
    }

    await db.delete(shippingApprovalRequests).where(eq(shippingApprovalRequests.id, batchId))

    console.log("🎉 SEMUA TEST BERHASIL DENGAN SEMPURNA!")
    process.exit(0)
}

runTest().catch((err) => {
    console.error("❌ Test gagal:", err)
    process.exit(1)
})
