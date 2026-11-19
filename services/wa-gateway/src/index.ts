import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import pino from "pino";
import path from "path";
import fs from "fs";
import qrcode from "qrcode";
import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    WASocket,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";

dotenv.config();

const PORT = process.env.WA_GATEWAY_PORT || 3001;
const AUTH_DIR =
    process.env.WA_AUTH_DIR ||
    (fs.existsSync("/app/uploads")
        ? "/app/uploads/baileys_auth"
        : fs.existsSync("/app/baileys_auth")
        ? "/app/baileys_auth"
        : path.join(__dirname, "..", "baileys_auth"));
const WEBHOOK_URL =
    process.env.WA_WEBHOOK_URL ||
    "http://127.0.0.1:3000/api/whatsapp/webhook";
const GATEWAY_SECRET = process.env.WA_GATEWAY_SECRET || "och-wa-secret-token";

const logger = pino({ level: process.env.LOG_LEVEL || "info" });

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// State
let sock: WASocket | null = null;
let connectionStatus: "disconnected" | "connecting" | "qr_ready" | "connected" = "disconnected";
let currentQrCode: string | null = null;
let currentQrDataUrl: string | null = null;
let connectedUser: { id: string; name?: string } | null = null;

// Ensure auth dir exists
if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
}

/**
 * Inisialisasi WhatsApp Baileys Socket
 */
async function startWhatsAppSocket() {
    connectionStatus = "connecting";
    logger.info("Memulai WhatsApp Baileys connection...");

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version, isLatest } = await fetchLatestBaileysVersion();
    logger.info(`Menggunakan Baileys v${version.join(".")} (isLatest: ${isLatest})`);

    sock = makeWASocket({
        version,
        logger: pino({ level: "silent" }) as any,
        printQRInTerminal: true,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }) as any),
        },
        generateHighQualityLinkPreview: true,
        syncFullHistory: false,
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            currentQrCode = qr;
            currentQrDataUrl = await qrcode.toDataURL(qr);
            connectionStatus = "qr_ready";
            logger.info("QR Code baru di-generate, siap di-scan");
        }

        if (connection === "close") {
            const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            logger.warn(`Koneksi terputus. Status code: ${statusCode}, Reconnect: ${shouldReconnect}`);

            connectionStatus = "disconnected";
            currentQrCode = null;
            currentQrDataUrl = null;
            connectedUser = null;

            if (shouldReconnect) {
                setTimeout(startWhatsAppSocket, 5000);
            } else {
                logger.warn("Perangkat Logout dari WhatsApp. Menghapus auth dir...");
                fs.rmSync(AUTH_DIR, { recursive: true, force: true });
            }
        } else if (connection === "open") {
            connectionStatus = "connected";
            currentQrCode = null;
            currentQrDataUrl = null;
            const user = sock?.user;
            connectedUser = {
                id: user?.id ? user.id.split(":")[0] : "unknown",
                name: user?.name,
            };
            logger.info(`WhatsApp terhubung sebagai: ${connectedUser.id} (${connectedUser.name || ""})`);
        }
    });

    // Handle Incoming Messages
    sock.ev.on("messages.upsert", async ({ messages, type }) => {
        if (type !== "notify") return;

        for (const msg of messages) {
            // Abaikan pesan dari diri sendiri atau broadcast status
            if (msg.key.fromMe) continue;
            if (msg.key.remoteJid === "status@broadcast") continue;

            const fromJid = msg.key.remoteJid || "";
            // Format phone number
            const phoneNumber = fromJid.split("@")[0];
            const senderName = msg.pushName || "";

            // Extract message text
            let text = "";
            if (msg.message?.conversation) {
                text = msg.message.conversation;
            } else if (msg.message?.extendedTextMessage?.text) {
                text = msg.message.extendedTextMessage.text;
            } else if (msg.message?.imageMessage?.caption) {
                text = msg.message.imageMessage.caption;
            } else if (msg.message?.documentMessage?.caption) {
                text = msg.message.documentMessage.caption;
            }

            if (!text.trim()) continue;

            logger.info(`Pesan masuk dari ${phoneNumber} (${senderName}): ${text}`);

            // Forward to Next.js Webhook
            try {
                const response = await fetch(WEBHOOK_URL, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-wa-gateway-secret": GATEWAY_SECRET,
                    },
                    body: JSON.stringify({
                        messageId: msg.key.id,
                        phoneNumber,
                        fromJid,
                        senderName,
                        text: text.trim(),
                        timestamp: msg.messageTimestamp,
                    }),
                });

                if (!response.ok) {
                    logger.error(`Webhook Next.js mengembalikan error HTTP ${response.status}`);
                }
            } catch (err: any) {
                logger.error(`Gagal memanggil webhook Next.js (${WEBHOOK_URL}): ${err?.message}`);
            }
        }
    });
}

/**
 * Helper JID Formatter
 */
function formatToJid(phone: string): string {
    const cleaned = phone.replace(/[^0-9]/g, "");
    const formatted = cleaned.startsWith("0") ? `62${cleaned.slice(1)}` : cleaned;
    return `${formatted}@s.whatsapp.net`;
}

// REST API Endpoints

// 1. Status Connection
app.get("/api/status", (_req: Request, res: Response) => {
    res.json({
        status: connectionStatus,
        user: connectedUser,
        qr: currentQrDataUrl,
        uptime: process.uptime(),
    });
});

// 2. Reconnect
app.post("/api/reconnect", async (_req: Request, res: Response) => {
    try {
        if (sock) {
            sock.end(undefined);
        }
        await startWhatsAppSocket();
        res.json({ success: true, message: "Menginisialisasi ulang koneksi WhatsApp" });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. Logout
app.post("/api/logout", async (_req: Request, res: Response) => {
    try {
        if (sock) {
            await sock.logout();
        }
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        connectionStatus = "disconnected";
        connectedUser = null;
        currentQrCode = null;
        currentQrDataUrl = null;
        res.json({ success: true, message: "Berhasil logout dan menghapus sesi WhatsApp" });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 4. Send Message (Text)
app.post("/api/send-message", async (req: Request, res: Response) => {
    try {
        const { to, text } = req.body;
        if (!to || !text) {
            return res.status(400).json({ success: false, error: "Parameter 'to' dan 'text' wajib disertakan" });
        }

        if (connectionStatus !== "connected" || !sock) {
            return res.status(503).json({ success: false, error: "WhatsApp belum terhubung (status: " + connectionStatus + ")" });
        }

        const jid = formatToJid(to);
        const sent = await sock.sendMessage(jid, { text });

        res.json({
            success: true,
            messageId: sent?.key.id,
            to: jid,
        });
    } catch (err: any) {
        logger.error(`Gagal mengirim pesan ke ${req.body?.to}: ${err.message}`);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 5. Send Document (PDF / file buffer / remote URL)
app.post("/api/send-document", async (req: Request, res: Response) => {
    try {
        const { to, documentUrl, base64Data, fileName, caption, mimeType } = req.body;
        if (!to || (!documentUrl && !base64Data)) {
            return res.status(400).json({ success: false, error: "Parameter 'to' dan 'documentUrl'/'base64Data' wajib disertakan" });
        }

        if (connectionStatus !== "connected" || !sock) {
            return res.status(503).json({ success: false, error: "WhatsApp belum terhubung" });
        }

        const jid = formatToJid(to);
        let buffer: Buffer;

        if (base64Data) {
            buffer = Buffer.from(base64Data, "base64");
        } else {
            const fileRes = await fetch(documentUrl);
            if (!fileRes.ok) {
                throw new Error(`Gagal mengunduh dokumen dari URL: HTTP ${fileRes.status}`);
            }
            const arrayBuf = await fileRes.arrayBuffer();
            buffer = Buffer.from(arrayBuf);
        }

        const sent = await sock.sendMessage(jid, {
            document: buffer,
            mimetype: mimeType || "application/pdf",
            fileName: fileName || "document.pdf",
            caption: caption || undefined,
        });

        res.json({
            success: true,
            messageId: sent?.key.id,
            to: jid,
            fileName,
        });
    } catch (err: any) {
        logger.error(`Gagal mengirim dokumen: ${err.message}`);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Start Server
app.listen(Number(PORT), "0.0.0.0", () => {
    logger.info(`WhatsApp Gateway Service berjalan pada port ${PORT}`);
    startWhatsAppSocket().catch((err) => {
        logger.error("Gagal memulai WhatsApp socket:", err);
    });
});
