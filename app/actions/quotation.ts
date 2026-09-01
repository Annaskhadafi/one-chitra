"use server"

import { db } from "@/db"
import {
    deliveries,
    ocrPoSessions,
    quotationAttachments,
    quotationItems,
    quotationRevisions,
    quotations,
    salesDocuments,
    salesOrderItems,
    salesOrders,
} from "@/db/schema"
import type { QuotationPoValidationSummary, QuotationRevisionSnapshot } from "@/db/schema/quotations"
import { and, desc, eq, inArray, isNotNull, lt, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { quotationSchema } from "@/lib/schemas"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { deleteFile } from "./upload"
import { readManagedUpload } from "@/lib/upload-storage"
import { extractStructuredFromDocument } from "@/lib/mistral-ocr"
import { mapExtractedToMaster } from "@/lib/so-mapping"
import { extractUploadFilename } from "@/lib/upload-url"
import { recordActivity } from "@/lib/audit"

type QuotationInput = z.infer<typeof quotationSchema>
type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
type QuotationRecord = typeof quotations.$inferSelect
type QuotationItemRecord = typeof quotationItems.$inferSelect
type QuotationAttachmentRecord = typeof quotationAttachments.$inferSelect
type SalesOrderRecord = typeof salesOrders.$inferSelect
type QuotationPoValidationStatus = QuotationPoValidationSummary["status"]

async function hasOtherFileReferences(fileUrl: string, options?: { excludeAttachmentId?: number }) {
    const salesDocumentReference = await db.query.salesDocuments.findFirst({
        where: eq(salesDocuments.fileUrl, fileUrl),
        columns: { id: true },
    })

    if (salesDocumentReference) {
        return true
    }

    const attachmentReference = await db.query.quotationAttachments.findFirst({
        where: options?.excludeAttachmentId
            ? and(
                eq(quotationAttachments.fileUrl, fileUrl),
                sql`${quotationAttachments.id} <> ${options.excludeAttachmentId}`,
            )
            : eq(quotationAttachments.fileUrl, fileUrl),
        columns: { id: true },
    })

    return Boolean(attachmentReference)
}

const quotationAttachmentSchema = z.object({
    quotationId: z.number().int().positive(),
    title: z.string().min(1, "Attachment title is required").max(255),
    fileUrl: z.string().min(1, "File URL is required"),
    fileName: z.string().min(1, "File name is required").max(255),
    mimeType: z.string().optional().nullable(),
    fileSize: z.number().int().min(0).default(0),
    description: z.string().optional().nullable(),
    kind: z.enum(["supporting", "customer_po"]).default("supporting"),
    includeInPdf: z.boolean().default(true),
})

const quotationCustomerPoSchema = z.object({
    quotationId: z.number().int().positive(),
    poNumber: z.string().max(100).optional().nullable().transform((value) => normalizeText(value)),
    fileUrl: z.string().min(1, "PO file URL is required"),
    fileName: z.string().min(1, "PO file name is required").max(255),
    mimeType: z.string().optional().nullable(),
    fileSize: z.number().int().min(0).default(0),
})

function toValidQuotationId(value: number | string) {
    const parsed = typeof value === "number" ? value : Number.parseInt(value, 10)
    if (!Number.isInteger(parsed) || parsed <= 0) {
        return null
    }
    return parsed
}

function normalizeText(value?: string | null) {
    const trimmed = value?.trim()
    return trimmed ? trimmed : null
}

function toNumericString(value: string | number | null | undefined) {
    if (value === null || value === undefined) {
        return "0"
    }
    return typeof value === "number" ? value.toString() : value
}

function toIsoDate(value: Date | string | null | undefined) {
    if (!value) {
        return null
    }
    return new Date(value).toISOString()
}

function buildCustomerPoAttachmentTitle(poNumber: string | null | undefined, fileName: string) {
    const normalizedPoNumber = normalizeText(poNumber)
    if (normalizedPoNumber) {
        return `Customer PO ${normalizedPoNumber}`
    }

    const normalizedFileName = normalizeText(fileName)
    return normalizedFileName ? `Customer PO - ${normalizedFileName}` : "Customer PO"
}

function normalizeComparisonText(value: string | null | undefined) {
    return (value || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
}

function parseAmount(value: string | number | null | undefined) {
    const parsed = Number(value ?? 0)
    return Number.isFinite(parsed) ? parsed : 0
}

function isSameAmount(left: number, right: number, tolerance = 0.01) {
    return Math.abs(left - right) <= tolerance
}

function toFixedAmountString(value: number) {
    return value.toFixed(2)
}

type PoValidationComparisonStatus = QuotationPoValidationSummary["comparisons"][number]["status"]

type ComparableQuotationItem = {
    itemId: number
    productId: number | null
    materialNumber: string | null
    description: string | null
    quantity: number
    unitPrice: number
    comparisonKey: string
}

function buildComparableQuotationItems(
    quotation: {
        items: Array<{
            id: number
            productId: number | null
            quantity: number
            unitPrice: string | number
            description: string | null
            product: {
                materialNumber: string
                materialDescription: string | null
            } | null
        }>
    } | null | undefined
): ComparableQuotationItem[] {
    if (!quotation?.items) {
        return []
    }

    return quotation.items.map((item) => {
        const materialNumber = item.product?.materialNumber ?? null
        const description = item.description || item.product?.materialDescription || materialNumber
        const comparisonKey = item.productId
            ? `product:${item.productId}`
            : `text:${normalizeComparisonText(description || materialNumber)}`

        return {
            itemId: item.id,
            productId: item.productId,
            materialNumber,
            description,
            quantity: item.quantity,
            unitPrice: parseAmount(item.unitPrice),
            comparisonKey,
        }
    })
}

function buildMappedDataFromOcr(ocr: Awaited<ReturnType<typeof extractStructuredFromDocument>>, mapping: Awaited<ReturnType<typeof mapExtractedToMaster>>) {
    return {
        customerId: mapping.customer.id,
        customerName: ocr.structured.customer_company_name,
        customerMatchConfidence: mapping.customer.confidence,
        customerSuggestions: mapping.customer.candidates.map((candidate) => ({
            id: candidate.id,
            name: candidate.name,
            code: candidate.code,
            score: candidate.score,
        })),
        documentNumber: ocr.structured.po_number,
        documentDate: ocr.structured.document_date,
        items: ocr.structured.products.map((product, index) => {
            const mappedItem = mapping.items[index]
            return {
                ocrProductName: product.name,
                ocrProductCode: product.code || null,
                ocrQuantity: Number.isFinite(product.qty) ? product.qty : 0,
                ocrUnitPrice: Number.isFinite(product.unit_price) ? product.unit_price : 0,
                matchedProductId: mappedItem?.id ?? null,
                matchedProductName: mappedItem?.candidates[0]?.name || null,
                matchConfidence: mappedItem?.confidence ?? 0,
                isValidated: false,
            }
        }),
    }
}

function buildExtractedDataFromOcr(ocr: Awaited<ReturnType<typeof extractStructuredFromDocument>>) {
    return {
        customerName: ocr.structured.customer_company_name,
        customerCode: ocr.structured.customer_code || null,
        documentNumber: ocr.structured.po_number,
        documentDate: ocr.structured.document_date,
        items: ocr.structured.products.map((product) => ({
            productName: product.name,
            productCode: product.code || null,
            quantity: Number.isFinite(product.qty) ? product.qty : 0,
            unitPrice: Number.isFinite(product.unit_price) ? product.unit_price : 0,
            totalPrice: product.total_price == null
                ? ((Number.isFinite(product.qty) ? product.qty : 0) * (Number.isFinite(product.unit_price) ? product.unit_price : 0))
                : product.total_price,
            unit: null as string | null,
        })),
        rawText: ocr.rawText,
    }
}

function comparePoOcrAgainstQuotation(params: {
    quotation: {
        customerId: number
        items: Array<{
            id: number
            productId: number | null
            quantity: number
            unitPrice: string | number
            description: string | null
            product: {
                materialNumber: string
                materialDescription: string | null
            } | null
        }>
    }
    ocr: Awaited<ReturnType<typeof extractStructuredFromDocument>>
    mapping: Awaited<ReturnType<typeof mapExtractedToMaster>>
}): QuotationPoValidationSummary {
    const quoteItems = buildComparableQuotationItems(params.quotation)
    const usedQuotationItemIds = new Set<number>()
    const customerMatched = params.mapping.customer.id === params.quotation?.customerId
    const comparisons: QuotationPoValidationSummary["comparisons"] = []

    for (const [index, product] of params.ocr.structured.products.entries()) {
        const mappedItem = params.mapping.items[index]
        const comparisonKey = mappedItem?.id
            ? `product:${mappedItem.id}`
            : `text:${normalizeComparisonText(product.name)}`
        const candidates = quoteItems
            .filter((item) => item.comparisonKey === comparisonKey && !usedQuotationItemIds.has(item.itemId))
            .sort((left, right) => {
                const qtyDistance = Math.abs(left.quantity - product.qty) - Math.abs(right.quantity - product.qty)
                if (qtyDistance !== 0) {
                    return qtyDistance
                }
                return Math.abs(left.unitPrice - product.unit_price) - Math.abs(right.unitPrice - product.unit_price)
            })

        const matchedQuotationItem = candidates[0] ?? null
        let comparisonStatus: PoValidationComparisonStatus = "unmatched_ocr"
        let quantityDelta: number | null = null
        let priceDelta: string | null = null
        let priceDeltaPercent: number | null = null

        if (matchedQuotationItem) {
            usedQuotationItemIds.add(matchedQuotationItem.itemId)
            quantityDelta = product.qty - matchedQuotationItem.quantity

            const currentPriceDelta = product.unit_price - matchedQuotationItem.unitPrice
            priceDelta = toFixedAmountString(currentPriceDelta)
            priceDeltaPercent = matchedQuotationItem.unitPrice > 0
                ? Number((((currentPriceDelta) / matchedQuotationItem.unitPrice) * 100).toFixed(2))
                : null

            if (!isSameAmount(product.unit_price, matchedQuotationItem.unitPrice)) {
                comparisonStatus = "price_changed"
            } else if (product.qty > matchedQuotationItem.quantity) {
                comparisonStatus = "qty_exceeds"
            } else if (product.qty < matchedQuotationItem.quantity) {
                comparisonStatus = "partial_qty"
            } else {
                comparisonStatus = "matched"
            }
        }

        comparisons.push({
            key: comparisonKey,
            ocrName: product.name,
            ocrCode: product.code || null,
            ocrQuantity: product.qty,
            ocrUnitPrice: toFixedAmountString(product.unit_price),
            matchedQuotationItemId: matchedQuotationItem?.itemId ?? null,
            quotationMaterialNumber: matchedQuotationItem?.materialNumber ?? null,
            quotationDescription: matchedQuotationItem?.description ?? null,
            quotationQuantity: matchedQuotationItem?.quantity ?? null,
            quotationUnitPrice: matchedQuotationItem ? toFixedAmountString(matchedQuotationItem.unitPrice) : null,
            matchConfidence: mappedItem?.confidence ?? 0,
            status: comparisonStatus,
            quantityDelta,
            priceDelta,
            priceDeltaPercent,
        })
    }

    const unmatchedQuotationItems = quoteItems
        .filter((item) => !usedQuotationItemIds.has(item.itemId))
        .map((item) => ({
            quotationItemId: item.itemId,
            materialNumber: item.materialNumber,
            description: item.description,
            quantity: item.quantity,
            unitPrice: toFixedAmountString(item.unitPrice),
        }))

    const hasCriticalMismatch =
        !customerMatched ||
        comparisons.some((comparison) => ["unmatched_ocr", "qty_exceeds", "price_changed"].includes(comparison.status))

    const hasPartialCoverage =
        unmatchedQuotationItems.length > 0 ||
        comparisons.some((comparison) => comparison.status === "partial_qty")

    const status: QuotationPoValidationStatus = hasCriticalMismatch
        ? "mismatch"
        : hasPartialCoverage
            ? "partial_match"
            : "full_match"

    const reasons: string[] = []
    if (!customerMatched) {
        reasons.push("Customer hasil OCR tidak sama dengan customer quotation")
    }
    if (comparisons.some((comparison) => comparison.status === "unmatched_ocr")) {
        reasons.push("Ada item PO yang tidak ditemukan di quotation")
    }
    if (comparisons.some((comparison) => comparison.status === "qty_exceeds")) {
        reasons.push("Ada quantity PO yang melebihi quantity quotation")
    }
    if (comparisons.some((comparison) => comparison.status === "price_changed")) {
        reasons.push("Ada harga item PO yang berbeda dengan quotation")
    }
    if (comparisons.some((comparison) => comparison.status === "partial_qty")) {
        reasons.push("Ada quantity PO yang lebih kecil dari quotation")
    }
    if (unmatchedQuotationItems.length > 0) {
        reasons.push("Sebagian item quotation tidak tercantum di PO customer")
    }

    return {
        status,
        checkedAt: new Date().toISOString(),
        documentNumber: params.ocr.structured.po_number || null,
        documentDate: params.ocr.structured.document_date || null,
        customerName: params.ocr.structured.customer_company_name || null,
        customerMatched,
        customerConfidence: Number(params.mapping.customer.confidence.toFixed(4)),
        matchedItemCount: comparisons.filter((comparison) => comparison.status === "matched").length,
        quotationItemCount: quoteItems.length,
        ocrItemCount: comparisons.length,
        unmatchedQuotationItemCount: unmatchedQuotationItems.length,
        unmatchedOcrItemCount: comparisons.filter((comparison) => comparison.status === "unmatched_ocr").length,
        requiresManualReview: status !== "full_match",
        reasons,
        comparisons,
        unmatchedQuotationItems,
    }
}

function buildOcrFailureSummary(error: unknown): QuotationPoValidationSummary {
    const message = error instanceof Error ? error.message : "OCR validation failed"
    return {
        status: "ocr_failed",
        checkedAt: new Date().toISOString(),
        documentNumber: null,
        documentDate: null,
        customerName: null,
        customerMatched: false,
        customerConfidence: 0,
        matchedItemCount: 0,
        quotationItemCount: 0,
        ocrItemCount: 0,
        unmatchedQuotationItemCount: 0,
        unmatchedOcrItemCount: 0,
        requiresManualReview: true,
        reasons: [message],
        comparisons: [],
        unmatchedQuotationItems: [],
    }
}

function normalizeItemSignature(item: QuotationRevisionSnapshot["items"][number]) {
    return JSON.stringify({
        productId: item.productId ?? null,
        description: item.description ?? null,
        longDescription: item.longDescription ?? null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        tax: item.tax,
    })
}

function summarizeQuotationChanges(previous: QuotationRevisionSnapshot, next: QuotationRevisionSnapshot) {
    const changedFields: string[] = []
    const fieldLabels: Record<keyof QuotationRevisionSnapshot["quotation"], string> = {
        quotationNumber: "quotation number",
        customerId: "customer",
        quotationDate: "quotation date",
        validUntil: "valid until",
        subject: "subject",
        status: "status",
        paymentTerms: "payment terms",
        termsConditions: "terms & conditions",
        notes: "notes",
        salesPersonId: "sales person",
        attn: "attention",
        discount: "discount",
        tax: "tax",
        shipping: "shipping",
        address: "address",
        closingStatus: "closing status",
        tags: "tags",
        currency: "currency",
        referenceNumber: "reference number",
        adminNote: "admin note",
        clientNote: "client note",
        discountType: "discount type",
        customerPoNumber: "customer PO number",
        customerPoDocument: "customer PO document",
        customerPoUploadedAt: "customer PO upload time",
        poValidationStatus: "PO validation status",
        poValidationCheckedAt: "PO validation check time",
        poValidationOcrSessionId: "PO OCR session link",
        poValidationSummary: "PO validation summary",
        salesOrderId: "sales order link",
    }

    for (const [key, label] of Object.entries(fieldLabels) as Array<[keyof QuotationRevisionSnapshot["quotation"], string]>) {
        if (previous.quotation[key] !== next.quotation[key]) {
            changedFields.push(label)
        }
    }

    const itemChanges: string[] = []
    if (previous.items.length !== next.items.length) {
        itemChanges.push(`items ${previous.items.length} -> ${next.items.length}`)
    } else {
        const prevItems = previous.items.map(normalizeItemSignature)
        const nextItems = next.items.map(normalizeItemSignature)
        const changedLineCount = nextItems.reduce((count, signature, index) => count + (signature !== prevItems[index] ? 1 : 0), 0)
        if (changedLineCount > 0) {
            itemChanges.push(`${changedLineCount} line item${changedLineCount > 1 ? "s" : ""} updated`)
        }
    }

    const attachmentChanges: string[] = []
    if (previous.attachments.length !== next.attachments.length) {
        attachmentChanges.push(`attachments ${previous.attachments.length} -> ${next.attachments.length}`)
    } else {
        const prevAttachments = previous.attachments.map((attachment) => JSON.stringify({
            kind: attachment.kind,
            title: attachment.title,
            fileUrl: attachment.fileUrl,
            includeInPdf: attachment.includeInPdf,
        }))
        const nextAttachments = next.attachments.map((attachment) => JSON.stringify({
            kind: attachment.kind,
            title: attachment.title,
            fileUrl: attachment.fileUrl,
            includeInPdf: attachment.includeInPdf,
        }))
        const changedAttachmentCount = nextAttachments.reduce((count, signature, index) => count + (signature !== prevAttachments[index] ? 1 : 0), 0)
        if (changedAttachmentCount > 0) {
            attachmentChanges.push(`${changedAttachmentCount} attachment${changedAttachmentCount > 1 ? "s" : ""} updated`)
        }
    }

    const parts: string[] = []
    if (changedFields.length > 0) {
        parts.push(`Updated ${changedFields.slice(0, 4).join(", ")}${changedFields.length > 4 ? " and more" : ""}`)
    }
    if (itemChanges.length > 0) {
        parts.push(itemChanges.join(", "))
    }
    if (attachmentChanges.length > 0) {
        parts.push(attachmentChanges.join(", "))
    }

    return parts.join("; ") || "Quotation content updated"
}

async function getAuthenticatedUserId() {
    const session = await auth.api.getSession({
        headers: await headers(),
    })

    return session?.user?.id ?? null
}

async function getQuotationSnapshotSource(tx: DbTransaction, quotationId: number) {
    return tx.query.quotations.findFirst({
        where: eq(quotations.id, quotationId),
        with: {
            items: true,
            attachments: true,
        },
    })
}

function buildQuotationSnapshot(
    quotation: QuotationRecord,
    items: QuotationItemRecord[],
    attachments: QuotationAttachmentRecord[],
): QuotationRevisionSnapshot {
    return {
        quotation: {
            quotationNumber: quotation.quotationNumber,
            customerId: quotation.customerId,
            quotationDate: toIsoDate(quotation.quotationDate) ?? new Date().toISOString(),
            validUntil: toIsoDate(quotation.validUntil),
            subject: quotation.subject,
            status: quotation.status,
            paymentTerms: quotation.paymentTerms,
            termsConditions: quotation.termsConditions,
            notes: quotation.notes,
            salesPersonId: quotation.salesPersonId,
            attn: quotation.attn,
            discount: toNumericString(quotation.discount),
            tax: toNumericString(quotation.tax),
            shipping: toNumericString(quotation.shipping),
            address: quotation.address,
            closingStatus: quotation.closingStatus,
            tags: quotation.tags,
            currency: quotation.currency,
            referenceNumber: quotation.referenceNumber,
            adminNote: quotation.adminNote,
            clientNote: quotation.clientNote,
            discountType: quotation.discountType,
            customerPoNumber: quotation.customerPoNumber,
            customerPoDocument: quotation.customerPoDocument,
            customerPoUploadedAt: toIsoDate(quotation.customerPoUploadedAt),
            poValidationStatus: quotation.poValidationStatus,
            poValidationCheckedAt: toIsoDate(quotation.poValidationCheckedAt),
            poValidationOcrSessionId: quotation.poValidationOcrSessionId,
            poValidationSummary: quotation.poValidationSummary,
            salesOrderId: quotation.salesOrderId,
        },
        items: items.map((item) => ({
            productId: item.productId,
            description: item.description,
            longDescription: item.longDescription,
            quantity: item.quantity,
            unitPrice: toNumericString(item.unitPrice),
            discount: toNumericString(item.discount),
            tax: toNumericString(item.tax),
        })),
        attachments: attachments.map((attachment) => ({
            id: attachment.id,
            kind: attachment.kind,
            title: attachment.title,
            fileUrl: attachment.fileUrl,
            fileName: attachment.fileName,
            mimeType: attachment.mimeType,
            fileSize: attachment.fileSize,
            description: attachment.description,
            includeInPdf: attachment.includeInPdf,
            createdAt: toIsoDate(attachment.createdAt) ?? undefined,
        })),
    }
}

async function insertRevisionSnapshot(
    tx: DbTransaction,
    quotationId: number,
    revisionNumber: number,
    createdBy: string | null,
    changeSummary: string,
) {
    const source = await getQuotationSnapshotSource(tx, quotationId)
    if (!source) {
        throw new Error("Quotation not found for revision snapshot")
    }

    const snapshot = buildQuotationSnapshot(source, source.items, source.attachments)
    const now = new Date()

    await tx.insert(quotationRevisions).values({
        quotationId,
        revisionNumber,
        snapshot,
        changeSummary,
        createdBy,
        createdAt: now,
    })

    await tx.update(quotations)
        .set({
            currentRevision: revisionNumber,
            lastRevisionAt: now,
        })
        .where(eq(quotations.id, quotationId))

    return snapshot
}

async function ensureInitialRevision(tx: DbTransaction, quotationId: number, createdBy: string | null) {
    const existingRevision = await tx.query.quotationRevisions.findFirst({
        where: eq(quotationRevisions.quotationId, quotationId),
        orderBy: [desc(quotationRevisions.revisionNumber)],
    })

    if (existingRevision) {
        return existingRevision.revisionNumber
    }

    const quotation = await tx.query.quotations.findFirst({
        where: eq(quotations.id, quotationId),
        columns: {
            currentRevision: true,
        },
    })

    const initialRevisionNumber = quotation?.currentRevision && quotation.currentRevision > 0
        ? quotation.currentRevision
        : 1

    await insertRevisionSnapshot(
        tx,
        quotationId,
        initialRevisionNumber,
        createdBy,
        initialRevisionNumber === 1 ? "Initial revision created" : `Backfilled revision Rev.${initialRevisionNumber}`,
    )

    return initialRevisionNumber
}

async function createNextRevision(tx: DbTransaction, quotationId: number, createdBy: string | null, changeSummary: string) {
    const currentRevision = await ensureInitialRevision(tx, quotationId, createdBy)
    const nextRevision = currentRevision + 1
    await insertRevisionSnapshot(tx, quotationId, nextRevision, createdBy, changeSummary)
    return nextRevision
}

async function generateSalesOrderNumber(tx: DbTransaction) {
    const now = new Date()
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`
    const prefix = `SO-${dateStr}`

    const lastOrder = await tx
        .select({ invoiceNumber: salesOrders.invoiceNumber })
        .from(salesOrders)
        .where(sql`${salesOrders.invoiceNumber} like ${`${prefix}%`}`)
        .orderBy(desc(salesOrders.invoiceNumber))
        .limit(1)

    let nextNum = 1
    const lastInvoice = lastOrder[0]?.invoiceNumber
    if (lastInvoice) {
        const lastNumStr = lastInvoice.split("-").pop()
        const parsed = lastNumStr ? Number.parseInt(lastNumStr, 10) : NaN
        if (Number.isInteger(parsed)) {
            nextNum = parsed + 1
        }
    }

    return `${prefix}-${String(nextNum).padStart(4, "0")}`
}

async function syncExpiredQuotations(shouldRevalidate = true) {
    try {
        const now = new Date()
        const staleQuotations = await db.query.quotations.findMany({
            where: and(
                inArray(quotations.status, ["draft", "sent", "approved"]),
                isNotNull(quotations.validUntil),
                lt(quotations.validUntil, now),
            ),
            columns: {
                id: true,
                status: true,
                salesOrderId: true,
                createdBy: true,
            },
        })

        const candidates = staleQuotations.filter((quotation) => quotation.status !== "converted" && quotation.salesOrderId === null)
        if (candidates.length === 0) {
            return { success: true as const, expired: 0 }
        }

        const result = await db.transaction(async (tx) => {
            let expiredCount = 0

            for (const quotation of candidates) {
                await tx.update(quotations)
                    .set({
                        status: "expired",
                        expiredAt: now,
                        updatedAt: now,
                    })
                    .where(eq(quotations.id, quotation.id))

                await createNextRevision(
                    tx,
                    quotation.id,
                    quotation.createdBy ?? null,
                    "Quotation auto-expired after validity date passed",
                )
                expiredCount += 1
            }

            return expiredCount
        })

        if (shouldRevalidate && result > 0) {
            revalidatePath("/dashboard/quotations")
        }

        return { success: true as const, expired: result }
    } catch (error) {
        console.error("Failed to sync expired quotations:", error)
        return { success: false as const, error: "Failed to sync expired quotations" }
    }
}

function buildSalesOrderNotes(quotation: Awaited<ReturnType<typeof db.query.quotations.findFirst>>) {
    if (!quotation) {
        return null
    }

    return [
        `Converted from quotation ${quotation.quotationNumber || `#${quotation.id}`}`,
        quotation.referenceNumber ? `Reference: ${quotation.referenceNumber}` : null,
        quotation.subject ? `Subject: ${quotation.subject}` : null,
        quotation.paymentTerms ? `Payment Terms: ${quotation.paymentTerms}` : null,
        quotation.notes ? `Quotation Notes: ${quotation.notes}` : null,
        quotation.adminNote ? `Admin Note: ${quotation.adminNote}` : null,
        quotation.clientNote ? `Client Note: ${quotation.clientNote}` : null,
    ].filter(Boolean).join("\n")
}

async function linkSalesOrderToQuotationRecord(tx: DbTransaction, params: {
    quotationId: number
    salesOrderId: number
    triggeredBy: string | null
    sourceType: string
    markAsConverted?: boolean
}) {
    const quotation = await tx.query.quotations.findFirst({
        where: eq(quotations.id, params.quotationId),
        with: {
            items: true,
        },
    })

    if (!quotation) {
        return { success: false as const, error: "Quotation not found" }
    }

    const currentRevision = await ensureInitialRevision(tx, quotation.id, params.triggeredBy)

    await tx.update(salesOrders)
        .set({
            sourceType: params.sourceType,
            quotationId: quotation.id,
            quotationNumber: quotation.quotationNumber,
            quotationRevision: currentRevision,
            quotationSubject: quotation.subject,
            quotationReferenceNumber: quotation.referenceNumber,
            quotationValidUntil: quotation.validUntil,
            quotationCurrency: quotation.currency,
            quotationDiscountType: quotation.discountType,
            quotationTax: quotation.tax,
            quotationAdminNote: quotation.adminNote,
            quotationClientNote: quotation.clientNote,
            customerAttn: quotation.attn,
            updatedAt: new Date(),
        })
        .where(eq(salesOrders.id, params.salesOrderId))

    await tx.update(salesOrderItems)
        .set({
            sourceQuotationItemId: sql`case when ${salesOrderItems.productId} = ${quotationItems.productId} then ${quotationItems.id} else ${salesOrderItems.sourceQuotationItemId} end`,
        })
        .from(quotationItems)
        .where(and(
            eq(quotationItems.quotationId, quotation.id),
            eq(salesOrderItems.salesOrderId, params.salesOrderId),
            eq(salesOrderItems.productId, quotationItems.productId),
        ))

    await tx.update(quotations)
        .set({
            salesOrderId: params.salesOrderId,
            status: params.markAsConverted === false ? quotation.status : "converted",
            updatedAt: new Date(),
        })
        .where(eq(quotations.id, quotation.id))

    await createNextRevision(
        tx,
        quotation.id,
        params.triggeredBy,
        params.markAsConverted === false
            ? `Sales Order ${params.salesOrderId} linked from OCR validation`
            : `Linked to Sales Order ${params.salesOrderId} from OCR validation`,
    )

    return { success: true as const }
}

type ConvertQuotationOptions = {
    triggeredBy?: string | null
    forceAuto?: boolean
    customerPoNumber?: string | null
    poDocument?: string | null
    poReceivedAt?: Date | null
}

export async function getQuotations() {
    // Jalankan auto-expire di background secara non-blocking agar tidak menahan query utama
    void syncExpiredQuotations(false).catch((error) => {
        console.error("Background quotation expiry sync failed:", error)
    })

    const rows = await db.query.quotations.findMany({
        with: {
            customer: true,
            salesPerson: true,
            createdByUser: true,
            items: {
                with: {
                    product: true,
                },
            },
            attachments: {
                with: {
                    uploadedByUser: true,
                },
                orderBy: [desc(quotationAttachments.createdAt)],
            },
        },
        orderBy: [desc(quotations.createdAt)],
    })

    const salesOrderIds = Array.from(
        new Set(
            rows
                .map((quotation) => quotation.salesOrderId)
                .filter((value): value is number => value !== null && Number.isInteger(value) && value > 0)
        )
    )

    if (salesOrderIds.length === 0) {
        return rows.map((quotation) => ({
            ...quotation,
            relatedDeliveries: [],
        }))
    }

    const relatedDeliveries = await db.query.deliveries.findMany({
        where: inArray(deliveries.salesOrderId, salesOrderIds),
        with: {
            warehouse: true,
            createdByUser: true,
            items: true,
        },
        orderBy: [desc(deliveries.scheduledDate), desc(deliveries.createdAt)],
    })

    const deliveryMap = new Map<number, typeof relatedDeliveries>()
    for (const delivery of relatedDeliveries) {
        const current = deliveryMap.get(delivery.salesOrderId) ?? []
        current.push(delivery)
        deliveryMap.set(delivery.salesOrderId, current)
    }

    return rows.map((quotation) => ({
        ...quotation,
        relatedDeliveries: quotation.salesOrderId ? (deliveryMap.get(quotation.salesOrderId) ?? []) : [],
    }))
}

export async function getQuotation(id: number | string) {
    // Jalankan auto-expire di background secara non-blocking agar tidak menahan query detail
    void syncExpiredQuotations(false).catch((error) => {
        console.error("Background quotation expiry sync failed:", error)
    })

    const safeId = toValidQuotationId(id)
    if (safeId === null) {
        return null
    }

    const quotation = await db.query.quotations.findFirst({
        where: eq(quotations.id, safeId),
        with: {
            customer: true,
            salesPerson: true,
            items: {
                with: {
                    product: true,
                },
            },
        },
    })

    if (!quotation) {
        return null
    }

    const [attachments, revisions] = await Promise.all([
        db.query.quotationAttachments.findMany({
            where: eq(quotationAttachments.quotationId, safeId),
            with: {
                uploadedByUser: true,
            },
            orderBy: [desc(quotationAttachments.createdAt)],
        }),
        db.query.quotationRevisions.findMany({
            where: eq(quotationRevisions.quotationId, safeId),
            with: {
                createdByUser: true,
            },
            orderBy: [desc(quotationRevisions.revisionNumber)],
        }),
    ])

    return {
        ...quotation,
        attachments,
        revisions,
    }
}

export async function generateQuotationNumber() {
    const now = new Date()
    const month = String(now.getMonth() + 1).padStart(2, "0")
    const year = now.getFullYear()

    const allQuotations = await db.select({ quotationNumber: quotations.quotationNumber }).from(quotations)
    let maxNumber = 4999

    allQuotations.forEach((quotation) => {
        if (quotation.quotationNumber?.startsWith("QUO/CP/")) {
            const parts = quotation.quotationNumber.split("/")
            if (parts.length >= 3) {
                const parsed = Number.parseInt(parts[2] ?? "", 10)
                if (!Number.isNaN(parsed) && parsed > maxNumber) {
                    maxNumber = parsed
                }
            }
        }
    })

    return `QUO/CP/${maxNumber + 1}/${month}/${year}`
}

export async function createQuotation(data: QuotationInput) {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        })
        const userId = session?.user?.id || "system"
        const quotationNumber = data.quotationNumber || await generateQuotationNumber()
        const now = new Date()

        const result = await db.transaction(async (tx) => {
            const insertedQuotationRows = await tx.insert(quotations)
                .values({
                    quotationNumber,
                    customerId: data.customerId,
                    quotationDate: new Date(data.quotationDate),
                    validUntil: data.validUntil ? new Date(data.validUntil) : null,
                    subject: normalizeText(data.subject),
                    salesPersonId: normalizeText(data.salesPersonId),
                    attn: normalizeText(data.attn),
                    createdBy: userId,
                    status: data.status,
                    paymentTerms: normalizeText(data.paymentTerms),
                    termsConditions: normalizeText(data.termsConditions),
                    notes: normalizeText(data.notes),
                    discount: data.discount.toString(),
                    tax: data.tax.toString(),
                    shipping: data.shipping.toString(),
                    address: normalizeText(data.address),
                    closingStatus: normalizeText(data.closingStatus),
                    tags: normalizeText(data.tags),
                    currency: data.currency || "IDR",
                    referenceNumber: normalizeText(data.referenceNumber),
                    adminNote: normalizeText(data.adminNote),
                    clientNote: normalizeText(data.clientNote),
                    discountType: data.discountType || "fixed",
                    currentRevision: 1,
                    lastRevisionAt: now,
                })
                .returning() as QuotationRecord[]

            const newQuotation = insertedQuotationRows[0]

            if (data.items.length > 0) {
                await tx.insert(quotationItems).values(
                    data.items.map((item) => ({
                        quotationId: newQuotation.id,
                        productId: item.productId || null,
                        description: normalizeText(item.description),
                        longDescription: normalizeText(item.longDescription),
                        quantity: item.quantity,
                        unitPrice: item.unitPrice.toString(),
                        discount: item.discount.toString(),
                        tax: item.tax.toString(),
                    })),
                )
            }

            if (data.attachments && data.attachments.length > 0) {
                await tx.insert(quotationAttachments).values(
                    data.attachments.map((attachment) => ({
                        quotationId: newQuotation.id,
                        kind: attachment.kind || "supporting",
                        title: attachment.title,
                        fileUrl: attachment.fileUrl,
                        fileName: attachment.fileName,
                        mimeType: attachment.mimeType || null,
                        fileSize: attachment.fileSize || 0,
                        description: normalizeText(attachment.description),
                        includeInPdf: attachment.includeInPdf ?? true,
                        uploadedBy: userId,
                    }))
                )
            }

            await insertRevisionSnapshot(tx, newQuotation.id, 1, userId, "Initial revision created")

            revalidatePath("/dashboard/quotations")
            return { success: true as const, id: newQuotation.id }
        })

        if (result.success) {
            await recordActivity({
                action: "CREATE",
                tableName: "quotations",
                recordId: result.id.toString(),
                description: `Membuat Quotation baru ${quotationNumber}`,
            })
        }

        return result
    } catch (error) {
        console.error("Failed to create quotation:", error)
        return { success: false as const, error: "Failed to create quotation" }
    }
}

export async function updateQuotation(id: number, data: QuotationInput) {
    try {
        const userId = (await getAuthenticatedUserId()) || "system"

        const result = await db.transaction(async (tx) => {
            const originalQuotation = await tx.query.quotations.findFirst({
                where: eq(quotations.id, id),
                with: {
                    items: true,
                    attachments: true,
                },
            })

            if (!originalQuotation) {
                return { success: false as const, error: "Quotation not found" }
            }

            await ensureInitialRevision(tx, id, userId)
            const previousSnapshot = buildQuotationSnapshot(originalQuotation, originalQuotation.items, originalQuotation.attachments)

            await tx.update(quotations)
                .set({
                    quotationNumber: data.quotationNumber || undefined,
                    customerId: data.customerId,
                    quotationDate: new Date(data.quotationDate),
                    validUntil: data.validUntil ? new Date(data.validUntil) : null,
                    subject: normalizeText(data.subject),
                    salesPersonId: normalizeText(data.salesPersonId),
                    attn: normalizeText(data.attn),
                    status: data.status,
                    paymentTerms: normalizeText(data.paymentTerms),
                    termsConditions: normalizeText(data.termsConditions),
                    notes: normalizeText(data.notes),
                    discount: data.discount.toString(),
                    tax: data.tax.toString(),
                    shipping: data.shipping.toString(),
                    address: normalizeText(data.address),
                    closingStatus: normalizeText(data.closingStatus),
                    tags: normalizeText(data.tags),
                    currency: data.currency || "IDR",
                    referenceNumber: normalizeText(data.referenceNumber),
                    adminNote: normalizeText(data.adminNote),
                    clientNote: normalizeText(data.clientNote),
                    discountType: data.discountType || "fixed",
                    expiredAt: data.status === "expired" ? new Date() : null,
                    updatedAt: new Date(),
                })
                .where(eq(quotations.id, id))

            await tx.delete(quotationItems).where(eq(quotationItems.quotationId, id))

            if (data.items.length > 0) {
                await tx.insert(quotationItems).values(
                    data.items.map((item) => ({
                        quotationId: id,
                        productId: item.productId || null,
                        description: normalizeText(item.description),
                        longDescription: normalizeText(item.longDescription),
                        quantity: item.quantity,
                        unitPrice: item.unitPrice.toString(),
                        discount: item.discount.toString(),
                        tax: item.tax.toString(),
                    })),
                )
            }

            // Handle Update Attachments
            const oldAttachments = originalQuotation.attachments || []
            const currentUrls = new Set((data.attachments || []).map(a => a.fileUrl))
            const urlsToDelete = oldAttachments
                .filter(a => !currentUrls.has(a.fileUrl))
                .map(a => a.fileUrl)

            if (urlsToDelete.length > 0) {
                await cleanupQuotationFiles(urlsToDelete)
            }

            await tx.delete(quotationAttachments).where(eq(quotationAttachments.quotationId, id))

            if (data.attachments && data.attachments.length > 0) {
                await tx.insert(quotationAttachments).values(
                    data.attachments.map((attachment) => ({
                        quotationId: id,
                        kind: attachment.kind || "supporting",
                        title: attachment.title,
                        fileUrl: attachment.fileUrl,
                        fileName: attachment.fileName,
                        mimeType: attachment.mimeType || null,
                        fileSize: attachment.fileSize || 0,
                        description: normalizeText(attachment.description),
                        includeInPdf: attachment.includeInPdf ?? true,
                        uploadedBy: userId,
                    }))
                )
            }

            const nextSource = await getQuotationSnapshotSource(tx, id)
            if (!nextSource) {
                return { success: false as const, error: "Quotation not found after update" }
            }

            const nextSnapshot = buildQuotationSnapshot(nextSource, nextSource.items, nextSource.attachments)
            await createNextRevision(tx, id, userId, summarizeQuotationChanges(previousSnapshot, nextSnapshot))

            revalidatePath("/dashboard/quotations")
            revalidatePath(`/dashboard/quotations/${id}`)
            return { success: true as const }
        })

        if (result.success) {
            await recordActivity({
                action: "UPDATE",
                tableName: "quotations",
                recordId: id.toString(),
                description: `Memperbarui Quotation ${data.quotationNumber || id}`,
            })
        }

        return result
    } catch (error) {
        console.error("Failed to update quotation:", error)
        return { success: false as const, error: "Failed to update quotation" }
    }
}

async function cleanupQuotationFiles(fileUrls: Array<string | null | undefined>) {
    await Promise.all(
        Array.from(new Set(fileUrls.filter((fileUrl): fileUrl is string => Boolean(fileUrl))))
            .map((fileUrl) => deleteFile(fileUrl)),
    )
}

export async function deleteQuotation(id: number) {
    try {
        const userId = await getAuthenticatedUserId()
        if (!userId) {
            return { success: false as const, error: "Unauthorized" }
        }

        const safeId = toValidQuotationId(id)
        if (safeId === null) {
            return { success: false as const, error: "Invalid quotation id" }
        }

        const quotation = await db.query.quotations.findFirst({
            where: eq(quotations.id, safeId),
            columns: {
                id: true,
                quotationNumber: true,
                createdBy: true,
                customerPoDocument: true,
            },
        })

        if (!quotation) {
            return { success: false as const, error: "Quotation not found" }
        }

        if (quotation.createdBy !== userId) {
            return { success: false as const, error: "You can only delete quotations you created" }
        }

        const attachments = await db.query.quotationAttachments.findMany({
            where: eq(quotationAttachments.quotationId, safeId),
            columns: {
                fileUrl: true,
            },
        })

        await db.delete(quotations).where(and(
            eq(quotations.id, safeId),
            eq(quotations.createdBy, userId),
        ))

        await recordActivity({
            action: "DELETE",
            tableName: "quotations",
            recordId: safeId.toString(),
            description: `Menghapus Quotation ${quotation.quotationNumber || safeId}`,
        })

        await cleanupQuotationFiles([
            quotation.customerPoDocument,
            ...attachments.map((attachment) => attachment.fileUrl),
        ])

        revalidatePath("/dashboard/quotations")
        return { success: true as const }
    } catch (_error) {
        return { success: false as const, error: "Failed to delete quotation" }
    }
}

export async function bulkDeleteQuotations(ids: number[]) {
    try {
        const userId = await getAuthenticatedUserId()
        if (!userId) {
            return { success: false as const, error: "Unauthorized" }
        }

        const safeIds = Array.from(
            new Set(ids.map((id) => toValidQuotationId(id)).filter((id): id is number => id !== null)),
        )

        if (safeIds.length === 0) {
            return { success: false as const, error: "No valid quotations selected" }
        }

        const ownedQuotations = await db.query.quotations.findMany({
            where: and(
                inArray(quotations.id, safeIds),
                eq(quotations.createdBy, userId),
            ),
            columns: {
                id: true,
                quotationNumber: true,
                customerPoDocument: true,
            },
        })

        if (ownedQuotations.length !== safeIds.length) {
            return { success: false as const, error: "You can only delete quotations you created" }
        }

        const attachments = await db.query.quotationAttachments.findMany({
            where: inArray(quotationAttachments.quotationId, safeIds),
            columns: {
                fileUrl: true,
            },
        })

        await db.delete(quotations).where(and(
            inArray(quotations.id, safeIds),
            eq(quotations.createdBy, userId),
        ))

        for (const quotation of ownedQuotations) {
            await recordActivity({
                action: "DELETE",
                tableName: "quotations",
                recordId: quotation.id.toString(),
                description: `Menghapus Quotation ${quotation.quotationNumber || quotation.id}`,
            })
        }

        await cleanupQuotationFiles([
            ...ownedQuotations.map((quotation) => quotation.customerPoDocument),
            ...attachments.map((attachment) => attachment.fileUrl),
        ])

        revalidatePath("/dashboard/quotations")
        return { success: true as const }
    } catch (error) {
        console.error("Bulk delete quotation error:", error)
        return { success: false as const, error: "Failed to delete quotations" }
    }
}

export async function approveQuotation(id: number) {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        })
        const userId = session?.user?.id || null

        await db.transaction(async (tx) => {
            await tx.update(quotations)
                .set({
                    status: "approved",
                    approvedAt: new Date(),
                    approvedBy: userId,
                    updatedAt: new Date(),
                })
                .where(eq(quotations.id, id))

            await createNextRevision(tx, id, userId, "Quotation approved")
        })

        revalidatePath("/dashboard/quotations")
        revalidatePath(`/dashboard/quotations/${id}`)
        return { success: true as const }
    } catch (error) {
        console.error("Failed to approve quotation:", error)
        return { success: false as const, error: "Failed to approve quotation" }
    }
}

export async function rejectQuotation(id: number, reason: string) {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        })
        const userId = session?.user?.id || null

        await db.transaction(async (tx) => {
            await tx.update(quotations)
                .set({
                    status: "rejected",
                    rejectedAt: new Date(),
                    rejectedBy: userId,
                    rejectionReason: reason,
                    updatedAt: new Date(),
                })
                .where(eq(quotations.id, id))

            await createNextRevision(tx, id, userId, `Quotation rejected: ${reason}`)
        })

        revalidatePath("/dashboard/quotations")
        revalidatePath(`/dashboard/quotations/${id}`)
        return { success: true as const }
    } catch (error) {
        console.error("Failed to reject quotation:", error)
        return { success: false as const, error: "Failed to reject quotation" }
    }
}

export async function convertToSalesOrder(id: number, options?: ConvertQuotationOptions) {
    try {
        const triggeredBy = options?.triggeredBy ?? await getAuthenticatedUserId()

        return db.transaction(async (tx) => {
            const quotation = await tx.query.quotations.findFirst({
                where: eq(quotations.id, id),
                with: {
                    customer: true,
                    items: {
                        with: { product: true },
                    },
                    attachments: true,
                },
            })

            if (!quotation) {
                return { success: false as const, error: "Quotation not found" }
            }

            if (quotation.status === "converted" || quotation.salesOrderId) {
                return {
                    success: false as const,
                    error: "Quotation has already been converted",
                    salesOrderId: quotation.salesOrderId ?? undefined,
                }
            }

            if (quotation.status === "rejected") {
                return { success: false as const, error: "Rejected quotation cannot be converted" }
            }

            if (
                quotation.customerPoNumber &&
                ["partial_match", "mismatch", "ocr_failed", "pending_ocr"].includes(quotation.poValidationStatus || "")
            ) {
                return {
                    success: false as const,
                    error: "Customer PO quotation masih perlu divalidasi melalui OCR sebelum bisa dikonversi",
                    ocrSessionId: quotation.poValidationOcrSessionId ?? undefined,
                }
            }

            const resolvedCustomerPo = normalizeText(options?.customerPoNumber) ?? quotation.customerPoNumber
            const poDocument = normalizeText(options?.poDocument) ?? quotation.customerPoDocument
            const poReceivedAt = options?.poReceivedAt ?? quotation.customerPoUploadedAt ?? null
            const canConvert = quotation.status === "approved" || Boolean(resolvedCustomerPo || poDocument)

            if (!canConvert) {
                return { success: false as const, error: "Quotation must be approved or have a customer PO before conversion" }
            }

            const invoiceNumber = await generateSalesOrderNumber(tx)
            const currentRevision = await ensureInitialRevision(tx, quotation.id, triggeredBy)
            const composedTerms = [quotation.paymentTerms, quotation.termsConditions].filter(Boolean).join("\n\n")

            const insertedSalesOrderRows = await tx.insert(salesOrders)
                .values({
                    invoiceNumber,
                    customerPo: resolvedCustomerPo,
                    customerId: quotation.customerId,
                    salesPersonId: quotation.salesPersonId,
                    salesDate: new Date(),
                    poReceive: poReceivedAt ? new Date(poReceivedAt) : null,
                    poDocument,
                    status: "draft",
                    termsConditions: composedTerms || null,
                    notes: buildSalesOrderNotes(quotation),
                    discount: quotation.discount,
                    shipping: quotation.shipping,
                    createdBy: triggeredBy,
                    sourceType: resolvedCustomerPo || poDocument ? "quotation_po" : "quotation",
                    quotationId: quotation.id,
                    quotationNumber: quotation.quotationNumber,
                    quotationRevision: currentRevision,
                    quotationSubject: quotation.subject,
                    quotationReferenceNumber: quotation.referenceNumber,
                    quotationValidUntil: quotation.validUntil,
                    quotationCurrency: quotation.currency,
                    quotationDiscountType: quotation.discountType,
                    quotationTax: quotation.tax,
                    quotationAdminNote: quotation.adminNote,
                    quotationClientNote: quotation.clientNote,
                    customerAttn: quotation.attn,
                })
                .returning() as SalesOrderRecord[]

            const newSO = insertedSalesOrderRows[0]

            if (quotation.items.length > 0) {
                await tx.insert(salesOrderItems).values(
                    quotation.items.map((item) => ({
                        salesOrderId: newSO.id,
                        productId: item.productId || null,
                        sourceQuotationItemId: item.id,
                        description: item.description,
                        longDescription: item.longDescription,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        discount: item.discount,
                        tax: item.tax,
                    })),
                )
            }

            await tx.update(quotations)
                .set({
                    status: "converted",
                    salesOrderId: newSO.id,
                    customerPoNumber: resolvedCustomerPo,
                    customerPoDocument: poDocument,
                    customerPoUploadedAt: poReceivedAt ? new Date(poReceivedAt) : quotation.customerPoUploadedAt,
                    autoConvertedAt: options?.forceAuto ? new Date() : quotation.autoConvertedAt,
                    autoConvertedBy: options?.forceAuto ? triggeredBy : quotation.autoConvertedBy,
                    updatedAt: new Date(),
                })
                .where(eq(quotations.id, id))

            await createNextRevision(
                tx,
                id,
                triggeredBy,
                options?.forceAuto
                    ? `Customer PO uploaded and quotation auto-converted to Sales Order ${invoiceNumber}`
                    : `Converted to Sales Order ${invoiceNumber}`,
            )

            revalidatePath("/dashboard/quotations")
            revalidatePath(`/dashboard/quotations/${id}`)
            revalidatePath("/dashboard/sales-orders")
            return { success: true as const, salesOrderId: newSO.id }
        })
    } catch (error) {
        console.error("Failed to convert quotation to SO:", error)
        return { success: false as const, error: "Failed to convert quotation to Sales Order" }
    }
}

export async function duplicateQuotation(id: number) {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        })
        const userId = session?.user?.id || "system"

        return db.transaction(async (tx) => {
            const originalQuotation = await tx.query.quotations.findFirst({
                where: eq(quotations.id, id),
                with: {
                    items: true,
                },
            })

            if (!originalQuotation) {
                return { success: false as const, error: "Original quotation not found" }
            }

            const quotationNumber = await generateQuotationNumber()

            const insertedQuotationRows = await tx.insert(quotations)
                .values({
                    quotationNumber,
                    customerId: originalQuotation.customerId,
                    quotationDate: new Date(),
                    validUntil: originalQuotation.validUntil,
                    subject: originalQuotation.subject ? `${originalQuotation.subject} (Copy)` : "Copy",
                    salesPersonId: originalQuotation.salesPersonId,
                    attn: originalQuotation.attn,
                    createdBy: userId,
                    status: "draft",
                    paymentTerms: originalQuotation.paymentTerms,
                    termsConditions: originalQuotation.termsConditions,
                    notes: originalQuotation.notes ? `Duplicated from ${originalQuotation.quotationNumber}. ${originalQuotation.notes}` : `Duplicated from ${originalQuotation.quotationNumber}`,
                    discount: originalQuotation.discount,
                    tax: originalQuotation.tax,
                    shipping: originalQuotation.shipping,
                    address: originalQuotation.address,
                    closingStatus: originalQuotation.closingStatus,
                    tags: originalQuotation.tags,
                    currency: originalQuotation.currency,
                    referenceNumber: originalQuotation.referenceNumber,
                    adminNote: originalQuotation.adminNote,
                    clientNote: originalQuotation.clientNote,
                    discountType: originalQuotation.discountType,
                    currentRevision: 1,
                    lastRevisionAt: new Date(),
                })
                .returning() as QuotationRecord[]

            const newQuotation = insertedQuotationRows[0]

            if (originalQuotation.items.length > 0) {
                await tx.insert(quotationItems).values(
                    originalQuotation.items.map((item) => ({
                        quotationId: newQuotation.id,
                        productId: item.productId,
                        description: item.description,
                        longDescription: item.longDescription,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        discount: item.discount,
                        tax: item.tax,
                    })),
                )
            }

            await insertRevisionSnapshot(tx, newQuotation.id, 1, userId, "Initial revision created from duplicated quotation")

            revalidatePath("/dashboard/quotations")
            return { success: true as const, id: newQuotation.id }
        })
    } catch (error) {
        console.error("Failed to duplicate quotation:", error)
        return { success: false as const, error: "Failed to duplicate quotation" }
    }
}

export async function updateQuotationStatus(id: number, status: string) {
    try {
        const userId = await getAuthenticatedUserId()

        await db.transaction(async (tx) => {
            await tx.update(quotations)
                .set({
                    status,
                    expiredAt: status === "expired" ? new Date() : null,
                    updatedAt: new Date(),
                })
                .where(eq(quotations.id, id))

            await createNextRevision(tx, id, userId, `Quotation status updated to ${status}`)
        })

        revalidatePath("/dashboard/quotations")
        revalidatePath(`/dashboard/quotations/${id}`)
        return { success: true as const }
    } catch (error) {
        console.error("Failed to update quotation status:", error)
        return { success: false as const, error: "Failed to update status" }
    }
}

export async function bulkUpdateQuotationStatus(ids: number[], status: string) {
    try {
        const userId = await getAuthenticatedUserId()

        await db.transaction(async (tx) => {
            for (const id of ids) {
                await tx.update(quotations)
                    .set({
                        status,
                        expiredAt: status === "expired" ? new Date() : null,
                        updatedAt: new Date(),
                    })
                    .where(eq(quotations.id, id))

                await createNextRevision(tx, id, userId, `Quotation status updated to ${status}`)
            }
        })

        revalidatePath("/dashboard/quotations")
        return { success: true as const }
    } catch (error) {
        console.error("Failed to bulk update quotation status:", error)
        return { success: false as const, error: "Failed to update statuses" }
    }
}

export async function createQuotationAttachment(input: z.infer<typeof quotationAttachmentSchema>) {
    try {
        const payload = quotationAttachmentSchema.parse(input)
        const userId = await getAuthenticatedUserId()
        if (!userId) {
            return { success: false as const, error: "Unauthorized" }
        }

        const result = await db.transaction(async (tx) => {
            const quotation = await tx.query.quotations.findFirst({
                where: eq(quotations.id, payload.quotationId),
                columns: { id: true },
            })

            if (!quotation) {
                return { success: false as const, error: "Quotation not found" }
            }

            const insertedAttachmentRows = await tx.insert(quotationAttachments)
                .values({
                    quotationId: payload.quotationId,
                    title: payload.title.trim(),
                    fileUrl: payload.fileUrl,
                    fileName: payload.fileName,
                    mimeType: normalizeText(payload.mimeType),
                    fileSize: payload.fileSize,
                    description: normalizeText(payload.description),
                    kind: payload.kind,
                    includeInPdf: payload.includeInPdf,
                    uploadedBy: userId,
                })
                .returning() as QuotationAttachmentRecord[]

            const attachment = insertedAttachmentRows[0]

            await createNextRevision(tx, payload.quotationId, userId, `Attachment added: ${payload.title}`)
            return { success: true as const, attachmentId: attachment.id }
        })

        revalidatePath(`/dashboard/quotations/${payload.quotationId}`)
        revalidatePath("/dashboard/quotations")
        return result
    } catch (error) {
        console.error("Failed to create quotation attachment:", error)
        return { success: false as const, error: error instanceof Error ? error.message : "Failed to create attachment" }
    }
}

export async function attachSalesDocumentsToQuotation(input: {
    quotationId: number
    salesDocumentIds: string[]
    title?: string | null
    description?: string | null
    includeInPdf?: boolean
}) {
    try {
        const userId = await getAuthenticatedUserId()
        if (!userId) {
            return { success: false as const, error: "Unauthorized" }
        }

        const quotationId = toValidQuotationId(input.quotationId)
        const salesDocumentIds = Array.from(
            new Set((input.salesDocumentIds || []).map((id) => id.trim()).filter(Boolean)),
        )

        if (!quotationId) {
            return { success: false as const, error: "Quotation tidak valid" }
        }

        if (salesDocumentIds.length === 0) {
            return { success: false as const, error: "Pilih minimal satu Sales Document" }
        }

        const documents = await db.query.salesDocuments.findMany({
            where: inArray(salesDocuments.id, salesDocumentIds),
            orderBy: [desc(salesDocuments.createdAt)],
        })

        if (documents.length === 0) {
            return { success: false as const, error: "Sales Document tidak ditemukan" }
        }

        const existingAttachments = await db.query.quotationAttachments.findMany({
            where: and(
                eq(quotationAttachments.quotationId, quotationId),
                eq(quotationAttachments.kind, "supporting"),
            ),
            columns: {
                fileUrl: true,
            },
        })

        const existingFileUrls = new Set(existingAttachments.map((attachment) => attachment.fileUrl))
        const failures: string[] = []
        const attachmentsToInsert: Array<typeof quotationAttachments.$inferInsert> = []

        for (const document of documents) {
            const attachmentTitle = normalizeText(input.title) || document.title
            if (!attachmentTitle) {
                failures.push(`${document.fileName}: title attachment tidak valid`)
                continue
            }

            if (existingFileUrls.has(document.fileUrl)) {
                failures.push(`${document.title}: sudah terpasang pada quotation ini`)
                continue
            }

            existingFileUrls.add(document.fileUrl)
            attachmentsToInsert.push({
                quotationId,
                title: attachmentTitle,
                fileUrl: document.fileUrl,
                fileName: document.fileName,
                mimeType: normalizeText(document.fileType),
                fileSize: 0,
                description: normalizeText(input.description) || normalizeText(document.description),
                kind: "supporting",
                includeInPdf: input.includeInPdf ?? true,
                uploadedBy: userId,
            })
        }

        if (attachmentsToInsert.length > 0) {
            await db.transaction(async (tx) => {
                await tx.insert(quotationAttachments).values(attachmentsToInsert)

                const summary =
                    attachmentsToInsert.length === 1
                        ? `Attachment added from Sales Document: ${attachmentsToInsert[0].title}`
                        : `${attachmentsToInsert.length} attachments added from Sales Document`

                await createNextRevision(tx, quotationId, userId, summary)
            })
        }

        const attachedCount = attachmentsToInsert.length

        if (attachedCount === 0) {
            return {
                success: false as const,
                error: failures[0] || "Sales Document gagal ditambahkan ke quotation",
            }
        }

        revalidatePath(`/dashboard/quotations/${quotationId}`)
        revalidatePath("/dashboard/quotations")

        return {
            success: true as const,
            attachedCount,
            skippedCount: failures.length,
            failures,
        }
    } catch (error) {
        console.error("Failed to attach sales documents to quotation:", error)
        return { success: false as const, error: "Sales Document gagal ditambahkan ke quotation" }
    }
}

export async function deleteQuotationAttachment(attachmentId: number) {
    try {
        const userId = await getAuthenticatedUserId()
        if (!userId) {
            return { success: false as const, error: "Unauthorized" }
        }

        const attachment = await db.query.quotationAttachments.findFirst({
            where: eq(quotationAttachments.id, attachmentId),
        })

        if (!attachment) {
            return { success: false as const, error: "Attachment not found" }
        }

        await db.transaction(async (tx) => {
            await tx.delete(quotationAttachments).where(eq(quotationAttachments.id, attachmentId))

            if (attachment.kind === "customer_po") {
                const linkedQuotation = await tx.query.quotations.findFirst({
                    where: eq(quotations.id, attachment.quotationId),
                    columns: {
                        salesOrderId: true,
                        customerPoDocument: true,
                    },
                })

                if (linkedQuotation?.customerPoDocument === attachment.fileUrl) {
                    await tx.update(quotations)
                        .set({
                            customerPoDocument: null,
                            customerPoNumber: null,
                            customerPoUploadedAt: null,
                            customerPoUploadedBy: null,
                            updatedAt: new Date(),
                        })
                        .where(eq(quotations.id, attachment.quotationId))

                    if (linkedQuotation.salesOrderId) {
                        await tx.update(salesOrders)
                            .set({
                                customerPo: null,
                                poDocument: null,
                                poReceive: null,
                                updatedAt: new Date(),
                            })
                            .where(eq(salesOrders.id, linkedQuotation.salesOrderId))
                    }
                }
            }

            await createNextRevision(tx, attachment.quotationId, userId, `Attachment removed: ${attachment.title}`)
        })

        const hasOtherReferences = await hasOtherFileReferences(attachment.fileUrl, {
            excludeAttachmentId: attachmentId,
        })

        if (!hasOtherReferences) {
            await deleteFile(attachment.fileUrl)
        }

        revalidatePath(`/dashboard/quotations/${attachment.quotationId}`)
        revalidatePath("/dashboard/quotations")
        return { success: true as const }
    } catch (error) {
        console.error("Failed to delete quotation attachment:", error)
        return { success: false as const, error: "Failed to delete attachment" }
    }
}

export async function uploadQuotationCustomerPo(input: z.infer<typeof quotationCustomerPoSchema>) {
    try {
        const payload = quotationCustomerPoSchema.parse(input)
        const userId = await getAuthenticatedUserId()
        if (!userId) {
            return { success: false as const, error: "Unauthorized" }
        }

        const poReceivedAt = new Date()

        const uploadResult = await db.transaction(async (tx) => {
            const quotation = await tx.query.quotations.findFirst({
                where: eq(quotations.id, payload.quotationId),
                columns: {
                    id: true,
                    status: true,
                    salesOrderId: true,
                },
            })

            if (!quotation) {
                return { success: false as const, error: "Quotation not found" }
            }

            if (quotation.status === "rejected") {
                return { success: false as const, error: "Rejected quotation cannot accept PO upload" }
            }

            const fallbackPoNumber = normalizeText(payload.poNumber)
            const attachmentTitle = buildCustomerPoAttachmentTitle(fallbackPoNumber, payload.fileName)

            const insertedAttachmentRows = await tx.insert(quotationAttachments).values({
                quotationId: payload.quotationId,
                kind: "customer_po",
                title: attachmentTitle,
                fileUrl: payload.fileUrl,
                fileName: payload.fileName,
                mimeType: normalizeText(payload.mimeType),
                fileSize: payload.fileSize,
                description: "Customer PO uploaded from quotation detail",
                includeInPdf: false,
                uploadedBy: userId,
            }).returning() as QuotationAttachmentRecord[]

            const attachment = insertedAttachmentRows[0]

            await tx.update(quotations)
                .set({
                    customerPoNumber: fallbackPoNumber,
                    customerPoDocument: payload.fileUrl,
                    customerPoUploadedAt: poReceivedAt,
                    customerPoUploadedBy: userId,
                    poValidationStatus: "pending_ocr",
                    poValidationCheckedAt: null,
                    poValidationOcrSessionId: null,
                    poValidationSummary: null,
                    updatedAt: poReceivedAt,
                })
                .where(eq(quotations.id, payload.quotationId))

            await createNextRevision(
                tx,
                payload.quotationId,
                userId,
                fallbackPoNumber
                    ? `Customer PO uploaded: ${fallbackPoNumber}`
                    : "Customer PO uploaded and queued for OCR number detection",
            )

            return {
                success: true as const,
                alreadyConverted: Boolean(quotation.salesOrderId),
                salesOrderId: quotation.salesOrderId,
                attachmentId: attachment.id,
            }
        })

        if (!uploadResult.success) {
            return uploadResult
        }

        let validationSummary: QuotationPoValidationSummary
        let ocrSessionId: number | null = null
        let resolvedPoNumber = normalizeText(payload.poNumber)

        try {
            const quotationForValidation = await db.query.quotations.findFirst({
                where: eq(quotations.id, payload.quotationId),
                with: {
                    customer: true,
                    items: {
                        with: {
                            product: true,
                        },
                    },
                },
            })

            if (!quotationForValidation) {
                throw new Error("Quotation not found for OCR validation")
            }

            const uploadedPo = await readManagedUpload(payload.fileUrl)
            if (!uploadedPo) {
                throw new Error("Uploaded PO file not found for OCR validation")
            }

            const ocr = await extractStructuredFromDocument({
                fileBuffer: uploadedPo.buffer,
                filename: uploadedPo.filename,
                pages: "all",
            })
            const mapping = await mapExtractedToMaster(ocr.structured)
            const mappedData = buildMappedDataFromOcr(ocr, mapping)
            const extractedData = buildExtractedDataFromOcr(ocr)
            const [ocrSession] = await db.insert(ocrPoSessions).values({
                fileUrl: extractUploadFilename(payload.fileUrl) || payload.fileUrl,
                fileName: uploadedPo.filename.slice(0, 255),
                fileType: normalizeText(payload.mimeType) || uploadedPo.contentType || null,
                extractedData,
                mappedData,
                status: "pending",
                uploadedById: userId,
            }).returning({ id: ocrPoSessions.id })

            ocrSessionId = ocrSession.id
            validationSummary = comparePoOcrAgainstQuotation({
                quotation: quotationForValidation,
                ocr,
                mapping,
            })
            validationSummary.ocrSessionId = ocrSessionId
            resolvedPoNumber = normalizeText(ocr.structured.po_number) ?? resolvedPoNumber
        } catch (validationError) {
            console.error("Quotation PO OCR validation failed:", validationError)
            validationSummary = buildOcrFailureSummary(validationError)
        }

        await db.transaction(async (tx) => {
            await tx.update(quotations)
                .set({
                    customerPoNumber: resolvedPoNumber,
                    customerPoDocument: payload.fileUrl,
                    customerPoUploadedAt: poReceivedAt,
                    poValidationStatus: validationSummary.status,
                    poValidationCheckedAt: new Date(validationSummary.checkedAt),
                    poValidationOcrSessionId: ocrSessionId,
                    poValidationSummary: validationSummary,
                    updatedAt: new Date(),
                })
                .where(eq(quotations.id, payload.quotationId))

            if (uploadResult.attachmentId) {
                await tx.update(quotationAttachments)
                    .set({
                        title: buildCustomerPoAttachmentTitle(resolvedPoNumber, payload.fileName),
                    })
                    .where(eq(quotationAttachments.id, uploadResult.attachmentId))
            }

            if (uploadResult.salesOrderId) {
                await tx.update(salesOrders)
                    .set({
                        customerPo: resolvedPoNumber,
                        poDocument: payload.fileUrl,
                        poReceive: poReceivedAt,
                        updatedAt: new Date(),
                    })
                    .where(eq(salesOrders.id, uploadResult.salesOrderId))
            }

            await createNextRevision(
                tx,
                payload.quotationId,
                userId,
                validationSummary.status === "full_match"
                    ? "Customer PO OCR validated and ready for Sales Order review"
                    : validationSummary.status === "partial_match"
                        ? "Customer PO OCR detected partial match and requires manual validation"
                        : validationSummary.status === "mismatch"
                            ? "Customer PO OCR detected mismatch and requires manual validation"
                            : "Customer PO OCR validation failed and requires manual review",
            )
        })

        if (uploadResult.salesOrderId) {
            revalidatePath(`/dashboard/quotations/${payload.quotationId}`)
            revalidatePath("/dashboard/quotations")
            revalidatePath(`/dashboard/sales-orders/${uploadResult.salesOrderId}/edit`)
            revalidatePath("/dashboard/sales-orders")
            return {
                success: true as const,
                salesOrderId: uploadResult.salesOrderId,
                alreadyConverted: true,
                validationStatus: validationSummary.status,
                validationSummary,
                ocrSessionId,
                requiresManualReview: validationSummary.status !== "full_match",
                customerPoNumber: resolvedPoNumber,
            }
        }

        revalidatePath(`/dashboard/quotations/${payload.quotationId}`)
        revalidatePath("/dashboard/quotations")

        return {
            success: true as const,
            validationStatus: validationSummary.status,
            validationSummary,
            ocrSessionId,
            requiresManualReview: validationSummary.status !== "full_match",
            customerPoNumber: resolvedPoNumber,
        }
    } catch (error) {
        console.error("Failed to upload quotation customer PO:", error)
        return { success: false as const, error: error instanceof Error ? error.message : "Failed to upload customer PO" }
    }
}

export async function finalizeQuotationOcrSalesOrderLink(input: {
    quotationId: number
    salesOrderId: number
    ocrSessionId?: number | null
}) {
    try {
        const userId = await getAuthenticatedUserId()
        if (!userId) {
            return { success: false as const, error: "Unauthorized" }
        }

        const result = await db.transaction(async (tx) => {
            const existingQuotation = await tx.query.quotations.findFirst({
                where: eq(quotations.id, input.quotationId),
                columns: {
                    poValidationStatus: true,
                },
            })

            const linked = await linkSalesOrderToQuotationRecord(tx, {
                quotationId: input.quotationId,
                salesOrderId: input.salesOrderId,
                triggeredBy: userId,
                sourceType: input.ocrSessionId ? "quotation_po_ocr" : "quotation_po_manual",
                markAsConverted: true,
            })

            if (!linked.success) {
                return linked
            }

            await tx.update(quotations)
                .set({
                    poValidationStatus: existingQuotation?.poValidationStatus ?? "full_match",
                    poValidationCheckedAt: new Date(),
                    poValidationOcrSessionId: input.ocrSessionId ?? null,
                    updatedAt: new Date(),
                })
                .where(eq(quotations.id, input.quotationId))

            if (input.ocrSessionId) {
                await tx.update(ocrPoSessions)
                    .set({
                        salesOrderId: input.salesOrderId,
                        status: "validated",
                        updatedAt: new Date(),
                    })
                    .where(eq(ocrPoSessions.id, input.ocrSessionId))
            }

            return { success: true as const }
        })

        revalidatePath(`/dashboard/quotations/${input.quotationId}`)
        revalidatePath("/dashboard/quotations")
        revalidatePath("/dashboard/sales-orders")
        return result
    } catch (error) {
        console.error("Failed to finalize quotation OCR sales order link:", error)
        return { success: false as const, error: "Failed to link OCR sales order to quotation" }
    }
}

export async function expireQuotations() {
    return syncExpiredQuotations(true)
}
