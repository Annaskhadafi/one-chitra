import { db } from "@/db";
import {
    whatsappRegisteredNumbers,
    whatsappConversations,
    whatsappMessages,
} from "@/db/schema";
import { eq, desc } from "drizzle-orm";
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
} from "@/lib/mcp/tools";

const WA_GATEWAY_URL = process.env.WA_GATEWAY_URL || "http://localhost:3001";

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

    // Ambil histori pesan terakhir (multi-turn memory)
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

    // 3. Susun Tools berdasarkan Hak Akses (RBAC)
    const availableTools: AiToolDefinition[] = [];

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

    // 4. System Prompt
    const systemPrompt = `Anda adalah ONE-CHITRA Assistant, AI bot cerdas terintegrasi ERP PT Chitra Paratama.
Pengguna yang sedang chat:
- Nama: ${registered.contactName}
- Role: ${registered.role}
- Akses Revenue: ${registered.canAccessRevenue ? "Diizinkan" : "TIDAK DIIZINKAN"}
- Akses Stok: ${registered.canAccessStock ? "Diizinkan" : "TIDAK DIIZINKAN"}
- Akses Quotation: ${registered.canAccessQuotation ? "Diizinkan" : "TIDAK DIIZINKAN"}

Petunjuk Menjawab:
1. Bersikaplah sopan, profesional, dan ringkas. Gunakan Bahasa Indonesia yang natural.
2. Gunakan format WhatsApp: *tebal* untuk poin penting, bullet point (-) untuk daftar barang.
3. JANGAN mengarang data stok atau omset! Selalu panggil tool fungsi yang tersedia untuk mengecek data aktual sistem.
4. Jika pengguna bertanya omset/revenue tetapi hak aksesnya "TIDAK DIIZINKAN", tolak dengan sopan bahwa rolenya tidak memiliki kewenangan melihat laporan finansial.
5. Saat membuat quotation baru, sistem akan otomatis mencetak dan mengirimkan file PDF penawaran ke chat ini. Jelaskan ringkasan penawaran, nomor quotation, dan beritahu bahwa file PDF resmi terlampir.`;

    const messagesToSend: AiChatMessage[] = [
        { role: "system", content: systemPrompt },
        ...history,
    ];

    // 5. Eksekusi AI Client (9Router / OpenAI)
    const client = new NineRouterClient();
    const response = await client.chatCompletion(messagesToSend, availableTools);

    let assistantReply = response.message?.content || "";
    const executedToolCalls: any[] = [];
    let quotationToDeliver: { quotationId: number; quotationNumber: string } | null = null;

    // Jika Model memanggil Tool
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
            }

            executedToolCalls.push({ name: funcName, args, result: toolOutput });

            messagesToSend.push({
                role: "tool",
                name: funcName,
                tool_call_id: tc.id,
                content: JSON.stringify(toolOutput),
            });
        }

        // Panggil kembali model setelah tool output terkumpul
        const secondTurn = await client.chatCompletion(messagesToSend);
        assistantReply = secondTurn.message?.content || "Selesai diproses.";
    }

    // 6. Kirim Balasan ke WhatsApp User
    await sendWhatsAppMessage(phone, assistantReply);

    // Jika ada pembuatan quotation, kirimkan PDF penawarannya secara langsung
    if (quotationToDeliver) {
        try {
            console.log(`[WA Agent] Menghasilkan PDF untuk Quotation #${quotationToDeliver.quotationId}`);
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

    // 7. Simpan Pesan Keluar Bot ke DB
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
