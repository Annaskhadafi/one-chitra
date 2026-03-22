import { NextRequest } from "next/server"
import { z } from "zod"
import Fuse from "fuse.js"
import { db } from "@/db"
import { customers, products } from "@/db/schema"
import { ocrPoSessions } from "@/db/schema/ocr-po-sessions"

export const runtime = "nodejs"

const basicSchema = z.object({
    customer_name: z.string().min(1),
    po_number: z.string().min(1),
    date: z.string().optional(),
    items: z.array(z.object({
        product: z.string().min(1),
        qty: z.number(),
        price: z.number(),
    })).min(1),
})

const requestSchema = z.object({
    fileUrl: z.string().min(1),
    fileName: z.string().optional(),
    fileType: z.string().optional(),
    rawText: z.string().optional(),
    basic: basicSchema,
})

const aiResultSchema = z.object({
    customer_id: z.number().nullable(),
    items: z.array(z.object({
        index: z.number().int().nonnegative(),
        matched_product_id: z.number().nullable(),
        confidence: z.number().min(0).max(1),
    })),
})

export async function POST(req: NextRequest) {
    try {
        const raw = await req.json().catch(() => null)
        const body = requestSchema.safeParse(raw)
        if (!body.success) {
            return Response.json({ error: "Payload tidak valid" }, { status: 400 })
        }

        const customerRows = await db.select({
            id: customers.id,
            name: customers.name,
            customerCode: customers.customerCode,
        }).from(customers)
        const productRows = await db.select({
            id: products.id,
            materialNumber: products.materialNumber,
            oldMaterialNo: products.oldMaterialNo,
            materialDescription: products.materialDescription,
        }).from(products)

        const customerCandidates = buildCustomerCandidates(body.data.basic.customer_name, customerRows)
        const productCandidatesByItem = body.data.basic.items.map((item) =>
            buildProductCandidates(item.product, productRows)
        )

        const aiMapping = await tryAiMapping({
            basic: body.data.basic,
            customerCandidates,
            productCandidatesByItem,
        })

        const customerFallbackId = customerCandidates[0]?.id ?? null
        const mappedCustomerId = aiMapping?.customer_id ?? customerFallbackId
        const mappedItems = body.data.basic.items.map((item, index) => {
            const candidateIds = new Set(productCandidatesByItem[index].map((candidate) => candidate.id))
            const aiItem = aiMapping?.items.find((candidate) => candidate.index === index)
            const pickedId = aiItem?.matched_product_id ?? null
            const finalId = pickedId && candidateIds.has(pickedId) ? pickedId : (productCandidatesByItem[index][0]?.id ?? null)
            const product = finalId ? productRows.find((row) => row.id === finalId) : null
            return {
                ocrProductName: item.product,
                ocrProductCode: null,
                ocrQuantity: item.qty,
                ocrUnitPrice: item.price,
                matchedProductId: finalId,
                matchedProductName: product?.materialDescription || product?.materialNumber || null,
                matchConfidence: aiItem?.confidence ?? (productCandidatesByItem[index][0]?.score ?? 0),
                isValidated: false,
            }
        })

        const mappedData = {
            customerId: mappedCustomerId,
            customerName: body.data.basic.customer_name,
            customerMatchConfidence: aiMapping?.customer_id ? 0.9 : (customerCandidates[0]?.score ?? 0),
            customerSuggestions: customerCandidates.map((candidate) => ({
                id: candidate.id,
                name: candidate.name,
                code: candidate.customerCode || null,
                score: candidate.score,
            })),
            documentNumber: body.data.basic.po_number,
            documentDate: body.data.basic.date || null,
            items: mappedItems,
        }

        const extractedData = {
            customerName: body.data.basic.customer_name,
            customerCode: null,
            documentNumber: body.data.basic.po_number,
            documentDate: body.data.basic.date || null,
            items: body.data.basic.items.map((item) => ({
                productName: item.product,
                productCode: null,
                quantity: item.qty,
                unitPrice: item.price,
                totalPrice: item.qty * item.price,
                unit: null,
            })),
            rawText: sanitizeText(body.data.rawText || ""),
        }

        const [session] = await db.insert(ocrPoSessions).values({
            fileUrl: body.data.fileUrl.slice(0, 500),
            fileName: (body.data.fileName || body.data.fileUrl).slice(0, 255),
            fileType: (body.data.fileType || "").slice(0, 50) || null,
            extractedData,
            mappedData,
            status: "pending",
        }).returning({ id: ocrPoSessions.id })

        return Response.json({
            sessionId: session.id,
            mapped: mappedData,
        })
    } catch (error) {
        return Response.json({
            error: error instanceof Error ? error.message : "Proses mapping AI gagal",
        }, { status: 500 })
    }
}

async function tryAiMapping(input: {
    basic: z.infer<typeof basicSchema>
    customerCandidates: Array<{ id: number; name: string; customerCode: string | null; score: number }>
    productCandidatesByItem: Array<Array<{ id: number; name: string; materialNumber: string; score: number }>>
}) {
    const apiKey = process.env.MISTRAL_API_KEY
    if (!apiKey) {
        return null
    }
    const model = process.env.MISTRAL_MAP_MODEL?.trim() || "mistral-small-latest"

    const promptPayload = {
        extracted: input.basic,
        customer_candidates: input.customerCandidates,
        product_candidates_per_item: input.productCandidatesByItem,
        instruction: "Pilih ID customer dan product paling mendekati. Jika tidak yakin, pakai null. Kembalikan JSON valid.",
        format: {
            customer_id: "number | null",
            items: [{ index: "number", matched_product_id: "number | null", confidence: "0..1" }],
        },
    }

    const completionPayload: Record<string, unknown> = {
        model,
        response_format: { type: "json_object" },
        messages: [
            { role: "system", content: "Anda memetakan hasil OCR ke master data. Hanya keluarkan JSON valid tanpa teks lain." },
            { role: "user", content: JSON.stringify(promptPayload) },
        ],
    }

    const completion = await callMistralChatCompletion({
        apiKey,
        body: completionPayload,
    })
    const content = getMessageContent(completion)
    if (!content) {
        return null
    }
    const parsed = parseJsonContent(content)
    const valid = aiResultSchema.safeParse(parsed)
    if (!valid.success) {
        return null
    }
    return valid.data
}

function buildCustomerCandidates(
    customerName: string,
    rows: Array<{ id: number; name: string; customerCode: string | null }>
) {
    const fuse = new Fuse(rows, {
        keys: ["name", "customerCode"],
        includeScore: true,
        threshold: 0.4,
        ignoreLocation: true,
    })
    return fuse.search(customerName, { limit: 8 }).map((result) => ({
        id: result.item.id,
        name: result.item.name,
        customerCode: result.item.customerCode,
        score: 1 - (result.score ?? 1),
    }))
}

function buildProductCandidates(
    productName: string,
    rows: Array<{ id: number; materialNumber: string; oldMaterialNo: string | null; materialDescription: string | null }>
) {
    const fuse = new Fuse(rows, {
        keys: ["materialDescription", "materialNumber", "oldMaterialNo"],
        includeScore: true,
        threshold: 0.4,
        ignoreLocation: true,
        minMatchCharLength: 2,
    })
    return fuse.search(productName, { limit: 8 }).map((result) => ({
        id: result.item.id,
        name: result.item.materialDescription || result.item.materialNumber,
        materialNumber: result.item.materialNumber,
        score: 1 - (result.score ?? 1),
    }))
}

function getMessageContent(completion: unknown): string {
    const root = (completion && typeof completion === "object") ? completion as Record<string, unknown> : null
    const choices = root && Array.isArray(root.choices) ? root.choices : []
    const firstChoice = choices[0]
    const message = (firstChoice && typeof firstChoice === "object")
        ? (firstChoice as Record<string, unknown>).message
        : null
    const content = (message && typeof message === "object")
        ? (message as Record<string, unknown>).content
        : null
    if (typeof content === "string") {
        return content
    }
    if (Array.isArray(content)) {
        const firstText = content.find((part) => typeof part?.text === "string")
        return firstText?.text || ""
    }
    return ""
}

function parseJsonContent(content: string): unknown {
    try {
        return JSON.parse(content)
    } catch {
        const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
        if (fenced) {
            return JSON.parse(fenced)
        }
        const start = content.indexOf("{")
        const end = content.lastIndexOf("}")
        if (start >= 0 && end > start) {
            return JSON.parse(content.slice(start, end + 1))
        }
        return null
    }
}

function sanitizeText(value: string): string {
    return String(value || "").replace(/\u0000/g, "")
}

async function callMistralChatCompletion(params: {
    apiKey: string
    body: Record<string, unknown>
}) {
    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${params.apiKey}`,
        },
        body: JSON.stringify(params.body),
    })

    const text = await response.text()
    const payload = text ? JSON.parse(text) : null
    if (!response.ok) {
        const message = payload?.error?.message || payload?.message || `HTTP ${response.status}`
        throw new Error(`MISTRAL_MAP_UPSTREAM_ERROR ${response.status} ${message}`)
    }
    return payload
}
