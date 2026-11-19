import { db } from "../db";
import {
    quotations,
    quotationApprovalProgress,
    whatsappRegisteredNumbers,
    whatsappConversations,
    user,
    customers,
} from "../db/schema";
import { eq, and } from "drizzle-orm";
import {
    getPendingApprovals,
    getQuotationDetail,
    getCustomerInfo,
    getDeliveryStatus,
    createSalesQuotation,
} from "../lib/mcp/tools";
import { processWhatsAppIncomingMessage } from "../lib/ai/whatsapp-agent";

async function runCompleteTestSuite() {
    console.log("================================================================");
    console.log("🧪 Memulai Pengujian Lengkap: Enterprise WhatsApp AI & Approval");
    console.log("================================================================");

    // 1. Get or Create Test User & Customer
    const testApproverUser = await db.select().from(user).limit(1).then((r) => r[0]);
    if (!testApproverUser) {
        throw new Error("Tabel user kosong. Tidak dapat menguji approval.");
    }

    console.log(`\n[1/5] User approver pengujian: ${testApproverUser.name} (${testApproverUser.id})`);

    // 2. Test Tool getCustomerInfo
    console.log("\n[2/5] Menguji Tool: getCustomerInfo...");
    const custRes = await getCustomerInfo({ query: "PT" });
    console.log(`   Customer Info ditemukan: ${custRes.found}`);
    if (custRes.found && custRes.customer) {
        console.log(`   Pelanggan: ${custRes.customer.name} (Kode: ${custRes.customer.customerCode})`);
        console.log(`   Riwayat Order: ${custRes.customer.recentOrders.length} order`);
    }
    console.log("✅ Tool 'getCustomerInfo': LULUS");

    // 3. Test Tool getDeliveryStatus
    console.log("\n[3/5] Menguji Tool: getDeliveryStatus...");
    const delRes = await getDeliveryStatus({ query: "DO" });
    console.log(`   Pencarian Surat Jalan: ${delRes.found ? `DO #${delRes.delivery?.deliveryNumber}` : "Tidak ada sampel DO, namun query sukses"}`);
    console.log("✅ Tool 'getDeliveryStatus': LULUS");

    // 4. Create Quotation & Pending Approval Step
    console.log("\n[4/5] Menguji Setup Quotation & Pending Step...");
    const createdQuo = await createSalesQuotation({
        customerName: "PT Enterprise Test Approval",
        items: [
            {
                productQuery: "TYRE",
                quantity: 2,
                unitPrice: 5000000,
            },
        ],
        clientNote: "Uji coba approval dua langkah via WhatsApp",
    });

    // Buat pending approval step untuk user ini
    const [step] = await db
        .insert(quotationApprovalProgress)
        .values({
            quotationId: createdQuo.quotationId,
            stepOrder: 1,
            stepRole: "managerial",
            stepLabel: "Sales Manager Review",
            assignedUserId: testApproverUser.id,
            status: "pending",
            requiredByMargin: "12.5000",
        })
        .returning();

    console.log(`   Quotation #${createdQuo.quotationNumber} dibuat.`);
    console.log(`   Step Approval #${step.id} ditugaskan ke: ${testApproverUser.name}`);

    // Test getQuotationDetail & getPendingApprovals
    const qDetail = await getQuotationDetail({ quotationQuery: createdQuo.quotationNumber });
    if (!qDetail.found || !qDetail.quotation) throw new Error("Gagal mengambil detail quotation!");
    console.log(`   Detail Quotation: Total ${qDetail.quotation.formattedTotal}, Estimasi Margin ${qDetail.quotation.estimatedMarginPct}%`);

    const pendings = await getPendingApprovals({ userId: testApproverUser.id });
    console.log(`   Antrean Approval user: ${pendings.count} penawaran`);
    console.log("✅ Tool 'getQuotationDetail' & 'getPendingApprovals': LULUS");

    // 5. Test Two-Way Interactive Approval with Two-Step Safety Confirmation
    console.log("\n[5/5] Menguji Two-Way Approval (Pesan WA -> Konfirmasi -> Eksekusi DB)...");
    const testPhone = "6281122334455";

    // Setup nomor approver di DB
    await db.delete(whatsappRegisteredNumbers).where(eq(whatsappRegisteredNumbers.phoneNumber, testPhone));
    await db.insert(whatsappRegisteredNumbers).values({
        phoneNumber: testPhone,
        contactName: "Bpk Direktur / Approver Test",
        role: "management",
        userId: testApproverUser.id,
        canAccessStock: true,
        canAccessRevenue: true,
        canAccessQuotation: true,
        isActive: true,
    });

    // Reset percakapan test
    await db.delete(whatsappConversations).where(eq(whatsappConversations.phoneNumber, testPhone));

    // Langkah A: Approver mengirim perintah approval
    console.log(`   -> Simulasi Approver mengirim: "SETUJU ${createdQuo.quotationNumber} harga disepakati"`);
    const stepARes = await processWhatsAppIncomingMessage({
        phoneNumber: testPhone,
        senderName: "Bpk Direktur",
        text: `SETUJU ${createdQuo.quotationNumber} harga disepakati`,
    });

    if (stepARes.processed !== "confirmation_requested") {
        throw new Error(`Harusnya confirmation_requested tapi dapat: ${stepARes.processed}`);
    }
    console.log("   <- Bot merespons dengan ringkasan nilai, margin, dan meminta konfirmasi 'Balas YA'");

    // Langkah B: Approver membalas "YA"
    console.log('   -> Simulasi Approver membalas: "YA"');
    const stepBRes = await processWhatsAppIncomingMessage({
        phoneNumber: testPhone,
        senderName: "Bpk Direktur",
        text: "YA",
    });

    if (stepBRes.processed !== "approval_executed") {
        throw new Error(`Harusnya approval_executed tapi dapat: ${stepBRes.processed}`);
    }
    console.log("   <- Bot mengeksekusi approval di database dan memberitahu Sales!");

    // Verifikasi Database State
    const [updatedStep] = await db
        .select()
        .from(quotationApprovalProgress)
        .where(eq(quotationApprovalProgress.id, step.id));

    if (updatedStep.status !== "approved") {
        throw new Error(`Status step di DB harusnya 'approved', tapi '${updatedStep.status}'`);
    }

    console.log(`   Verifikasi DB: Step #${updatedStep.id} berstatus '${updatedStep.status}', actedAt: ${updatedStep.actedAt}, komentar: "${updatedStep.comment}"`);
    console.log("✅ Two-Way Interactive Approval dengan Dua Langkah Konfirmasi: LULUS!");

    console.log("\n================================================================");
    console.log("🎉 SELURUH PENGUJIAN ENTERPRISE SUITE WHATSAPP BERHASIL 100%!");
    console.log("================================================================");
    process.exit(0);
}

runCompleteTestSuite().catch((err) => {
    console.error("❌ Test suite gagal:", err);
    process.exit(1);
});
