import { NextRequest, NextResponse } from "next/server";
import { processWhatsAppIncomingMessage } from "@/lib/ai/whatsapp-agent";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { phoneNumber, senderName, text, messageId } = body;

        if (!phoneNumber || !text) {
            return NextResponse.json(
                { success: false, error: "Parameter 'phoneNumber' dan 'text' wajib ada." },
                { status: 400 }
            );
        }

        // Jalankan pemrosesan pesan melalui WhatsApp AI Agent
        const result = await processWhatsAppIncomingMessage({
            phoneNumber,
            senderName,
            text,
            messageId,
        });

        return NextResponse.json({
            success: true,
            result,
        });
    } catch (err: any) {
        console.error("Error pada webhook WhatsApp:", err);
        return NextResponse.json(
            { success: false, error: err.message },
            { status: 500 }
        );
    }
}

export async function GET() {
    return NextResponse.json({
        status: "active",
        service: "ONE-CHITRA WhatsApp Webhook Receiver",
    });
}
