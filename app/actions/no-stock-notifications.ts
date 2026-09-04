"use server"

import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/db"
import { settings } from "@/db/schema/settings"
import { sendEmail } from "@/lib/email"
import { getAuthenticatedSession } from "@/lib/rbac"
import {
    DEFAULT_NO_STOCK_NOTIFICATION_CONFIG,
    formatNoStockNotificationHtml,
    type NoStockNotificationConfig,
    type EmptyStockItemSummary,
} from "@/lib/no-stock-notifications"

const SETTINGS_KEY = "no_stock_notification_config"

export async function getNoStockNotificationSettings(): Promise<{
    success: boolean
    config: NoStockNotificationConfig
}> {
    try {
        const row = await db.query.settings.findFirst({
            where: eq(settings.key, SETTINGS_KEY),
        })

        if (!row?.value) {
            return {
                success: true,
                config: DEFAULT_NO_STOCK_NOTIFICATION_CONFIG,
            }
        }

        const parsed = JSON.parse(row.value)
        return {
            success: true,
            config: {
                ...DEFAULT_NO_STOCK_NOTIFICATION_CONFIG,
                ...parsed,
                updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : undefined,
            },
        }
    } catch (err) {
        console.error("[NoStockNotification] Error reading settings:", err)
        return {
            success: false,
            config: DEFAULT_NO_STOCK_NOTIFICATION_CONFIG,
        }
    }
}

export async function saveNoStockNotificationSettings(config: Partial<NoStockNotificationConfig>): Promise<{
    success: boolean
    error?: string
}> {
    try {
        const session = await getAuthenticatedSession("no-stock-monitoring", "edit")
        const current = await getNoStockNotificationSettings()
        const updatedConfig: NoStockNotificationConfig = {
            ...current.config,
            ...config,
            updatedAt: new Date().toISOString(),
            updatedBy: session?.user?.name || session?.user?.email || "Admin",
        }

        const payload = JSON.stringify(updatedConfig)

        await db
            .insert(settings)
            .values({
                key: SETTINGS_KEY,
                value: payload,
                updatedAt: new Date(),
            })
            .onConflictDoUpdate({
                target: settings.key,
                set: {
                    value: payload,
                    updatedAt: new Date(),
                },
            })

        revalidatePath("/dashboard/no-stock-monitoring")
        return { success: true }
    } catch (err: any) {
        console.error("[NoStockNotification] Error saving settings:", err)
        return { success: false, error: err?.message || "Gagal menyimpan pengaturan notifikasi" }
    }
}

export async function sendTestNoStockNotification(targetEmail?: string): Promise<{
    success: boolean
    message?: string
    error?: string
}> {
    try {
        const settingsRes = await getNoStockNotificationSettings()
        const config = settingsRes.config

        const recipientList = targetEmail
            ? [targetEmail]
            : config.recipientEmails.length > 0
            ? config.recipientEmails
            : ["procurement@chitraparatama.com"]

        const sampleItems: EmptyStockItemSummary[] = [
            {
                materialNumber: "MAT-TEST-001",
                materialDescription: "Heavy Duty Hydraulic Valve 4 Inch",
                orderedQuantity: 10,
                availableStock: 0,
                shortageQuantity: 10,
            },
            {
                materialNumber: "MAT-TEST-002",
                materialDescription: "Industrial Grade Pressure Gauge 10 Bar",
                orderedQuantity: 5,
                availableStock: 1,
                shortageQuantity: 4,
            },
        ]

        const html = formatNoStockNotificationHtml({
            invoiceNumber: "SO-TEST-2026",
            customerName: "PT Global Mandiri Jaya (TEST)",
            customerPo: "PO-TEST-8899",
            salesPersonName: "Budi Santoso",
            items: sampleItems,
            appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        })

        const subject = config.emailSubjectTemplate
            .replace("{invoiceNumber}", "SO-TEST-2026")
            .replace("{customerName}", "PT Global Mandiri Jaya")

        const result = await sendEmail({
            to: recipientList,
            subject,
            html,
        })

        if (!result.success) {
            return {
                success: false,
                error: result.error || "Gagal mengirim email simulasi (periksa konfigurasi SMTP)",
            }
        }

        return {
            success: true,
            message: `Test notifikasi berhasil dikirimkan ke ${recipientList.join(", ")}`,
        }
    } catch (err: any) {
        console.error("[NoStockNotification] Test send error:", err)
        return {
            success: false,
            error: err?.message || "Terjadi kesalahan saat mengirim simulasi notifikasi",
        }
    }
}

export async function notifyNewOrderWithEmptyStock(params: {
    invoiceNumber: string
    customerName: string
    customerPo?: string | null
    salesPersonName: string
    hasCustomerPo: boolean
    emptyItems: EmptyStockItemSummary[]
}) {
    try {
        const settingsRes = await getNoStockNotificationSettings()
        const config = settingsRes.config

        if (!config.enabled) return
        if (params.emptyItems.length < config.minEmptyItems) return
        if (config.triggerCondition === "po_customer_only" && !params.hasCustomerPo) return
        if (!config.notifyEmail) return

        const recipients = config.recipientEmails.filter(Boolean)
        if (recipients.length === 0) return

        const html = formatNoStockNotificationHtml({
            invoiceNumber: params.invoiceNumber,
            customerName: params.customerName,
            customerPo: params.customerPo || "-",
            salesPersonName: params.salesPersonName,
            items: params.emptyItems,
            appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        })

        const subject = config.emailSubjectTemplate
            .replace("{invoiceNumber}", params.invoiceNumber)
            .replace("{customerName}", params.customerName)

        await sendEmail({
            to: recipients,
            subject,
            html,
        })
    } catch (err) {
        console.error("[NoStockNotification] Background notification error:", err)
    }
}
