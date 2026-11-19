import { db } from "@/db";
import {
    whatsappRegisteredNumbers,
    whatsappConversations,
    whatsappMessages,
    quotations,
    quotationApprovalProgress,
} from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import {
    NineRouterClient,
    AiChatMessage,
    AiToolDefinition,
} from "./9router-client";
import {
    checkStockInventory,
    getRevenueSummary,
    createSalesQuotation,
    generateQuotationPdfBuffer,
    getPendingApprovals,
    getQuotationDetail,
    getCustomerInfo,
    getDeliveryStatus,
} from "@/lib/mcp/tools";
import { notifySalesQuotationResult } from "@/lib/whatsapp/notifications";

const WA_GATEWAY_URL = process.env.WA_GATEWAY_URL || "http://127.0.0.1:3001";

/**
 * Standardize Indonesian phone number to format 628xxx
 */
export function normalizePhoneNumber(raw: string): string {
    const cleaned = raw.replace(/[^0-9]/g, "");
    if (cleaned.startsWith("0")) {
        return `62${cleaned.slice(1)}`;
    }
    if (cleaned.startsWith("8")) {
        return `62${cleaned}`;
    }
    return cleaned;
}

/**
 * Send WhatsApp text message via Gateway
 */
export async function sendWhatsAppMessage(to: string, text: string) {
    try {
        const res = await fetch(`${WA_GATEWAY_URL}/api/send-message`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ to, text }),
        });
        return await res.json();
    } catch (err: any) {
        console.error("Gagal mengirim WhatsApp message via gateway:", err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Send WhatsApp document (PDF) via Gateway
 */
export async function sendWhatsAppDocument(to: string, options: {
    base64Data?: string;
    documentUrl?: string;
    fileName: string;
    caption?: string;
}) {
    try {
        const res = await fetch(`${WA_GATEWAY_URL}/api/send-document`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                to,
                base64Data: options.base64Data,
                documentUrl: options.documentUrl,
                fileName: options.fileName,
                caption: options.caption,
                mimeType: "application/pdf",
            }),
        });
        return await res.json();
    } catch (err: any) {
        console.error("Gagal mengirim WhatsApp document via gateway:", err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Main WhatsApp AI Agent Handler
 */
export async function processWhatsAppIncomingMessage(params: {
    phoneNumber: string;
    senderName?: string;
    text: string;
    messageId?: string;
}) {
    const phone = normalizePhoneNumber(params.phoneNumber);
    const userText = params.text.trim();

    console.log(`[WA Agent] Memproses pesan dari ${phone} (${params.senderName}): "${userText}"`);

    // 1. Validasi Whitelist & RBAC
    const registered = await db
        .select()
        .from(whatsappRegisteredNumbers)
        .where(eq(whatsappRegisteredNumbers.phoneNumber, phone))
        .limit(1)
        .then((res) => res[0]);

    if (!registered) {
        const unregReply = `Halo ${params.senderName || ""}, nomor WhatsApp Anda (*${phone}*) belum terdaftar di sistem ONE-CHITRA AI Bot.\n\nSilakan hubungi Administrator untuk mendaftarkan nomor dan hak akses Anda.`;
        await sendWhatsAppMessage(phone, unregReply);
        return { success: false, reason: "unregistered" };
    }

    if (!registered.isActive) {
        const inactiveReply = `Mohon maaf ${registered.contactName}, akun WhatsApp Anda saat ini berstatus *Non-Aktif*. Silakan hubungi Administrator ONE-CHITRA.`;
        await sendWhatsAppMessage(phone, inactiveReply);
        return { success: false, reason: "inactive" };
    }

    // 2. Conversation & History
    let conversation = await db
        .select()
        .from(whatsappConversations)
        .where(eq(whatsappConversations.phoneNumber, phone))
        .limit(1)
        .then((res) => res[0]);

    if (!conversation) {
        const [newConv] = await db
            .insert(whatsappConversations)
            .values({
                phoneNumber: phone,
                context: {},
                lastMessageAt: new Date(),
            })
            .returning();
        conversation = newConv;
    } else {
        await db
            .update(whatsappConversations)
            .set({ lastMessageAt: new Date(), updatedAt: new Date() })
            .where(eq(whatsappConversations.id, conversation.id));
    }

    // Simpan pesan masuk user ke database
    await db.insert(whatsappMessages).values({
        conversationId: conversation.id,
        phoneNumber: phone,
        direction: "inbound",
        messageType: "text",
        content: userText,
        status: "delivered",
    });

    const contextObj = (conversation.context as any) || {};

    // =========================================================================
    // 3. FITUR UTAMA: INTERACTIVE TWO-WAY APPROVAL DENGAN DUA LANGKAH KONFIRMASI
    // =========================================================================

    // 3A. Tangani Jawaban Konfirmasi ("YA" atau "BATAL")
    if (contextObj.pendingApproval) {
        const pending = contextObj.pendingApproval;
        const isExpired = Date.now() > (pending.expiresAt || 0);

        if (isExpired) {
            await db.update(whatsappConversations).set({ context: {} }).where(eq(whatsappConversations.id, conversation.id));
            const expiredMsg = `⏱️ Sesi konfirmasi untuk penawaran *${pending.quotationNumber}* telah kedaluwarsa.\nSilakan ketik ulang perintah approval (contoh: *SETUJU ${pending.quotationNumber}*).`;
            await sendWhatsAppMessage(phone, expiredMsg);
            await db.insert(whatsappMessages).values({
                conversationId: conversation.id,
                phoneNumber: phone,
                direction: "outbound",
                content: expiredMsg,
            });
            return { success: true, processed: "approval_expired" };
        }

        const normalizedCmd = userText.toLowerCase().trim();
        if (/^(ya|yes|ok|setuju|confirm|lanjut)$/i.test(normalizedCmd)) {
            const isApproved = pending.action === "approve";
            const newStatus = isApproved ? "approved" : "rejected";

            // 1. Update quotation_approval_progress
            await db
                .update(quotationApprovalProgress)
                .set({
                    status: newStatus,
                    actedAt: new Date(),
                    comment: pending.comment || (isApproved ? "Disetujui via WhatsApp Bot" : "Ditolak via WhatsApp Bot"),
                })
                .where(eq(quotationApprovalProgress.id, pending.progressId));

            // 2. Cek apakah seluruh langkah approval telah disetujui
            if (isApproved) {
                const remainingSteps = await db
                    .select()
                    .from(quotationApprovalProgress)
                    .where(
                        and(
                            eq(quotationApprovalProgress.quotationId, pending.quotationId),
                            eq(quotationApprovalProgress.status, "pending")
                        )
                    );

                if (remainingSteps.length === 0) {
                    await db
                        .update(quotations)
                        .set({
                            status: "approved",
                            approvedAt: new Date(),
                            approvedBy: registered.userId || "whatsapp-bot",
                        })
                        .where(eq(quotations.id, pending.quotationId));
                }
            } else {
                await db
                    .update(quotations)
                    .set({
                        status: "rejected",
                        rejectedAt: new Date(),
                        rejectedBy: registered.userId || "whatsapp-bot",
                        rejectionReason: pending.comment || "Ditolak via WhatsApp",
                    })
                    .where(eq(quotations.id, pending.quotationId));
            }

            // 3. Clear Context
            await db.update(whatsappConversations).set({ context: {} }).where(eq(whatsappConversations.id, conversation.id));

            // 4. Balas ke Approver
            const successReply = isApproved
                ? `✅ *BERHASIL DISETUJUI!*\n\nPenawaran *${pending.quotationNumber}* telah resmi disetujui.\n• Catatan: ${pending.comment || "-"}\n\nNotifikasi otomatis telah dikirimkan ke Sales terkait.`
                : `❌ *PENAWARAN DITOLAK!*\n\nPenawaran *${pending.quotationNumber}* telah ditandai ditolak.\n• Alasan: ${pending.comment || "-"}\n\nSales terkait telah diberitahu untuk melakukan revisi.`;

            await sendWhatsAppMessage(phone, successReply);
            await db.insert(whatsappMessages).values({
                conversationId: conversation.id,
                phoneNumber: phone,
                direction: "outbound",
                content: successReply,
            });

            // 5. Trigger Notifikasi ke Sales Person via WhatsApp
            await notifySalesQuotationResult({
                quotationId: pending.quotationId,
                status: isApproved ? "approved" : "rejected",
                approverName: registered.contactName,
                comment: pending.comment,
            });

            return { success: true, processed: "approval_executed" };
        } else if (/^(batal|cancel|tidak|no|stop)$/i.test(normalizedCmd)) {
            await db.update(whatsappConversations).set({ context: {} }).where(eq(whatsappConversations.id, conversation.id));
            const cancelReply = `Tindakan approval untuk *${pending.quotationNumber}* telah *DIBATALKAN*. Status penawaran tidak berubah.`;
            await sendWhatsAppMessage(phone, cancelReply);
            await db.insert(whatsappMessages).values({
                conversationId: conversation.id,
                phoneNumber: phone,
                direction: "outbound",
                content: cancelReply,
            });
            return { success: true, processed: "approval_cancelled" };
        }
    }

    // 3B. Tangani Perintah Awal Approval (contoh: "SETUJU QUO/2026/11/0001 diskon ok" atau "TOLAK QUO/...")
    const approveMatch = userText.match(/^(?:approve|setuju|acc)\s+(quo\/[a-zA-Z0-9\/\-_]+|\d+)(.*)$/i);
    const rejectMatch = userText.match(/^(?:reject|tolak)\s+(quo\/[a-zA-Z0-9\/\-_]+|\d+)(.*)$/i);

    if (approveMatch || rejectMatch) {
        const isApprove = !!approveMatch;
        const match = (approveMatch || rejectMatch)!;
        const targetQuery = match[1].trim();
        const userComment = match[2].trim();

        // Cari quotation detail
        const quoRes = await getQuotationDetail({ quotationQuery: targetQuery });
        if (!quoRes.found || !quoRes.quotation) {
            const notFoundMsg = `Penawaran dengan nomor atau ID "*${targetQuery}*" tidak ditemukan di sistem.`;
            await sendWhatsAppMessage(phone, notFoundMsg);
            return { success: false, reason: "not_found" };
        }

        const quo = quoRes.quotation;

        // Cari pending approval step aktif untuk quotation ini
        const pendingStep = await db
            .select()
            .from(quotationApprovalProgress)
            .where(
                and(
                    eq(quotationApprovalProgress.quotationId, quo.id),
                    eq(quotationApprovalProgress.status, "pending")
                )
            )
            .orderBy(quotationApprovalProgress.stepOrder)
            .limit(1)
            .then((r) => r[0]);

        if (!pendingStep) {
            const notPendingMsg = `Penawaran *${quo.quotationNumber}* saat ini berstatus *${quo.status}* dan tidak sedang menunggu approval.`;
            await sendWhatsAppMessage(phone, notPendingMsg);
            return { success: false, reason: "no_pending_step" };
        }

        // Validasi otoritas approver
        const isAssigned = registered.userId && registered.userId === pendingStep.assignedUserId;
        const isExecutive = registered.role === "management" || registered.role === "admin";

        if (!isAssigned && !isExecutive) {
            const deniedMsg = `Mohon maaf ${registered.contactName}, penawaran *${quo.quotationNumber}* ini saat ini sedang ditugaskan kepada PIC approval lain (${pendingStep.stepLabel}).`;
            await sendWhatsAppMessage(phone, deniedMsg);
            return { success: false, reason: "unauthorized" };
        }

        // Simpan sesi pending approval ke context untuk safety confirmation
        const pendingData = {
            quotationId: quo.id,
            quotationNumber: quo.quotationNumber,
            progressId: pendingStep.id,
            action: isApprove ? "approve" : "reject",
            comment: userComment || (isApprove ? "Disetujui via WhatsApp" : "Ditolak via WhatsApp"),
            expiresAt: Date.now() + 10 * 60 * 1000, // 10 menit
        };

        await db
            .update(whatsappConversations)
            .set({ context: { ...contextObj, pendingApproval: pendingData } })
            .where(eq(whatsappConversations.id, conversation.id));

        // Kirim Ringkasan & Permintaan Konfirmasi Dua Langkah
        const confirmPrompt = `⚠️ *KONFIRMASI ${isApprove ? "PERSETUJUAN" : "PENOLAKAN"} PENAWARAN*\n\n` +
            `Mohon konfirmasi tindakan Anda:\n` +
            `• *Nomor Quotation:* ${quo.quotationNumber}\n` +
            `• *Customer:* ${quo.customerName}\n` +
            `• *Sales Person:* ${quo.salesPersonName}\n` +
            `• *Total Nilai:* ${quo.formattedTotal}\n` +
            `• *Estimasi Margin:* ${quo.estimatedMarginPct}%\n` +
            `• *Tahap Approval:* ${pendingStep.stepLabel}\n` +
            `• *Tindakan:* ${isApprove ? "SETUJU (APPROVE)" : "TOLAK (REJECT)"}\n` +
            `• *Catatan:* ${pendingData.comment}\n\n` +
            `👉 Balas *YA* untuk memproses tindakan ini sekarang.\n` +
            `👉 Balas *BATAL* untuk membatalkan.`;

        await sendWhatsAppMessage(phone, confirmPrompt);
        await db.insert(whatsappMessages).values({
            conversationId: conversation.id,
            phoneNumber: phone,
            direction: "outbound",
            content: confirmPrompt,
        });

        return { success: true, processed: "confirmation_requested" };
    }

    // =========================================================================
    // 4. SUSUN MULTI-TURN HISTORY & TOOLS AI AGENT
    // =========================================================================

    const recentMessages = await db
        .select()
        .from(whatsappMessages)
        .where(eq(whatsappMessages.conversationId, conversation.id))
        .orderBy(desc(whatsappMessages.createdAt))
        .limit(8);

    const history: AiChatMessage[] = recentMessages.reverse().map((m) => ({
        role: m.direction === "inbound" ? "user" : "assistant",
        content: m.content,
    }));

    const availableTools: AiToolDefinition[] = [];

    // Tool 1: Check Stock
    if (registered.canAccessStock) {
        availableTools.push({
            type: "function",
            function: {
                name: "check_stock_inventory",
                description: "Mengecek stok produk dan ketersediaan barang di gudang ONE-CHITRA.",
                parameters: {
                    type: "object",
                    properties: {
                        query: { type: "string", description: "Nama atau kode barang atau ukuran ban (misal: '12.00R24')" },
                        warehouseName: { type: "string", description: "Nama gudang jika spesifik (misal: Balikpapan)" },
                    },
                },
            },
        });
    }

    // Tool 2: Revenue Summary (Finansial)
    if (registered.canAccessRevenue) {
        availableTools.push({
            type: "function",
            function: {
                name: "get_revenue_summary",
                description: "Mengambil data omset penjualan dan performa finansial ONE-CHITRA.",
                parameters: {
                    type: "object",
                    properties: {
                        period: { type: "string", enum: ["today", "this_month", "this_year"], description: "Periode analisa omset" },
                    },
                },
            },
        });
    }

    // Tool 3: Create Sales Quotation
    if (registered.canAccessQuotation) {
        availableTools.push({
            type: "function",
            function: {
                name: "create_sales_quotation",
                description: "Membuat penawaran harga (Quotation) resmi dan nomor quotation di ONE-CHITRA.",
                parameters: {
                    type: "object",
                    properties: {
                        customerName: { type: "string", description: "Nama perusahaan / customer pembeli" },
                        items: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    productQuery: { type: "string", description: "Nama barang / part number" },
                                    quantity: { type: "number", description: "Jumlah unit barang" },
                                    unitPrice: { type: "number", description: "Harga satuan per unit jika diminta" },
                                },
                                required: ["productQuery", "quantity"],
                            },
                        },
                        clientNote: { type: "string", description: "Catatan penawaran" },
                    },
                    required: ["customerName", "items"],
                },
            },
        });
    }

    // Tool 4: Pending Approvals (Untuk Management/Approver/Sales)
    availableTools.push({
        type: "function",
        function: {
            name: "get_pending_approvals",
            description: "Melihat daftar penawaran harga (Quotation) yang sedang menunggu persetujuan (approval) dari user pengirim.",
            parameters: {
                type: "object",
                properties: {},
            },
        },
    });

    // Tool 5: Quotation Detail & Margin
    availableTools.push({
        type: "function",
        function: {
            name: "get_quotation_detail",
            description: "Melihat rincian barang, harga, estimasi margin %, serta progress rantai approval untuk suatu quotation.",
            parameters: {
                type: "object",
                properties: {
                    quotationQuery: { type: "string", description: "Nomor quotation (misal QUO/2026/11/0001) atau ID angka" },
                },
                required: ["quotationQuery"],
            },
        },
    });

    // Tool 6: Customer Info & History
    availableTools.push({
        type: "function",
        function: {
            name: "get_customer_info",
            description: "Mencari profil pelanggan, alamat, kontak person, dan riwayat pesanan (Sales Orders) terakhir.",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "Nama pelanggan atau kode customer" },
                },
                required: ["query"],
            },
        },
    });

    // Tool 7: Delivery / DO Status
    availableTools.push({
        type: "function",
        function: {
            name: "get_delivery_status",
            description: "Melacak status Surat Jalan pengiriman barang (DO), armada truk, nama supir, dan estimasi tiba.",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "Nomor Delivery / Surat Jalan, nomor DO SAP, atau nopol truk" },
                },
                required: ["query"],
            },
        },
    });

    // 5. System Prompt
    const systemPrompt = `Anda adalah ONE-CHITRA Executive Assistant, AI bot cerdas terintegrasi ERP PT Chitra Paratama.
Pengguna yang sedang berinteraksi:
- Nama: ${registered.contactName}
- Role: ${registered.role}
- Nomor HP: ${phone}
- Hak Akses: Revenue=${registered.canAccessRevenue}, Stok=${registered.canAccessStock}, Quotation=${registered.canAccessQuotation}

Kemampuan Sistem Anda:
1. Cek Stok Produk aktual di gudang (check_stock_inventory).
2. Laporan Revenue & Omset penjualan perusahaan (get_revenue_summary) - jika diizinkan.
3. Buat Quotation resmi & otomatis cetak kirim PDF ke WhatsApp (create_sales_quotation).
4. Cek antrean Approval pending bagi Approver / Direksi (get_pending_approvals).
5. Cek rincian penawaran & analisa margin keuntungan (get_quotation_detail).
6. Cek data pelanggan, PIC, dan riwayat belanja (get_customer_info).
7. Lacak status Surat Jalan (DO), supir, dan armada (get_delivery_status).
8. Approval Cepat: Jelaskan bahwa approver bisa langsung mengetik *SETUJU [Nomor QUO] [catatan]* atau *TOLAK [Nomor QUO] [alasan]* untuk memproses approval dengan konfirmasi instan.

Aturan Penting:
- Jawablah dengan format WhatsApp yang rapi, profesional, dan padat: gunakan *tebal* untuk angka/status penting dan bullet (-) untuk daftar.
- Selalu panggil tool fungsi aktual untuk mengecek fakta, dilarang menebak data.`;

    const messagesToSend: AiChatMessage[] = [
        { role: "system", content: systemPrompt },
        ...history,
    ];

    // 6. Eksekusi AI Client (9Router / OpenAI)
    const client = new NineRouterClient();
    const response = await client.chatCompletion(messagesToSend, availableTools);

    let assistantReply = response.message?.content || "";
    const executedToolCalls: any[] = [];
    let quotationToDeliver: { quotationId: number; quotationNumber: string } | null = null;

    if (response.message?.tool_calls && response.message.tool_calls.length > 0) {
        const toolCalls = response.message.tool_calls;
        messagesToSend.push(response.message);

        for (const tc of toolCalls) {
            const funcName = tc.function.name;
            let args: any = {};
            try {
                args = JSON.parse(tc.function.arguments);
            } catch {
                args = {};
            }

            console.log(`[WA Agent] Menjalankan tool: ${funcName}`, args);
            let toolOutput: any;

            if (funcName === "check_stock_inventory") {
                toolOutput = await checkStockInventory(args);
            } else if (funcName === "get_revenue_summary") {
                if (!registered.canAccessRevenue) {
                    toolOutput = { error: "Akses ditolak: Anda tidak memiliki wewenang melihat data revenue." };
                } else {
                    toolOutput = await getRevenueSummary(args);
                }
            } else if (funcName === "create_sales_quotation") {
                if (!registered.canAccessQuotation) {
                    toolOutput = { error: "Akses ditolak: Anda tidak memiliki wewenang membuat quotation." };
                } else {
                    toolOutput = await createSalesQuotation({
                        ...args,
                        salesPersonId: registered.userId || undefined,
                    });
                    if (toolOutput.success) {
                        quotationToDeliver = {
                            quotationId: toolOutput.quotationId,
                            quotationNumber: toolOutput.quotationNumber,
                        };
                    }
                }
            } else if (funcName === "get_pending_approvals") {
                toolOutput = await getPendingApprovals({
                    userId: registered.userId || undefined,
                    phoneNumber: phone,
                });
            } else if (funcName === "get_quotation_detail") {
                toolOutput = await getQuotationDetail(args);
            } else if (funcName === "get_customer_info") {
                toolOutput = await getCustomerInfo(args);
            } else if (funcName === "get_delivery_status") {
                toolOutput = await getDeliveryStatus(args);
            }

            executedToolCalls.push({ name: funcName, args, result: toolOutput });

            messagesToSend.push({
                role: "tool",
                name: funcName,
                tool_call_id: tc.id,
                content: JSON.stringify(toolOutput),
            });
        }

        const secondTurn = await client.chatCompletion(messagesToSend);
        assistantReply = secondTurn.message?.content || "Selesai diproses.";
    }

    // 7. Kirim Balasan ke WhatsApp User
    await sendWhatsAppMessage(phone, assistantReply);

    // Kirim PDF jika membuat quotation
    if (quotationToDeliver) {
        try {
            const pdf = await generateQuotationPdfBuffer(quotationToDeliver.quotationId);
            await sendWhatsAppDocument(phone, {
                base64Data: pdf.buffer.toString("base64"),
                fileName: pdf.fileName,
                caption: `📄 Dokumen Resmi Penawaran: ${quotationToDeliver.quotationNumber}`,
            });
        } catch (pdfErr: any) {
            console.error("Gagal mengirim PDF quotation via WA:", pdfErr.message);
        }
    }

    // 8. Simpan Outbound Message ke DB
    await db.insert(whatsappMessages).values({
        conversationId: conversation.id,
        phoneNumber: phone,
        direction: "outbound",
        messageType: quotationToDeliver ? "document" : "text",
        content: assistantReply,
        toolCalls: executedToolCalls,
        status: "sent",
    });

    return {
        success: true,
        reply: assistantReply,
        toolCallsCount: executedToolCalls.length,
        deliveredPdf: !!quotationToDeliver,
    };
}
