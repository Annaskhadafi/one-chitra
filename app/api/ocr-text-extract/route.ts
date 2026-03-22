import { NextRequest } from "next/server"
import { z } from "zod"
import Fuse from "fuse.js"
import { db } from "@/db"
import { customers } from "@/db/schema"
import { mapOcrItemsToProductIds } from "@/lib/ocr-product-mapper"

export const runtime = "nodejs"

const ocrInputSchema = z.object({
    ocrText: z.string().min(1, "ocrText is required"),
})

const extractedSchema = z.object({
    customer_name: z.string().min(1),
    po_number: z.string().min(1),
    date: z.string().min(1),
    discount: z.number().optional().nullable(),
    items: z.array(z.object({
        product_name: z.string().min(1),
        quantity: z.number(),
        price: z.number(),
        unit: z.string().optional().nullable(),
    })).min(1),
})

const systemPrompt = `Anda adalah asisten ahli administrasi penjualan.
Tugas Anda adalah membaca teks OCR dari Purchase Order yang berantakan dan mengubahnya ke JSON terstruktur.

ATURAN:
1. Jika ada diskon, masukkan ke field "discount".
2. Jika satuan (unit) tidak disebutkan, asumsikan "pcs".
3. Abaikan teks iklan atau informasi bank di dalam PO.
4. Output HARUS dalam format JSON yang valid.`

export async function POST(req: NextRequest) {
    try {
        const rawBody = await req.json().catch(() => null)
        const parsedBody = ocrInputSchema.safeParse(rawBody)
        if (!parsedBody.success) {
            return Response.json({ error: parsedBody.error.issues[0]?.message || "Invalid payload" }, { status: 400 })
        }

        const apiKey = process.env.MISTRAL_API_KEY
        if (!apiKey) {
            return Response.json({ error: "MISTRAL_API_KEY belum diset" }, { status: 500 })
        }

        const model = process.env.MISTRAL_TEXT_MODEL?.trim() || "mistral-large-latest"

        const completionPayload: Record<string, unknown> = {
            model,
            messages: [
                { role: "system", content: systemPrompt },
                {
                    role: "user",
                    content: `Ekstrak data berikut ke JSON dengan field customer_name, po_number, date, discount, items[] { product_name, quantity, price, unit }.\n\nOCR_TEXT:\n${parsedBody.data.ocrText}`,
                },
            ],
            response_format: { type: "json_object" },
        }
        const completion = await callMistralChatCompletion({
            apiKey,
            body: completionPayload,
        })

        const modelContent = getMessageContent(completion)
        if (!modelContent) {
            return Response.json({ error: "Respons Mistral kosong" }, { status: 502 })
        }

        const parsedJson = parseJsonContent(modelContent)
        const extracted = extractedSchema.safeParse(parsedJson)
        if (!extracted.success) {
            return Response.json({
                error: "Format hasil ekstraksi tidak valid",
                details: extracted.error.issues,
                raw: parsedJson,
            }, { status: 422 })
        }

        const mappedItems = await mapOcrItemsToProductIds(extracted.data.items.map((item) => ({
            product_name: item.product_name,
            quantity: item.quantity,
            price: item.price,
        })))

        const customerMatch = await mapCustomerNameToId(extracted.data.customer_name)

        return Response.json({
            extracted: extracted.data,
            customer_mapping: customerMatch,
            mapped_items: mappedItems,
        })
    } catch (error) {
        return Response.json({
            error: error instanceof Error ? error.message : "Gagal mengekstrak OCR text",
        }, { status: 500 })
    }
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
        throw new Error("JSON dari model tidak dapat diparse")
    }
}

async function mapCustomerNameToId(customerName: string) {
    const customerRows = await db.select({
        id: customers.id,
        name: customers.name,
        customerCode: customers.customerCode,
    }).from(customers)

    const fuse = new Fuse(customerRows, {
        keys: ["name", "customerCode"],
        includeScore: true,
        threshold: 0.35,
        ignoreLocation: true,
    })
    const best = fuse.search(customerName, { limit: 1 })[0]
    const confidence = best ? 1 - (best.score ?? 1) : 0

    if (!best || confidence < 0.5) {
        return {
            customer_id: "customer_not_found" as const,
            matched_name: null,
            confidence,
        }
    }

    return {
        customer_id: best.item.id,
        matched_name: best.item.name,
        confidence,
    }
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
        throw new Error(`MISTRAL_TEXT_UPSTREAM_ERROR ${response.status} ${message}`)
    }
    return payload
}
