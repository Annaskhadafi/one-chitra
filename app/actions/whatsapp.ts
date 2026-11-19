"use server";

import { db } from "@/db";
import {
    whatsappRegisteredNumbers,
    whatsappMessages,
    whatsappNotificationLogs,
} from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { broadcastCustomMessage } from "@/lib/whatsapp/notifications";
import { normalizePhoneNumber } from "@/lib/ai/whatsapp-agent";

const WA_GATEWAY_URL = process.env.WA_GATEWAY_URL || "http://127.0.0.1:3001";

/**
 * 1. Gateway Status & QR
 */
export async function getGatewayStatusAction() {
    try {
        const res = await fetch(`${WA_GATEWAY_URL}/api/status`, {
            cache: "no-store",
        });
        if (!res.ok) {
            return { success: false, status: "offline", error: `HTTP ${res.status}` };
        }
        const data = await res.json();
        return { success: true, ...data };
    } catch (err: any) {
        return { success: false, status: "offline", error: err.message };
    }
}

export async function reconnectGatewayAction() {
    try {
        const res = await fetch(`${WA_GATEWAY_URL}/api/reconnect`, {
            method: "POST",
        });
        const data = await res.json();
        revalidatePath("/dashboard/whatsapp");
        return data;
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function logoutGatewayAction() {
    try {
        const res = await fetch(`${WA_GATEWAY_URL}/api/logout`, {
            method: "POST",
        });
        const data = await res.json();
        revalidatePath("/dashboard/whatsapp");
        return data;
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

/**
 * 2. Registered Numbers (Whitelist & RBAC)
 */
export async function getRegisteredNumbersAction() {
    try {
        const list = await db
            .select()
            .from(whatsappRegisteredNumbers)
            .orderBy(desc(whatsappRegisteredNumbers.createdAt));
        return { success: true, data: list };
    } catch (err: any) {
        return { success: false, error: err.message, data: [] };
    }
}

export async function createRegisteredNumberAction(params: {
    phoneNumber: string;
    contactName: string;
    role: string;
    canAccessRevenue?: boolean;
    canAccessStock?: boolean;
    canAccessQuotation?: boolean;
    canReceiveBroadcast?: boolean;
    isActive?: boolean;
    notes?: string;
}) {
    try {
        const phone = normalizePhoneNumber(params.phoneNumber);
        const [inserted] = await db
            .insert(whatsappRegisteredNumbers)
            .values({
                phoneNumber: phone,
                contactName: params.contactName.trim(),
                role: params.role || "sales",
                canAccessRevenue: params.canAccessRevenue ?? false,
                canAccessStock: params.canAccessStock ?? true,
                canAccessQuotation: params.canAccessQuotation ?? false,
                canReceiveBroadcast: params.canReceiveBroadcast ?? true,
                isActive: params.isActive ?? true,
                notes: params.notes,
            })
            .returning();

        revalidatePath("/dashboard/whatsapp");
        return { success: true, data: inserted };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function updateRegisteredNumberAction(
    id: string,
    params: Partial<{
        contactName: string;
        role: string;
        canAccessRevenue: boolean;
        canAccessStock: boolean;
        canAccessQuotation: boolean;
        canReceiveBroadcast: boolean;
        isActive: boolean;
        notes: string;
    }>
) {
    try {
        const [updated] = await db
            .update(whatsappRegisteredNumbers)
            .set({
                ...params,
                updatedAt: new Date(),
            })
            .where(eq(whatsappRegisteredNumbers.id, id))
            .returning();

        revalidatePath("/dashboard/whatsapp");
        return { success: true, data: updated };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function deleteRegisteredNumberAction(id: string) {
    try {
        await db.delete(whatsappRegisteredNumbers).where(eq(whatsappRegisteredNumbers.id, id));
        revalidatePath("/dashboard/whatsapp");
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

/**
 * 3. Logs (Messages & Notifications)
 */
export async function getWhatsAppLogsAction() {
    try {
        const messages = await db
            .select()
            .from(whatsappMessages)
            .orderBy(desc(whatsappMessages.createdAt))
            .limit(50);

        const notifLogs = await db
            .select()
            .from(whatsappNotificationLogs)
            .orderBy(desc(whatsappNotificationLogs.createdAt))
            .limit(50);

        return { success: true, messages, notifLogs };
    } catch (err: any) {
        return { success: false, error: err.message, messages: [], notifLogs: [] };
    }
}

/**
 * 4. Broadcast Message Action
 */
export async function sendBroadcastAction(params: {
    phoneNumbers: string[];
    message: string;
}) {
    try {
        const res = await broadcastCustomMessage(params);
        revalidatePath("/dashboard/whatsapp");
        return res;
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}
