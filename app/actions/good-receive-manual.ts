"use server"

import { db } from "@/db"
import { goodReceiveManual, goodReceiveManualItems, stockLevels, me2lPurchDocsSap, products, warehouses, stockMovements } from "@/db/schema"
import { revalidatePath } from "next/cache"
import { eq, and, or, desc, inArray, isNotNull, ne, isNull } from "drizzle-orm"
import { recordStockMovement } from "./stock-movement"
import { getAuthenticatedSession } from "@/lib/rbac"
import { sendLoggedNotificationMessage, sendSystemTemplatedEmailByCode } from "@/lib/email"
import { SYSTEM_EMAIL_TEMPLATE_CODES } from "@/lib/email-template-registry"
import { readManagedUpload } from "@/lib/upload-storage"
import { toCanonicalAppUrl } from "@/lib/app-url"

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

const EPR_INTEGRATION_ENTRIES_URL = "https://proc-share.com/wp-json/gravityview/v1/views/2354/entries.json?limit=0"

type EprNotificationEntry = {
    "1"?: string | string[]
    "18"?: string | string[]
    "38"?: string | string[]
    "49"?: string | string[]
    "50"?: string | string[]
}

type EprNotificationEntriesPayload = {
    entries?: EprNotificationEntry[]
}

function parseManualGrReference(referenceNumber: string | null | undefined) {
    const normalized = referenceNumber?.trim() || ""
    const match = normalized.match(/^PO:\s*(.+?)\s+Item:\s*(\d+)$/i)
    if (!match) return null

    const poNumber = match[1]?.trim()
    const poItem = Number(match[2])
    if (!poNumber || !Number.isFinite(poItem) || poItem <= 0) {
        return null
    }

    return { poNumber, poItem }
}

async function getManualReceivedQtyByPoItem() {
    const movements = await db.query.stockMovements.findMany({
        where: eq(stockMovements.type, "GR_MANUAL"),
        columns: {
            referenceNumber: true,
            quantity: true,
        },
    })

    const receivedByPoItem = new Map<string, number>()
    for (const movement of movements) {
        const parsed = parseManualGrReference(movement.referenceNumber)
        if (!parsed) continue

        const key = `${parsed.poNumber}-${parsed.poItem}`
        receivedByPoItem.set(key, (receivedByPoItem.get(key) ?? 0) + Number(movement.quantity || 0))
    }

    return receivedByPoItem
}

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

function getFirstStringValue(value: string | string[] | undefined) {
    if (Array.isArray(value)) {
        return typeof value[0] === "string" ? value[0].trim() : ""
    }

    return typeof value === "string" ? value.trim() : ""
}

function isEmailLike(value: string | null | undefined) {
    if (!value) return false
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

async function fetchJsonWithNestedString<T>(url: string): Promise<T> {
    const response = await fetch(url, {
        cache: "no-store",
        headers: { Accept: "application/json" },
    })

    if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`)
    }

    const text = await response.text()
    const parsed = JSON.parse(text) as T | string
    return (typeof parsed === "string" ? JSON.parse(parsed) : parsed) as T
}

async function findEprRecipientByPoNumber(poNumber: string) {
    const normalizedPoNumber = poNumber.trim()
    if (!normalizedPoNumber) return null

    const payload = await fetchJsonWithNestedString<EprNotificationEntriesPayload>(EPR_INTEGRATION_ENTRIES_URL)
    const matches = (payload.entries ?? [])
        .filter((entry) => getFirstStringValue(entry["38"]) === normalizedPoNumber)
        .sort((left, right) => {
            const leftDate = new Date(getFirstStringValue(left["1"])).getTime()
            const rightDate = new Date(getFirstStringValue(right["1"])).getTime()
            return (Number.isFinite(rightDate) ? rightDate : 0) - (Number.isFinite(leftDate) ? leftDate : 0)
        })

    const bestMatch = matches[0]
    if (!bestMatch) return null

    const emailBc = getFirstStringValue(bestMatch["50"])
    const picBc = getFirstStringValue(bestMatch["49"])
    const recipientEmail = isEmailLike(emailBc) ? emailBc : isEmailLike(picBc) ? picBc : ""

    if (!recipientEmail) return null

    return {
        recipientEmail,
        picName: picBc || emailBc || "PIC Sales",
        prNumber: getFirstStringValue(bestMatch["18"]) || "-",
    }
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

        const manualReceivedByPoItem = await getManualReceivedQtyByPoItem()
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
            const sapOpenQty = sanitizeOpenQty(row.orderQty, row.deliveredQty)
            const manualReceivedQty = manualReceivedByPoItem.get(`${poNumber}-${poItem}`) ?? 0
            const openQty = Math.max(0, sapOpenQty - manualReceivedQty)
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
        poQty?: number
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

            const manualMovements = await tx.query.stockMovements.findMany({
                where: eq(stockMovements.type, "GR_MANUAL"),
                columns: {
                    referenceNumber: true,
                    quantity: true,
                },
            })
            const manualReceivedByPoItem = new Map<number, number>()
            for (const movement of manualMovements) {
                const parsed = parseManualGrReference(movement.referenceNumber)
                if (!parsed || parsed.poNumber !== poNumber || !poItems.includes(parsed.poItem)) continue
                manualReceivedByPoItem.set(
                    parsed.poItem,
                    (manualReceivedByPoItem.get(parsed.poItem) ?? 0) + Number(movement.quantity || 0)
                )
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

                const poQty = Number(sapLine.orderQty || 0)
                if (item.quantity < 0) {
                    throw new Error(`Qty untuk PO Item ${item.poItem} tidak boleh negatif`)
                }
                if (item.quantity > poQty) {
                    throw new Error(`Qty untuk PO Item ${item.poItem} melebihi PO Qty (${poQty})`)
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

                const sapOpenQty = sanitizeOpenQty(latestByPoItem.get(item.poItem)?.orderQty ?? 0, latestByPoItem.get(item.poItem)?.deliveredQty ?? 0)
                const previousManualQty = manualReceivedByPoItem.get(item.poItem) ?? 0
                const remainingQtyAfterSubmit = Math.max(0, sapOpenQty - previousManualQty - item.quantity)

                if (remainingQtyAfterSubmit <= 0) {
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
            }

            return payload
        })

        revalidatePath("/dashboard/good-receive-manual")
        revalidatePath("/dashboard/stocks")
        revalidatePath("/dashboard/stock-movements")
        revalidatePath("/dashboard/epr-integrasi")

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

        let salesPicNotificationResult: { sent: boolean; reason?: string; recipient?: string } | null = null
        try {
            const eprRecipient = await findEprRecipientByPoNumber(notificationPayload.poNumber)

            if (!eprRecipient) {
                salesPicNotificationResult = {
                    sent: false,
                    reason: "PIC Sales EPR untuk PO ini tidak ditemukan",
                }
            } else {
                const receiveDateText = new Date(notificationPayload.receiveDate).toLocaleDateString("id-ID", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                })
                const actionUrl = toCanonicalAppUrl(`/dashboard/epr-integrasi?search=${encodeURIComponent(notificationPayload.poNumber)}`)
                const subject = `GR Manual sudah dibuat untuk PO ${notificationPayload.poNumber}`
                const safePicName = escapeHtml(eprRecipient.picName)
                const safePoNumber = escapeHtml(notificationPayload.poNumber)
                const safeSupplier = escapeHtml(notificationPayload.supplier)
                const safeReceiveDate = escapeHtml(receiveDateText)
                const safeDeliveryType = escapeHtml(notificationPayload.deliveryType)
                const safeCreatedBy = escapeHtml(session.user.name?.trim() || session.user.email || "System")
                const safePrNumber = escapeHtml(eprRecipient.prNumber)
                const safeActionUrl = escapeHtml(actionUrl)

                const html = `
                    <p>Halo ${safePicName},</p>
                    <p>GR Manual untuk PO <strong>${safePoNumber}</strong> sudah dibuat.</p>
                    <table style="border-collapse:collapse;margin:16px 0;">
                        <tr><td style="padding:4px 12px 4px 0;"><strong>PR No</strong></td><td style="padding:4px 0;">${safePrNumber}</td></tr>
                        <tr><td style="padding:4px 12px 4px 0;"><strong>PO Number</strong></td><td style="padding:4px 0;">${safePoNumber}</td></tr>
                        <tr><td style="padding:4px 12px 4px 0;"><strong>Supplier</strong></td><td style="padding:4px 0;">${safeSupplier}</td></tr>
                        <tr><td style="padding:4px 12px 4px 0;"><strong>Receive Date</strong></td><td style="padding:4px 0;">${safeReceiveDate}</td></tr>
                        <tr><td style="padding:4px 12px 4px 0;"><strong>Delivery Type</strong></td><td style="padding:4px 0;">${safeDeliveryType}</td></tr>
                        <tr><td style="padding:4px 12px 4px 0;"><strong>Dibuat Oleh</strong></td><td style="padding:4px 0;">${safeCreatedBy}</td></tr>
                    </table>
                    <p><a href="${safeActionUrl}" target="_blank" rel="noopener noreferrer">Buka EPR Integrasi untuk PO ini</a></p>
                `
                const text = [
                    `Halo ${eprRecipient.picName},`,
                    "",
                    `GR Manual untuk PO ${notificationPayload.poNumber} sudah dibuat.`,
                    `PR No: ${eprRecipient.prNumber}`,
                    `PO Number: ${notificationPayload.poNumber}`,
                    `Supplier: ${notificationPayload.supplier}`,
                    `Receive Date: ${receiveDateText}`,
                    `Delivery Type: ${notificationPayload.deliveryType}`,
                    `Dibuat Oleh: ${session.user.name?.trim() || session.user.email || "System"}`,
                    "",
                    `Buka EPR Integrasi: ${actionUrl}`,
                ].join("\n")

                const notificationSendResult = await sendLoggedNotificationMessage({
                    to: eprRecipient.recipientEmail,
                    subject,
                    html,
                    text,
                    channels: ["email", "push"],
                    logMeta: {
                        templateCode: "good-receive-manual-sales-pic",
                        templateName: "Good Receive Manual Sales PIC Notification",
                    },
                })

                if (!notificationSendResult.success) {
                    salesPicNotificationResult = {
                        sent: false,
                        reason: notificationSendResult.error || "Gagal mengirim notifikasi ke PIC Sales",
                        recipient: eprRecipient.recipientEmail,
                    }
                } else {
                    salesPicNotificationResult = {
                        sent: true,
                        recipient: eprRecipient.recipientEmail,
                    }
                }
            }
        } catch (salesPicNotificationError) {
            console.error("GR manual sales PIC notification error:", salesPicNotificationError)
            salesPicNotificationResult = {
                sent: false,
                reason: "Terjadi error saat mengirim notifikasi PIC Sales",
            }
        }

        return { success: true, notification: notificationResult, salesPicNotification: salesPicNotificationResult }
    } catch (error) {
        console.error("Error creating manual good receive:", error)
        return { success: false, error: "Failed to create good receive record" }
    }
}
