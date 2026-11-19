import { db } from "@/db";
import {
    whatsappRegisteredNumbers,
    whatsappNotificationLogs,
    quotations,
    customers,
    products,
    stockLevels,
    warehouses,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { sendWhatsAppMessage } from "@/lib/ai/whatsapp-agent";

/**
 * 1. Notifikasi Approval Quotation ke Approver / Management
 */
export async function notifyQuotationApproval(quotationId: number) {
    try {
        const [quo] = await db
            .select({
                id: quotations.id,
                quotationNumber: quotations.quotationNumber,
                total: quotations.discount,
                customerName: customers.name,
                validUntil: quotations.validUntil,
            })
            .from(quotations)
            .leftJoin(customers, eq(quotations.customerId, customers.id))
            .where(eq(quotations.id, quotationId));

        if (!quo) return { success: false, error: "Quotation tidak ditemukan" };

        // Cari nomor WhatsApp ber-role management/admin yang aktif
        const approvers = await db
            .select()
            .from(whatsappRegisteredNumbers)
            .where(
                and(
                    eq(whatsappRegisteredNumbers.isActive, true),
                    sql`${whatsappRegisteredNumbers.role} IN ('management', 'admin')`
                )
            );

        if (approvers.length === 0) {
            console.log("[WA Notif] Tidak ada nomor approver/management yang terdaftar.");
            return { success: true, recipientsCount: 0 };
        }

        const validDateStr = quo.validUntil ? new Date(quo.validUntil).toLocaleDateString("id-ID") : "-";
        const message = `🔔 *PENGAJUAN APPROVAL QUOTATION*\n\n` +
            `Terdapat penawaran harga baru yang membutuhkan persetujuan:\n` +
            `• *Nomor:* ${quo.quotationNumber || `QUO-${quo.id}`}\n` +
            `• *Customer:* ${quo.customerName || "Customer"}\n` +
            `• *Berlaku s/d:* ${validDateStr}\n\n` +
            `Silakan tinjau dan lakukan approval melalui Dashboard ONE-CHITRA:\n` +
            `${process.env.NEXT_PUBLIC_APP_URL || "https://one.chitraparatama.com"}/dashboard/quotations/${quo.id}`;

        for (const app of approvers) {
            await sendWhatsAppMessage(app.phoneNumber, message);
            await db.insert(whatsappNotificationLogs).values({
                eventType: "quotation_approval",
                recipientNumber: app.phoneNumber,
                recipientName: app.contactName,
                messageContent: message,
                referenceId: String(quotationId),
                status: "sent",
            });
        }

        return { success: true, recipientsCount: approvers.length };
    } catch (err: any) {
        console.error("Gagal mengirim notifikasi approval quotation:", err);
        return { success: false, error: err.message };
    }
}

/**
 * 2. Notifikasi Alert Stok Menipis (Di Bawah Min Stock)
 */
export async function notifyStockMinimumAlert(productId: number, warehouseId: number) {
    try {
        const [prod] = await db.select().from(products).where(eq(products.id, productId));
        const [wh] = await db.select().from(warehouses).where(eq(warehouses.id, warehouseId));
        const [stock] = await db
            .select()
            .from(stockLevels)
            .where(and(eq(stockLevels.productId, productId), eq(stockLevels.warehouseId, warehouseId)));

        if (!prod || !wh || !stock) return { success: false, error: "Data stok tidak lengkap" };

        const available = Math.max(0, (stock.totalStock || 0) - (stock.bookedStock || 0) - (stock.draftBookedStock || 0));

        // Cari nomor bagian inventory / warehouse
        const inventoryStaff = await db
            .select()
            .from(whatsappRegisteredNumbers)
            .where(
                and(
                    eq(whatsappRegisteredNumbers.isActive, true),
                    sql`${whatsappRegisteredNumbers.role} IN ('inventory', 'admin', 'management')`
                )
            );

        const message = `⚠️ *PERINGATAN STOK MINIMUM (LOW STOCK)*\n\n` +
            `Stok barang berada di batas aman:\n` +
            `• *Barang:* ${prod.materialNumber} - ${prod.materialDescription}\n` +
            `• *Gudang:* ${wh.description || wh.sloc}\n` +
            `• *Sisa Stok Available:* ${available} unit\n` +
            `• *Batas Min. Stok:* ${stock.minStock || 0} unit\n\n` +
            `Harap segera lakukan restocking atau koordinasi pengadaan barang.`;

        for (const staff of inventoryStaff) {
            await sendWhatsAppMessage(staff.phoneNumber, message);
            await db.insert(whatsappNotificationLogs).values({
                eventType: "stock_minimum_alert",
                recipientNumber: staff.phoneNumber,
                recipientName: staff.contactName,
                messageContent: message,
                referenceId: `${productId}-${warehouseId}`,
                status: "sent",
            });
        }

        return { success: true, recipientsCount: inventoryStaff.length };
    } catch (err: any) {
        console.error("Gagal mengirim notifikasi stok minimum:", err);
        return { success: false, error: err.message };
    }
}

/**
 * 3. Broadcast Pesan Manual dari Admin
 */
export async function broadcastCustomMessage(params: {
    phoneNumbers: string[];
    message: string;
    senderAdminName?: string;
}) {
    const results = [];
    for (const phone of params.phoneNumbers) {
        const res = await sendWhatsAppMessage(phone, params.message);
        await db.insert(whatsappNotificationLogs).values({
            eventType: "broadcast",
            recipientNumber: phone,
            messageContent: params.message,
            status: res.success ? "sent" : "failed",
            errorMessage: res.error || null,
        });
        results.push({ phone, ...res });
    }
    return { success: true, total: params.phoneNumbers.length, results };
}
