import { db } from "@/db";
import {
    whatsappRegisteredNumbers,
    whatsappNotificationLogs,
    quotations,
    customers,
    products,
    stockLevels,
    warehouses,
    quotationApprovalProgress,
    user,
} from "@/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { sendWhatsAppMessage } from "@/lib/ai/whatsapp-agent";

/**
 * 1. Notifikasi Pengajuan Approval Quotation ke Approver Aktif (Actionable WA)
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
                salesPersonId: quotations.salesPersonId,
            })
            .from(quotations)
            .leftJoin(customers, eq(quotations.customerId, customers.id))
            .where(eq(quotations.id, quotationId));

        if (!quo) return { success: false, error: "Quotation tidak ditemukan" };

        // Cari pending step pertama yang membutuhkan tindakan
        const pendingStep = await db
            .select()
            .from(quotationApprovalProgress)
            .where(
                and(
                    eq(quotationApprovalProgress.quotationId, quotationId),
                    eq(quotationApprovalProgress.status, "pending")
                )
            )
            .orderBy(quotationApprovalProgress.stepOrder)
            .limit(1)
            .then((r) => r[0]);

        let approvers = [];

        if (pendingStep?.assignedUserId) {
            // Ambil nomor WA user yang spesifik ditugaskan di step ini
            approvers = await db
                .select()
                .from(whatsappRegisteredNumbers)
                .where(
                    and(
                        eq(whatsappRegisteredNumbers.isActive, true),
                        eq(whatsappRegisteredNumbers.userId, pendingStep.assignedUserId)
                    )
                );
        }

        // Fallback: Jika belum ada nomor WA spesifik untuk assigned user, cari nomor role management/admin
        if (approvers.length === 0) {
            approvers = await db
                .select()
                .from(whatsappRegisteredNumbers)
                .where(
                    and(
                        eq(whatsappRegisteredNumbers.isActive, true),
                        sql`${whatsappRegisteredNumbers.role} IN ('management', 'admin')`
                    )
                );
        }

        if (approvers.length === 0) {
            console.log("[WA Notif] Tidak ada nomor approver/management yang terdaftar.");
            return { success: true, recipientsCount: 0 };
        }

        // Ambil nama sales
        let salesName = "Tim Sales";
        if (quo.salesPersonId) {
            const sUser = await db.select({ name: user.name }).from(user).where(eq(user.id, quo.salesPersonId)).limit(1).then((r) => r[0]);
            if (sUser?.name) salesName = sUser.name;
        }

        const validDateStr = quo.validUntil ? new Date(quo.validUntil).toLocaleDateString("id-ID") : "-";
        const qNum = quo.quotationNumber || `QUO-${quo.id}`;

        const message = `🔔 *PENGAJUAN APPROVAL QUOTATION*\n\n` +
            `Terdapat penawaran harga baru yang membutuhkan persetujuan Anda:\n` +
            `• *Nomor Penawaran:* ${qNum}\n` +
            `• *Customer:* ${quo.customerName || "Customer"}\n` +
            `• *Sales Person:* ${salesName}\n` +
            `• *Berlaku s/d:* ${validDateStr}\n` +
            (pendingStep?.stepLabel ? `• *Tahap Approval:* ${pendingStep.stepLabel}\n` : "") +
            `\n⚡ *Aksi Cepat via WhatsApp:*\n` +
            `Balas chat ini untuk memproses:\n` +
            `• *SETUJU ${qNum} [catatan]* (Contoh: SETUJU ${qNum} diskon disetujui)\n` +
            `• *TOLAK ${qNum} [alasan]* (Contoh: TOLAK ${qNum} harga terlalu rendah)\n\n` +
            `Atau tinjau dokumen via Web:\n` +
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
 * 2. Notifikasi Hasil Approval ke Sales Person (WhatsApp)
 */
export async function notifySalesQuotationResult(params: {
    quotationId: number;
    status: "approved" | "rejected";
    approverName: string;
    comment?: string;
}) {
    try {
        const [quo] = await db
            .select({
                id: quotations.id,
                quotationNumber: quotations.quotationNumber,
                salesPersonId: quotations.salesPersonId,
                customerName: customers.name,
            })
            .from(quotations)
            .leftJoin(customers, eq(quotations.customerId, customers.id))
            .where(eq(quotations.id, params.quotationId));

        if (!quo || !quo.salesPersonId) return { success: false, reason: "Sales person not found" };

        // Cari nomor WhatsApp milik Sales Person
        const salesNumber = await db
            .select()
            .from(whatsappRegisteredNumbers)
            .where(
                and(
                    eq(whatsappRegisteredNumbers.isActive, true),
                    eq(whatsappRegisteredNumbers.userId, quo.salesPersonId)
                )
            )
            .limit(1)
            .then((r) => r[0]);

        if (!salesNumber) {
            console.log(`[WA Notif] Sales user ${quo.salesPersonId} tidak memiliki nomor WA terdaftar.`);
            return { success: false, reason: "No WA registered for sales" };
        }

        const isApproved = params.status === "approved";
        const icon = isApproved ? "🎉" : "❌";
        const statusLabel = isApproved ? "TELAH DISETUJUI" : "DITOLAK";
        const qNum = quo.quotationNumber || `QUO-${quo.id}`;

        const message = `${icon} *STATUS PENGAJUAN QUOTATION: ${statusLabel}*\n\n` +
            `Pembaruan status penawaran Anda:\n` +
            `• *Nomor:* ${qNum}\n` +
            `• *Customer:* ${quo.customerName || "Customer"}\n` +
            `• *Oleh Approver:* ${params.approverName}\n` +
            `• *Catatan:* ${params.comment || "-"}\n\n` +
            (isApproved
                ? `Dokumen penawaran siap dikirimkan kepada pelanggan.\nLihat detail: ${process.env.NEXT_PUBLIC_APP_URL || "https://one.chitraparatama.com"}/dashboard/quotations/${quo.id}`
                : `Silakan lakukan penyesuaian penawaran pada dashboard web.`);

        await sendWhatsAppMessage(salesNumber.phoneNumber, message);
        await db.insert(whatsappNotificationLogs).values({
            eventType: isApproved ? "quotation_approved_result" : "quotation_rejected_result",
            recipientNumber: salesNumber.phoneNumber,
            recipientName: salesNumber.contactName,
            messageContent: message,
            referenceId: String(params.quotationId),
            status: "sent",
        });

        return { success: true };
    } catch (err: any) {
        console.error("Gagal mengirim notifikasi status ke sales:", err);
        return { success: false, error: err.message };
    }
}

/**
 * 3. Notifikasi Alert Stok Menipis (Di Bawah Min Stock)
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
 * 4. Broadcast Pesan Manual dari Admin
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
