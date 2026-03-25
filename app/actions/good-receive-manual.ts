"use server"

import { db } from "@/db"
import { goodReceiveManual, goodReceiveManualItems, stockLevels, me2lPurchDocsSap, products, warehouses } from "@/db/schema"
import { revalidatePath } from "next/cache"
import { eq, and, or, desc, inArray, isNotNull, ne, isNull } from "drizzle-orm"
import { recordStockMovement } from "./stock-movement"
import { getAuthenticatedSession } from "@/lib/rbac"
import { sendSystemTemplatedEmailByCode } from "@/lib/email"
import { SYSTEM_EMAIL_TEMPLATE_CODES } from "@/lib/email-template-registry"
import { readManagedUpload } from "@/lib/upload-storage"

export type ManualGoodReceivePoOption = {
    poNumber: string
    vendorName: string
    poDate: string | null
    totalPoQty: number
    itemCount: number
}

export type ManualGoodReceivePoLineOption = {
    poNumber: string
    vendorName: string
    poItem: number
    materialNumber: string
    materialDescription: string
    poQty: number
    openQty: number
    productId: number | null
}

type Me2lRow = Awaited<ReturnType<typeof db.query.me2lPurchDocsSap.findMany>>[number]

function buildLatestPoItemMap(rows: Me2lRow[]) {
    const latestByPoItem = new Map<string, Me2lRow>()

    for (const row of rows) {
        const poNumber = row.purchasingDoc?.trim()
        const poItem = row.item
        if (!poNumber || !poItem) continue

        const key = `${poNumber}-${poItem}`
        if (!latestByPoItem.has(key)) {
            latestByPoItem.set(key, row)
        }
    }

    return latestByPoItem
}

function sanitizeOpenQty(orderQty: number | null, deliveredQty: number | null) {
    const openQty = Number(orderQty || 0) - Number(deliveredQty || 0)
    return openQty > 0 ? openQty : 0
}

const normalizeStringArray = (value: unknown): string[] => {
    if (!Array.isArray(value)) return []
    return value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter(Boolean)
}

const escapeHtml = (value: string) =>
    value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")

async function getNotificationRecipientEmails(roleNames: string[], userIds: string[]) {
    const normalizedRoleSet = new Set(
        roleNames
            .map((entry) => entry.trim().toLowerCase())
            .filter(Boolean)
    )
    const userIdSet = new Set(userIds.map((entry) => entry.trim()).filter(Boolean))

    const users = await db.query.user.findMany({
        columns: {
            id: true,
            email: true,
            role: true,
        },
    })

    const recipients = users
        .filter((entry) => {
            const role = (entry.role ?? "").trim().toLowerCase()
            return userIdSet.has(entry.id) || normalizedRoleSet.has(role)
        })
        .map((entry) => entry.email?.trim() ?? "")
        .filter(Boolean)

    return Array.from(new Set(recipients))
}

function buildGoodReceiveManualNotificationContent(params: {
    poNumber: string
    supplier: string
    receiveDate: string
    deliveryType: "Partial" | "Complete"
    warehouseLabel: string
    referenceDocument?: string | null
    vendorDoUrl?: string | null
    detailUrl: string
    items: Array<{
        poItem: number
        materialNumber: string
        materialDescription: string
        quantity: number
    }>
}) {
    const itemsTableRows = params.items.length > 0
        ? params.items
            .map((item, index) => `
                <tr>
                    <td style="padding:8px;border:1px solid #e5e7eb;text-align:center;">${index + 1}</td>
                    <td style="padding:8px;border:1px solid #e5e7eb;text-align:center;">${item.poItem}</td>
                    <td style="padding:8px;border:1px solid #e5e7eb;">${escapeHtml(item.materialNumber)}</td>
                    <td style="padding:8px;border:1px solid #e5e7eb;">${escapeHtml(item.materialDescription)}</td>
                    <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${item.quantity.toLocaleString("id-ID")}</td>
                </tr>
            `)
            .join("")
        : `
            <tr>
                <td colspan="5" style="padding:10px;border:1px solid #e5e7eb;text-align:center;color:#6b7280;">
                    Tidak ada item quantity > 0.
                </td>
            </tr>
        `
    const itemsTextRows = params.items.length > 0
        ? params.items
            .map((item, index) => `${index + 1}. PO Item ${item.poItem} | ${item.materialNumber} - ${item.materialDescription} | Qty: ${item.quantity.toLocaleString("id-ID")}`)
            .join("\n")
        : "Tidak ada item quantity > 0."

    return {
        itemsTableRows,
        itemsTextRows,
    }
}

export async function getManualGoodReceivePoOptions() {
    try {
        const sapRows = await db.query.me2lPurchDocsSap.findMany({
            where: and(
                isNull(me2lPurchDocsSap.grProcessedDate),
                isNotNull(me2lPurchDocsSap.purchasingDoc),
                isNotNull(me2lPurchDocsSap.item),
                isNotNull(me2lPurchDocsSap.material),
                ne(me2lPurchDocsSap.material, ""),
                ne(me2lPurchDocsSap.material, "-")
            ),
            orderBy: [desc(me2lPurchDocsSap.docDate), desc(me2lPurchDocsSap.purchDocId)],
        })

        const latestByPoItem = buildLatestPoItemMap(sapRows)
        const latestRows = Array.from(latestByPoItem.values())

        const materialNumbers = Array.from(new Set(
            latestRows
                .map((row) => row.material?.trim())
                .filter((material): material is string => Boolean(material))
        ))

        const internalProducts = materialNumbers.length > 0
            ? await db.select({
                id: products.id,
                materialNumber: products.materialNumber,
                oldMaterialNo: products.oldMaterialNo,
                materialNumberCk: products.materialNumberCk,
                sloc: products.sloc,
            })
                .from(products)
                .where(or(
                    inArray(products.materialNumber, materialNumbers),
                    inArray(products.oldMaterialNo, materialNumbers),
                    inArray(products.materialNumberCk, materialNumbers)
                ))
            : []

        const productByMaterialSloc = new Map<string, number>()
        const fallbackProductByMaterial = new Map<string, number>()
        const productByOldMaterialNo = new Map<string, number>()
        const productByMaterialNumberCk = new Map<string, number>()
        for (const product of internalProducts) {
            const material = product.materialNumber?.trim() || ""
            const sloc = product.sloc?.trim() || ""
            if (!material) continue

            const key = `${material}::${sloc}`
            if (!productByMaterialSloc.has(key)) {
                productByMaterialSloc.set(key, product.id)
            }
            if (!fallbackProductByMaterial.has(material)) {
                fallbackProductByMaterial.set(material, product.id)
            }

            const oldMaterialNo = product.oldMaterialNo?.trim() || ""
            if (oldMaterialNo && !productByOldMaterialNo.has(oldMaterialNo)) {
                productByOldMaterialNo.set(oldMaterialNo, product.id)
            }

            const materialNumberCk = product.materialNumberCk?.trim() || ""
            if (materialNumberCk && !productByMaterialNumberCk.has(materialNumberCk)) {
                productByMaterialNumberCk.set(materialNumberCk, product.id)
            }
        }

        const lineOptions: ManualGoodReceivePoLineOption[] = latestRows.map((row) => {
            const poNumber = row.purchasingDoc?.trim() || ""
            const poItem = row.item || 0
            const materialNumber = row.material?.trim() || ""
            const storageLoc = row.storageLoc?.trim() || ""
            const vendorName = row.vendorName?.trim() || "Unknown Vendor"
            const poQty = Number(row.orderQty || 0)
            const openQty = sanitizeOpenQty(row.orderQty, row.deliveredQty)
            const productId = productByMaterialSloc.get(`${materialNumber}::${storageLoc}`)
                ?? fallbackProductByMaterial.get(materialNumber)
                ?? productByOldMaterialNo.get(materialNumber)
                ?? productByMaterialNumberCk.get(materialNumber)
                ?? null

            return {
                poNumber,
                vendorName,
                poItem,
                materialNumber,
                materialDescription: row.shortText?.trim() || "-",
                poQty,
                openQty,
                productId,
            }
        }).sort((a, b) => {
            if (a.poNumber === b.poNumber) return a.poItem - b.poItem
            return a.poNumber.localeCompare(b.poNumber)
        })

        const poMap = new Map<string, ManualGoodReceivePoOption>()
        latestRows.forEach((row) => {
            const poNumber = row.purchasingDoc?.trim() || ""
            if (!poNumber) return

            const vendorName = row.vendorName?.trim() || "Unknown Vendor"
            const poQty = Number(row.orderQty || 0)
            const poDate = row.docDate ? String(row.docDate) : null

            const current = poMap.get(poNumber)
            if (!current) {
                poMap.set(poNumber, {
                    poNumber,
                    vendorName,
                    poDate,
                    totalPoQty: poQty,
                    itemCount: 1,
                })
                return
            }

            current.itemCount += 1
            current.totalPoQty += poQty
            if ((!current.vendorName || current.vendorName === "Unknown Vendor") && vendorName) {
                current.vendorName = vendorName
            }
            if (!current.poDate && poDate) {
                current.poDate = poDate
            }
        })

        const poOptions = Array.from(poMap.values()).sort((a, b) => {
            const aDate = a.poDate ? new Date(a.poDate).getTime() : 0
            const bDate = b.poDate ? new Date(b.poDate).getTime() : 0
            if (aDate !== bDate) return bDate - aDate
            return b.poNumber.localeCompare(a.poNumber)
        })

        return {
            success: true as const,
            data: {
                poOptions,
                poLineOptions: lineOptions,
            },
        }
    } catch (error) {
        console.error("Error fetching manual good receive PO options:", error)
        return {
            success: false as const,
            error: "Failed to load PO options",
        }
    }
}

export async function getGoodReceiveManualNotificationTargets() {
    await getAuthenticatedSession("good-receive-manual", "create")

    const users = await db.query.user.findMany({
        columns: {
            id: true,
            name: true,
            email: true,
            role: true,
        },
        orderBy: (fields, { asc }) => [asc(fields.name), asc(fields.email)],
    })

    const roles = Array.from(
        new Set(
            users
                .map((entry) => entry.role?.trim() ?? "")
                .filter(Boolean)
        )
    ).sort((a, b) => a.localeCompare(b))

    return {
        roles,
        users: users.map((entry) => ({
            id: entry.id,
            name: entry.name,
            email: entry.email,
            role: entry.role,
        })),
    }
}

export type CreateGoodReceiveManualInput = {
    poNumber: string
    warehouseId: number
    receiveDate: Date
    deliveryType: "Partial" | "Complete"
    referenceDocument?: string
    vendorDoUrl?: string
    notifyRoles?: string[]
    notifyUserIds?: string[]
    items: {
        poItem: number
        materialNumber: string
        productId: number
        quantity: number
        openQty: number
        notes?: string
    }[]
}

type ManualGoodReceiveNotificationPayload = {
    poNumber: string
    supplier: string
    receiveDate: string
    deliveryType: "Partial" | "Complete"
    referenceDocument: string | null | undefined
    vendorDoUrl: string | null | undefined
    warehouseId: number
    items: Array<{
        poItem: number
        materialNumber: string
        materialDescription: string
        quantity: number
    }>
}

export async function createGoodReceiveManual(input: CreateGoodReceiveManualInput) {
    try {
        const session = await getAuthenticatedSession('good-receive-manual', 'create')
        const userId = session.user.id
        const notifyRoles = normalizeStringArray(input.notifyRoles)
        const notifyUserIds = normalizeStringArray(input.notifyUserIds)

        const notificationPayload = await db.transaction<ManualGoodReceiveNotificationPayload>(async (tx) => {
            const poNumber = input.poNumber.trim()
            if (!poNumber) throw new Error("PO Number is required")
            if (!input.warehouseId || input.warehouseId <= 0) {
                throw new Error("Warehouse is required")
            }

            const existingManualHeader = await tx.query.goodReceiveManual.findFirst({
                where: eq(goodReceiveManual.poNumber, poNumber),
                columns: {
                    id: true,
                },
            })
            if (existingManualHeader) {
                throw new Error(`PO ${poNumber} sudah pernah dibuat di GR Manual`)
            }

            const poItems = input.items.map((item) => item.poItem)
            const duplicatePoItem = poItems.find((poItem, idx) => poItems.indexOf(poItem) !== idx)
            if (duplicatePoItem) {
                throw new Error(`PO Item ${duplicatePoItem} selected more than once`)
            }

            const sapRows = await tx.query.me2lPurchDocsSap.findMany({
                where: and(
                    eq(me2lPurchDocsSap.purchasingDoc, poNumber),
                    inArray(me2lPurchDocsSap.item, poItems),
                    isNotNull(me2lPurchDocsSap.material),
                    ne(me2lPurchDocsSap.material, ""),
                    ne(me2lPurchDocsSap.material, "-")
                ),
                orderBy: [desc(me2lPurchDocsSap.docDate), desc(me2lPurchDocsSap.purchDocId)],
            })

            const latestByPoItem = new Map<number, Me2lRow>()
            for (const row of sapRows) {
                if (!row.item) continue
                if (!latestByPoItem.has(row.item)) {
                    latestByPoItem.set(row.item, row)
                }
            }

            const productIds = Array.from(new Set(input.items.map((item) => item.productId)))
            const existingProducts = await tx.select({
                id: products.id,
                materialNumber: products.materialNumber,
            }).from(products).where(inArray(products.id, productIds))
            const productById = new Map(existingProducts.map((p) => [p.id, p]))

            const resolvedItems = input.items.map((item) => {
                const sapLine = latestByPoItem.get(item.poItem)
                if (!sapLine) {
                    throw new Error(`PO Item ${item.poItem} tidak ditemukan di SAP untuk PO ${poNumber}`)
                }
                if (sapLine.grProcessedDate) {
                    throw new Error(`PO Item ${item.poItem} sudah pernah di-GR`)
                }

                const openQty = sanitizeOpenQty(sapLine.orderQty, sapLine.deliveredQty)
                if (openQty <= 0) {
                    throw new Error(`PO Item ${item.poItem} tidak memiliki qty open`)
                }
                if (item.quantity < 0) {
                    throw new Error(`Qty untuk PO Item ${item.poItem} tidak boleh negatif`)
                }
                if (item.quantity > openQty) {
                    throw new Error(`Qty untuk PO Item ${item.poItem} melebihi Open Qty (${openQty})`)
                }

                const product = productById.get(item.productId)
                if (item.quantity > 0) {
                    if (!product) {
                        throw new Error(`Produk internal untuk PO Item ${item.poItem} tidak ditemukan`)
                    }
                }

                return {
                    ...item,
                    poItem: item.poItem,
                    vendorName: sapLine.vendorName?.trim() || "Unknown Vendor",
                    materialDescription: sapLine.shortText?.trim() || "-",
                }
            })

            const vendorName = resolvedItems[0]?.vendorName || "Unknown Vendor"
            const hasPositiveQty = resolvedItems.some((item) => item.quantity > 0)
            if (!hasPositiveQty) {
                throw new Error("Minimal satu item harus memiliki quantity > 0")
            }

            // 1. Create Header
            const [header] = await tx.insert(goodReceiveManual).values({
                supplier: vendorName,
                poNumber,
                receiveDate: input.receiveDate.toISOString(),
                deliveryType: input.deliveryType,
                referenceDocument: input.referenceDocument,
                vendorDoUrl: input.vendorDoUrl,
            }).returning()

            const payload: ManualGoodReceiveNotificationPayload = {
                poNumber,
                supplier: vendorName,
                receiveDate: input.receiveDate.toISOString(),
                deliveryType: input.deliveryType,
                referenceDocument: input.referenceDocument,
                vendorDoUrl: input.vendorDoUrl,
                warehouseId: input.warehouseId,
                items: resolvedItems
                    .filter((item) => item.quantity > 0)
                    .map((item) => ({
                        poItem: item.poItem,
                        materialNumber: item.materialNumber,
                        materialDescription: item.materialDescription,
                        quantity: item.quantity,
                    })),
            }

            // 2. Create Items and Update Stock
            for (const item of resolvedItems) {
                if (item.productId <= 0 && item.quantity <= 0) {
                    continue
                }

                await tx.insert(goodReceiveManualItems).values({
                    headerId: header.id,
                    productId: item.productId,
                    warehouseId: input.warehouseId,
                    quantity: item.quantity,
                    notes: item.notes?.trim() || null,
                })

                if (item.quantity <= 0) {
                    continue
                }

                // 3. Update or Insert Stock Level
                const existingStock = await tx.select()
                    .from(stockLevels)
                    .where(
                        and(
                            eq(stockLevels.productId, item.productId),
                            eq(stockLevels.warehouseId, input.warehouseId)
                        )
                    )
                    .limit(1)

                if (existingStock.length > 0) {
                    await tx.update(stockLevels)
                        .set({
                            totalStock: existingStock[0].totalStock + item.quantity,
                            updatedAt: new Date()
                        })
                        .where(eq(stockLevels.id, existingStock[0].id))
                } else {
                    await tx.insert(stockLevels).values({
                        productId: item.productId,
                        warehouseId: input.warehouseId,
                        totalStock: item.quantity, // Initial stock
                        bookedStock: 0,
                        minStock: 0,
                        valuationValue: "0",
                    })
                }

                // 4. Record Movement
                await recordStockMovement(tx, {
                    productId: item.productId,
                    warehouseId: input.warehouseId,
                    quantity: item.quantity,
                    type: "GR_MANUAL",
                    referenceNumber: `PO: ${header.poNumber} Item: ${item.poItem}`,
                    recordedBy: userId,
                })

                // 5. Mark SAP line as processed to prevent duplicate stock posting from GR SAP
                await tx.update(me2lPurchDocsSap)
                    .set({
                        grProcessedDate: new Date(),
                        grWarehouseId: input.warehouseId,
                    })
                    .where(and(
                        eq(me2lPurchDocsSap.purchasingDoc, poNumber),
                        eq(me2lPurchDocsSap.item, item.poItem)
                    ))
            }

            return payload
        })

        revalidatePath("/dashboard/good-receive-manual")
        revalidatePath("/dashboard/stocks")
        revalidatePath("/dashboard/stock-movements")

        let notificationResult: { sent: boolean; reason?: string; recipientCount?: number } | null = null
        if (notifyRoles.length > 0 || notifyUserIds.length > 0) {
            try {
                const payload = notificationPayload
                const [recipients, warehouse] = await Promise.all([
                    getNotificationRecipientEmails(notifyRoles, notifyUserIds),
                    db.query.warehouses.findFirst({
                        where: eq(warehouses.id, payload.warehouseId),
                        columns: {
                            sloc: true,
                            description: true,
                        },
                    }),
                ])

                if (recipients.length > 0) {
                    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "")
                    const detailPath = "/dashboard/good-receive-manual"
                    const detailUrl = baseUrl ? `${baseUrl}${detailPath}` : detailPath
                    const receiveDateText = new Date(payload.receiveDate).toLocaleDateString("id-ID", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                    })
                    const warehouseLabel = warehouse?.sloc
                        ? `${warehouse.sloc}${warehouse.description ? ` - ${warehouse.description}` : ""}`
                        : "-"
                    const vendorDoUrl = payload.vendorDoUrl?.trim() || ""
                    const vendorDoLink = vendorDoUrl
                        ? `<a href="${escapeHtml(vendorDoUrl)}" target="_blank" rel="noopener noreferrer">Lihat Foto DO Vendor</a>`
                        : "-"
                    const attachments: Array<{
                        filename: string
                        content: Buffer
                        contentType?: string
                    }> = []

                    if (vendorDoUrl) {
                        const vendorDoUpload = await readManagedUpload(vendorDoUrl)
                        if (vendorDoUpload) {
                            attachments.push({
                                filename: vendorDoUpload.filename,
                                content: vendorDoUpload.buffer,
                                contentType: vendorDoUpload.contentType,
                            })
                        }
                    }

                    const { itemsTableRows, itemsTextRows } = buildGoodReceiveManualNotificationContent({
                        poNumber: payload.poNumber,
                        supplier: payload.supplier,
                        receiveDate: receiveDateText,
                        deliveryType: payload.deliveryType,
                        warehouseLabel,
                        referenceDocument: payload.referenceDocument,
                        vendorDoUrl,
                        detailUrl,
                        items: payload.items,
                    })

                    const emailResult = await sendSystemTemplatedEmailByCode({
                        code: SYSTEM_EMAIL_TEMPLATE_CODES.goodReceiveManualNotification,
                        to: recipients,
                        data: {
                            poNumber: payload.poNumber,
                            supplier: payload.supplier,
                            receiveDate: receiveDateText,
                            deliveryType: payload.deliveryType,
                            warehouseLabel,
                            referenceDocument: payload.referenceDocument?.trim() || "-",
                            vendorDoLink,
                            vendorDoText: vendorDoUrl || "-",
                            detailUrl,
                            itemsTableRows,
                            itemsTextRows,
                        },
                        attachments,
                    })

                    if (!emailResult.success) {
                        console.error("Failed to send GR manual notification:", emailResult.error)
                        notificationResult = { sent: false, reason: emailResult.error || "Gagal mengirim email", recipientCount: recipients.length }
                    } else {
                        notificationResult = { sent: true, recipientCount: recipients.length }
                    }
                } else {
                    notificationResult = { sent: false, reason: "Tidak ada penerima notifikasi yang cocok", recipientCount: 0 }
                }
            } catch (notificationError) {
                console.error("GR manual notification error:", notificationError)
                notificationResult = { sent: false, reason: "Terjadi error saat mengirim notifikasi email" }
            }
        }

        return { success: true, notification: notificationResult }
    } catch (error) {
        console.error("Error creating manual good receive:", error)
        return { success: false, error: "Failed to create good receive record" }
    }
}
