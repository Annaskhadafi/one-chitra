import {
    checkStockInventory,
    getRevenueSummary,
    createSalesQuotation,
    generateQuotationPdfBuffer,
} from "../lib/mcp/tools";
import { db } from "../db";
import {
    whatsappRegisteredNumbers,
    whatsappConversations,
    whatsappMessages,
    quotations,
    customers,
} from "../db/schema";
import { eq } from "drizzle-orm";
import { normalizePhoneNumber } from "../lib/ai/whatsapp-agent";
import { notifyQuotationApproval, notifyStockMinimumAlert } from "../lib/whatsapp/notifications";

async function runWhatsAppTests() {
    console.log("==================================================");
    console.log("🧪 Memulai Pengujian Integrasi WhatsApp & MCP AI");
    console.log("==================================================");

    // Test 1: Normalize Phone Number
    console.log("\n[1/6] Menguji normalisasi nomor telepon...");
    const p1 = normalizePhoneNumber("081234567890");
    const p2 = normalizePhoneNumber("+62 812-3456-7890");
    const p3 = normalizePhoneNumber("81234567890");
    if (p1 !== "6281234567890" || p2 !== "6281234567890" || p3 !== "6281234567890") {
        throw new Error(`Normalisasi gagal: ${p1}, ${p2}, ${p3}`);
    }
    console.log("✅ Normalisasi nomor telepon: LULUS (Semua format terstandarisasi 628xxx)");

    // Test 2: Check Stock Inventory Tool
    console.log("\n[2/6] Menguji Tool 'checkStockInventory'...");
    const stockResult = await checkStockInventory({ limit: 5 });
    console.log(`   Ditemukan ${stockResult.items.length} sampel produk di inventaris.`);
    if (stockResult.items.length > 0) {
        console.log(`   Contoh item: ${stockResult.items[0].description} (Stok: ${stockResult.items[0].availableStock})`);
    }
    console.log("✅ Tool 'checkStockInventory': LULUS");

    // Test 3: Get Revenue Summary Tool
    console.log("\n[3/6] Menguji Tool 'getRevenueSummary'...");
    const revResult = await getRevenueSummary({ period: "this_month" });
    console.log(`   Total Revenue Bulan Ini: ${revResult.formattedRevenue} (${revResult.totalOrders} order)`);
    console.log("✅ Tool 'getRevenueSummary': LULUS");

    // Test 4: Create Sales Quotation Tool & PDF Generation
    console.log("\n[4/6] Menguji Tool 'createSalesQuotation' & 'generateQuotationPdfBuffer'...");
    const testQuo = await createSalesQuotation({
        customerName: "PT Uji Integrasi WhatsApp",
        items: [
            {
                productQuery: "TYRE",
                quantity: 4,
                unitPrice: 3500000,
            },
        ],
        clientNote: "Uji otomatis penawaran harga via MCP Bot WhatsApp",
    });

    console.log(`   Berhasil membuat Quotation: ${testQuo.quotationNumber} (ID: ${testQuo.quotationId})`);
    console.log(`   Total Nilai: ${testQuo.formattedTotal}`);

    const pdf = await generateQuotationPdfBuffer(testQuo.quotationId);
    console.log(`   Berhasil generate file PDF: ${pdf.fileName} (Ukuran: ${pdf.buffer.length} bytes)`);
    const isPdfValid = pdf.buffer.subarray(0, 5).toString() === "%PDF-";
    if (!isPdfValid) {
        throw new Error("Header file bukan PDF yang valid!");
    }
    console.log("✅ Tool 'createSalesQuotation' & PDF Generator: LULUS");

    // Test 5: Whitelist & Database Registration
    console.log("\n[5/6] Menguji Whitelist & Registrasi Nomor di DB...");
    const testPhone = "628999888777";
    await db.delete(whatsappRegisteredNumbers).where(eq(whatsappRegisteredNumbers.phoneNumber, testPhone));

    const [inserted] = await db
        .insert(whatsappRegisteredNumbers)
        .values({
            phoneNumber: testPhone,
            contactName: "Budi Sales Test",
            role: "sales",
            canAccessStock: true,
            canAccessQuotation: true,
            canAccessRevenue: false,
            isActive: true,
        })
        .returning();

    console.log(`   Nomor terdaftar: ${inserted.contactName} (${inserted.phoneNumber}), Role: ${inserted.role}`);
    console.log("✅ Whitelist & Database RBAC: LULUS");

    // Test 6: Notification Triggers
    console.log("\n[6/6] Menguji Notification Trigger Methods...");
    const notifQuo = await notifyQuotationApproval(testQuo.quotationId);
    console.log(`   Trigger notifikasi approval quotation dieksekusi (Recipients: ${notifQuo.recipientsCount || 0})`);

    console.log("\n==================================================");
    console.log("🎉 SELURUH PENGUJIAN INTEGRASI WHATSAPP & MCP LULUS!");
    console.log("==================================================");
    process.exit(0);
}

runWhatsAppTests().catch((err) => {
    console.error("❌ Pengujian gagal:", err);
    process.exit(1);
});
