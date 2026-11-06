"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { and, desc, eq, inArray } from "drizzle-orm"
import { db } from "@/db"
import { auth } from "@/lib/auth"
import { salesOrders, shippingApprovalRequests, user } from "@/db/schema"
import { sendLoggedNotificationMessage } from "@/lib/email"

const DEFAULT_APPROVER_EMAIL = "ali.rahman@chitraparatama.co.id"

export async function requestShippingApproval(params: {
    salesOrderIds: number[]
    userComment?: string
}) {
    try {
        const session = await auth.api.getSession({ headers: await headers() })
        if (!session?.user?.id) {
            return { success: false, error: "Unauthorized. Silakan login terlebih dahulu." }
        }

        if (!params.salesOrderIds || params.salesOrderIds.length === 0) {
            return { success: false, error: "Pilih setidaknya satu Sales Order untuk diajukan approval." }
        }

        // 1. Ambil data Sales Order terpilih beserta customer & items
        const selectedOrders = await db.query.salesOrders.findMany({
            where: inArray(salesOrders.id, params.salesOrderIds),
            with: {
                customer: true,
                items: {
                    with: {
                        product: true,
                    },
                },
                createdByUser: true,
            },
        })

        if (selectedOrders.length === 0) {
            return { success: false, error: "Sales Order yang dipilih tidak ditemukan." }
        }

        // 2. Cari Approver Ali Rahman di database (fallback ke default email jika tidak ada)
        const approverUser = await db.query.user.findFirst({
            where: eq(user.email, DEFAULT_APPROVER_EMAIL),
        })

        const now = new Date()
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "")
        const randomCode = Math.random().toString(36).substring(2, 6).toUpperCase()
        const batchNumber = `REQ-SCM-${dateStr}-${randomCode}`
        const batchId = crypto.randomUUID()

        // 3. Simpan data batch request ke tabel shippingApprovalRequests
        await db.insert(shippingApprovalRequests).values({
            id: batchId,
            batchNumber,
            requesterId: session.user.id,
            approverId: approverUser?.id || null,
            status: "Waiting Approve",
            userComment: params.userComment?.trim() || null,
            totalOrders: selectedOrders.length,
            createdAt: now,
            updatedAt: now,
        })

        // 4. Update data sales orders
        await db
            .update(salesOrders)
            .set({
                shippingApprovalStatus: "Waiting Approve",
                shippingApprovalBatchId: batchId,
                shippingApprovalUserComment: params.userComment?.trim() || null,
                shippingApprovalRequestedAt: now,
                shippingApprovalRequestedBy: session.user.id,
                updatedAt: now,
            })
            .where(inArray(salesOrders.id, params.salesOrderIds))

        // 5. Susun ringkasan tabel HTML untuk email & notifikasi push
        const orderRowsHtml = selectedOrders
            .map((order) => {
                const itemSummary = order.items
                    .map(
                        (it) =>
                            `• ${it.product?.materialDescription || it.description || "Item"} (${it.quantity} pcs)`
                    )
                    .join("<br/>")

                return `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 10px; font-weight: bold; color: #1e293b;">${order.invoiceNumber || "-"}</td>
                    <td style="padding: 10px; color: #475569;">${order.customerPo || "-"}</td>
                    <td style="padding: 10px; color: #1e293b;">${order.customer?.name || "-"}</td>
                    <td style="padding: 10px; font-size: 13px; color: #334155;">${itemSummary || "-"}</td>
                </tr>
            `
            })
            .join("")

        const baseUrl = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
        const actionUrl = `/dashboard/sales-orders/approvals?batch=${batchId}`
        const fullActionUrl = `${baseUrl}${actionUrl}`

        const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <div style="background-color: #0284c7; color: white; padding: 16px; border-radius: 6px 6px 0 0; text-align: center;">
                <h2 style="margin: 0; font-size: 20px;">Permintaan Approval Pengiriman SCM</h2>
                <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.9;">No. Batch: ${batchNumber}</p>
            </div>
            
            <div style="padding: 20px 10px;">
                <p style="color: #334155; font-size: 14px; margin-top: 0;">
                    Yth. <strong>Bapak Ali Rahman (SCM Leader Balikpapan)</strong>,
                </p>
                <p style="color: #475569; font-size: 14px; line-height: 1.5;">
                    Pemohon <strong>${session.user.name || session.user.email}</strong> mengajukan permintaan verifikasi & approval untuk pengiriman sebanyak <strong>${selectedOrders.length} Sales Order</strong>.
                </p>

                ${
                    params.userComment
                        ? `<div style="background-color: #f8fafc; border-left: 4px solid #0284c7; padding: 12px; margin: 16px 0; border-radius: 4px;">
                            <strong style="color: #0f172a; font-size: 13px;">Catatan Pemohon:</strong>
                            <p style="margin: 4px 0 0; color: #475569; font-size: 13px; font-style: italic;">"${params.userComment}"</p>
                           </div>`
                        : ""
                }

                <h4 style="color: #0f172a; margin: 20px 0 10px; font-size: 14px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">
                    Daftar Sales Order yang Diajukan:
                </h4>

                <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px;">
                    <thead>
                        <tr style="background-color: #f1f5f9; text-align: left; color: #475569;">
                            <th style="padding: 8px 10px;">No SO</th>
                            <th style="padding: 8px 10px;">No PO</th>
                            <th style="padding: 8px 10px;">Customer</th>
                            <th style="padding: 8px 10px;">Barang & Qty</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${orderRowsHtml}
                    </tbody>
                </table>

                <div style="text-align: center; margin: 30px 0;">
                    <a href="${fullActionUrl}" style="background-color: #0284c7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block;">
                        Buka Halaman Verifikasi Approval
                    </a>
                </div>

                <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 24px;">
                    Email otomatis dari One Chitra Platform • SCM Approval Workflow
                </p>
            </div>
        </div>
        `

        // 6. Kirim notifikasi via Email dan Push (Inbox)
        await sendLoggedNotificationMessage({
            to: DEFAULT_APPROVER_EMAIL,
            subject: `[Approval Pengiriman SCM] ${selectedOrders.length} Sales Order diajukan oleh ${session.user.name || "User"} (${batchNumber})`,
            html: emailHtml,
            text: `Permintaan Approval Pengiriman ${selectedOrders.length} Sales Order (${batchNumber}) dari ${session.user.name || session.user.email}. Catatan: ${params.userComment || "-"}`,
            actionUrl: actionUrl,
            channels: ["email", "push"],
        })

        revalidatePath("/dashboard/sales-orders")
        revalidatePath("/dashboard/sales-orders/approvals")

        return {
            success: true,
            batchId,
            batchNumber,
            totalOrders: selectedOrders.length,
        }
    } catch (error) {
        console.error("Error in requestShippingApproval:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Terjadi kesalahan saat mengajukan approval pengiriman.",
        }
    }
}

export async function getShippingApprovals(filters?: {
    batchId?: string
    status?: string
}) {
    try {
        const session = await auth.api.getSession({ headers: await headers() })
        if (!session?.user?.id) {
            return { success: false, error: "Unauthorized" }
        }

        const batches = await db.query.shippingApprovalRequests.findMany({
            where: filters?.batchId
                ? eq(shippingApprovalRequests.id, filters.batchId)
                : filters?.status
                  ? eq(shippingApprovalRequests.status, filters.status)
                  : undefined,
            with: {
                requester: true,
                approver: true,
            },
            orderBy: [desc(shippingApprovalRequests.createdAt)],
        })

        const batchIds = batches.map((b) => b.id)

        const orders = batchIds.length > 0
            ? await db.query.salesOrders.findMany({
                  where: inArray(salesOrders.shippingApprovalBatchId, batchIds),
                  with: {
                      customer: true,
                      warehouse: true,
                      items: {
                          with: {
                              product: true,
                          },
                      },
                      createdByUser: true,
                      shippingApprovalRequestedByUser: true,
                      shippingApprovedByUser: true,
                  },
                  orderBy: [desc(salesOrders.salesDate)],
              })
            : []

        return {
            success: true,
            batches,
            orders,
        }
    } catch (error) {
        console.error("Error in getShippingApprovals:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Gagal memuat data approval pengiriman.",
            batches: [],
            orders: [],
        }
    }
}

export async function approveShippingOrders(params: {
    salesOrderIds: number[]
    batchId?: string
    approverNotes?: string
}) {
    try {
        const session = await auth.api.getSession({ headers: await headers() })
        if (!session?.user?.id) {
            return { success: false, error: "Unauthorized. Silakan login terlebih dahulu." }
        }

        if (!params.salesOrderIds || params.salesOrderIds.length === 0) {
            return { success: false, error: "Pilih setidaknya satu Sales Order untuk diapprove." }
        }

        const now = new Date()
        const approverNotes = params.approverNotes?.trim() || null

        // 1. Update sales orders
        await db
            .update(salesOrders)
            .set({
                shippingApprovalStatus: "Approve",
                shippingApprovalNotes: approverNotes,
                shippingApprovedAt: now,
                shippingApprovedBy: session.user.id,
                updatedAt: now,
            })
            .where(inArray(salesOrders.id, params.salesOrderIds))

        // 2. Update status batch jika ada
        if (params.batchId) {
            await db
                .update(shippingApprovalRequests)
                .set({
                    status: "Approve",
                    approverNotes: approverNotes,
                    approverId: session.user.id,
                    approvedAt: now,
                    updatedAt: now,
                })
                .where(eq(shippingApprovalRequests.id, params.batchId))
        }

        // 3. Ambil data SO dan pemohon untuk mengirim feedback notifikasi
        const updatedOrders = await db.query.salesOrders.findMany({
            where: inArray(salesOrders.id, params.salesOrderIds),
            with: {
                shippingApprovalRequestedByUser: true,
                createdByUser: true,
                customer: true,
            },
        })

        // Kumpulkan email pemohon yang unik
        const requesterEmails = Array.from(
            new Set(
                updatedOrders
                    .map((o) => o.shippingApprovalRequestedByUser?.email || o.createdByUser?.email)
                    .filter((email): email is string => !!email)
            )
        )

        if (requesterEmails.length > 0) {
            const orderListText = updatedOrders.map((o) => `• ${o.invoiceNumber || "-"} (${o.customer?.name || "-"})`).join("<br/>")
            const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                <div style="background-color: #059669; color: white; padding: 16px; border-radius: 6px 6px 0 0; text-align: center;">
                    <h2 style="margin: 0; font-size: 20px;">Pengiriman Sales Order Disetujui (Approve)</h2>
                </div>
                <div style="padding: 20px 10px;">
                    <p style="color: #334155; font-size: 14px;">
                        Permintaan pengiriman untuk <strong>${updatedOrders.length} Sales Order</strong> telah disetujui oleh <strong>${session.user.name || "SCM Leader"}</strong>.
                    </p>
                    ${
                        approverNotes
                            ? `<div style="background-color: #ecfdf5; border-left: 4px solid #059669; padding: 12px; margin: 16px 0; border-radius: 4px;">
                                <strong style="color: #065f46; font-size: 13px;">Arahan SCM:</strong>
                                <p style="margin: 4px 0 0; color: #047857; font-size: 13px; font-style: italic;">"${approverNotes}"</p>
                               </div>`
                            : ""
                    }
                    <h4 style="color: #0f172a; margin: 16px 0 8px; font-size: 13px;">Daftar SO yang Disetujui:</h4>
                    <div style="font-size: 13px; color: #334155; line-height: 1.6;">
                        ${orderListText}
                    </div>
                </div>
            </div>
            `

            await sendLoggedNotificationMessage({
                to: requesterEmails,
                subject: `[Disetujui] Pengiriman ${updatedOrders.length} Sales Order telah di-Approve SCM`,
                html: emailHtml,
                text: `Pengiriman ${updatedOrders.length} Sales Order telah di-Approve oleh ${session.user.name || "SCM Leader"}. Arahan: ${approverNotes || "-"}`,
                actionUrl: `/dashboard/sales-orders`,
                channels: ["email", "push"],
            })
        }

        revalidatePath("/dashboard/sales-orders")
        revalidatePath("/dashboard/sales-orders/approvals")

        return { success: true }
    } catch (error) {
        console.error("Error in approveShippingOrders:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Gagal menyetujui pengiriman Sales Order.",
        }
    }
}
