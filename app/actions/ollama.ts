"use server"

import Fuse from "fuse.js"
import {
  getCustomerCampaignLaunchContext,
  getCustomerMarketingInsight,
  getCustomerOrderHistory,
  getMarketingSegmentCustomerInsights,
  getMarketingSegmentOptions,
  getSegmentEmailRecipients,
} from "./customer-segmentation"
import { getDeadStockReport } from "./dead-stock"
import { getReorderAlerts } from "./stock-alerts"
import { getFleetList } from "./fleet"
import { getStocks } from "./stock"

type ChatMessage = { role: string; content: string }

type MarketingMagicAnalysis = {
  campaignName: string
  description: string
  summary: string
  recommendedSegments: string[]
  subjectIdeas: string[]
  ctaIdeas: string[]
  stockFocus: string[]
  sendWindow: string
  reasoning: string[]
}

function getSuggestedScheduleIso() {
  const now = new Date()
  const next = new Date(now)
  next.setDate(now.getDate() + 1)
  next.setHours(10, 0, 0, 0)

  const day = next.getDay()
  if (day === 0) next.setDate(next.getDate() + 1)
  if (day === 6) next.setDate(next.getDate() + 2)

  const offsetMs = next.getTimezoneOffset() * 60 * 1000
  return new Date(next.getTime() - offsetMs).toISOString().slice(0, 16)
}

type MarketingMagicContextRecord = {
  customerName: string
  segment: string
  recency: number
  frequency: number
  monetary: number
  fleetMatches: Array<{
    site: string
    location: string
    tireSize: string
    forecast: number
    status: string
    confidence: number
  }>
  historyHighlights: Array<{
    category: string
    materialNo: string
    materialDescription: string
    revenue: number
    totalQty: number
    lastPurchaseDate: string | null
    stockMatches: Array<{
      materialNumber: string
      materialDescription: string
      totalStock: number
      confidence: number
      warehouseCount: number
    }>
  }>
}

async function callOllamaChat(messages: ChatMessage[]) {
  const rawUrl = process.env.OLLAMA_URL || "http://localhost:11434"
  const baseUrl = rawUrl.replace(/\/$/, "")
  const endpoint = baseUrl.endsWith("/api/chat") ? baseUrl : `${baseUrl}/api/chat`
  const ollamaModel = process.env.OLLAMA_MODEL || "kimi-k2.5:cloud"
  const ollamaApiKey = process.env.OLLAMA_API_KEY || ""

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(ollamaApiKey ? { Authorization: `Bearer ${ollamaApiKey}` } : {}),
    },
    body: JSON.stringify({
      model: ollamaModel,
      messages,
      stream: false,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    try {
      const errorData = JSON.parse(errorText)
      throw new Error(errorData.error || `Failed to connect to Ollama: ${response.statusText}`)
    } catch {
      throw new Error(`Failed to connect to Ollama: ${response.statusText}. Response: ${errorText.substring(0, 200)}`)
    }
  }

  const data = await response.json()
  return String(data.message?.content || "").trim()
}

export async function generateEmailHtml(prompt: string, history: { role: string; content: string }[] = []) {
  try {
    let html = await callOllamaChat([
      {
        role: "system",
        content: `You are a world-class email designer and copywriter for One Chitra.
Create polished, structured, professional email HTML in Indonesian.

Hard requirements:
1. Output ONLY raw HTML.
2. No markdown fences, no explanation text.
3. Use a complete email-friendly structure with:
   - outer wrapper background
   - centered main card/container max width around 640px
   - branded header
   - clear title / intro section
   - tidy content sections
   - 1-2 clear CTA buttons
   - short footer
4. Use inline CSS everywhere important.
5. Use Arial, Helvetica, sans-serif.
6. The result must look neat even inside an iframe preview.
7. Never output plain text blocks that rely on browser default styling.
8. Keep spacing balanced and readable on mobile.
9. If products are mentioned, show them as tidy highlight cards or bullet rows, not messy plain paragraphs.
10. Keep the footer minimal and elegant with only "One Chitra".

Visual direction:
- background: soft light gray or warm neutral
- card: white with rounded corners
- accent color: professional amber / orange / dark slate
- headings: strong and clean
- body text: compact and readable
- CTA buttons: clearly styled, rounded, with strong contrast

Content direction:
- professional, concise, persuasive
- avoid exaggerated claims
- keep paragraphs short
- use placeholders like {{name}}, {{company}}, {{position}} naturally
- if stock or product codes exist, present them in clean labels, not raw clutter

Strictly avoid:
- giant unstyled headings
- long uninterrupted text walls
- raw browser-blue links without button styling
- duplicate brand signature blocks
- overly generic lorem-ipsum style layout
- tables with harsh borders unless really needed
        `,
      },
      ...history,
      { role: "user", content: prompt },
    ])
    
    // Clean up HTML if AI adds markdown backticks
    html = html.replace(/```html/g, "").replace(/```/g, "").trim()

    return { success: true, html }
  } catch (error: unknown) {
    console.error("Ollama Error:", error)
    return { success: false, error: error instanceof Error ? error.message : "Failed to generate email HTML" }
  }
}

function extractJsonBlock(raw: string) {
  const match = raw.match(/\{[\s\S]*\}/)
  return match ? match[0] : raw
}

function normalizeMarketingText(value: string) {
  return value
    .toLowerCase()
    .replace(/\bpt\.?\s*/gi, "")
    .replace(/\bcv\.?\s*/gi, "")
    .replace(/\btbk\.?\s*/gi, "")
    .replace(/[.,/_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function safeNumber(value: unknown) {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

async function buildMarketingMagicContextWithFocus(input: {
  segmentNames?: string[]
  focusCustomerName?: string
  focusCustomerSegment?: string
  startDate?: string
  endDate?: string
}) {
  const [segmentInsightsResult, focusedCustomerInsightResult, fleetResult, stocks] = await Promise.all([
    input.focusCustomerName
      ? Promise.resolve({ success: true as const, data: [] })
      : getMarketingSegmentCustomerInsights(input.segmentNames, input.startDate, input.endDate, 12),
    input.focusCustomerName
      ? getCustomerMarketingInsight(input.focusCustomerName, input.startDate, input.endDate)
      : Promise.resolve(null),
    getFleetList(),
    getStocks(),
  ])

  const focusCustomerInsights =
    focusedCustomerInsightResult && focusedCustomerInsightResult.success && focusedCustomerInsightResult.data
      ? [
          {
            customerName: focusedCustomerInsightResult.data.customerName,
            segment: input.focusCustomerSegment || focusedCustomerInsightResult.data.segment,
            recency: focusedCustomerInsightResult.data.recency,
            frequency: focusedCustomerInsightResult.data.frequency,
            monetary: focusedCustomerInsightResult.data.monetary,
            lastDate: focusedCustomerInsightResult.data.lastDate,
          },
        ]
      : []

  const segmentInsights =
    input.focusCustomerName && focusCustomerInsights.length > 0
      ? focusCustomerInsights
      : segmentInsightsResult.success && segmentInsightsResult.data
        ? segmentInsightsResult.data
        : []

  if (segmentInsights.length === 0) {
    return []
  }

  const stockByProduct = new Map<string, {
    materialNumber: string
    materialDescription: string
    totalStock: number
    warehouseCount: number
  }>()

  for (const stock of stocks) {
    const key = (stock.product?.materialNumber || "").trim()
    if (!key) continue
    const existing = stockByProduct.get(key) || {
      materialNumber: key,
      materialDescription: stock.product?.materialDescription || "",
      totalStock: 0,
      warehouseCount: 0,
    }
    existing.totalStock += stock.totalStock || 0
    existing.warehouseCount += 1
    stockByProduct.set(key, existing)
  }

  const stockSearchSource = Array.from(stockByProduct.values()).map((item) => ({
    ...item,
    searchableText: normalizeMarketingText(`${item.materialNumber} ${item.materialDescription}`),
  }))

  const stockFuse = new Fuse(stockSearchSource, {
    keys: ["searchableText", "materialNumber", "materialDescription"],
    threshold: 0.4,
    ignoreLocation: true,
    includeScore: true,
  })

  type FleetListItem = {
    customer?: string | null
    site?: string | null
    location?: string | null
    tire_size?: string | null
    forecast?: number | string | null
    status?: string | null
  }

  const fleetData: FleetListItem[] = fleetResult.success && Array.isArray(fleetResult.data) ? fleetResult.data : []
  const fleetSearchSource = fleetData.map((item) => ({
    raw: item,
    customerNormalized: normalizeMarketingText(item.customer || ""),
  }))

  const contexts: MarketingMagicContextRecord[] = []

  const fleetFuse = new Fuse(fleetSearchSource, {
    keys: ["customerNormalized"],
    threshold: 0.35,
    ignoreLocation: true,
    includeScore: true,
  })

  for (const customer of segmentInsights) {
    const customerNormalized = normalizeMarketingText(customer.customerName)

    const fleetMatches = fleetFuse.search(customerNormalized)
      .slice(0, 5)
      .map((result) => ({
        site: result.item.raw.site || "-",
        location: result.item.raw.location || "-",
        tireSize: result.item.raw.tire_size || "-",
        forecast: safeNumber(result.item.raw.forecast),
        status: result.item.raw.status || "-",
        confidence: Number((1 - (result.score || 0)).toFixed(2)),
      }))

    const historyResult = await getCustomerOrderHistory(customer.customerName)
    const historyData = historyResult.success && historyResult.data ? historyResult.data : {}
    const historyHighlights: MarketingMagicContextRecord["historyHighlights"] = []

    for (const [category, items] of Object.entries(historyData).slice(0, 4)) {
      for (const item of items.slice(0, 3)) {
        const stockMatches = stockFuse.search(
          normalizeMarketingText(`${item.materialNo} ${item.materialDescription}`)
        )
          .slice(0, 3)
          .map((match) => ({
            materialNumber: match.item.materialNumber,
            materialDescription: match.item.materialDescription,
            totalStock: match.item.totalStock,
            confidence: Number((1 - (match.score || 0)).toFixed(2)),
            warehouseCount: match.item.warehouseCount,
          }))

        historyHighlights.push({
          category,
          materialNo: item.materialNo,
          materialDescription: item.materialDescription,
          revenue: item.revenue,
          totalQty: item.totalQty,
          lastPurchaseDate: item.lastPurchaseDate,
          stockMatches,
        })
      }
    }

    contexts.push({
      customerName: customer.customerName,
      segment: customer.segment,
      recency: customer.recency,
      frequency: customer.frequency,
      monetary: customer.monetary,
      fleetMatches,
      historyHighlights: historyHighlights.slice(0, 8),
    })
  }

  return contexts
}

export async function generateMarketingMagicAnalysis(input: {
  brief: string
  subject?: string
  content?: string
  startDate?: string
  endDate?: string
  selectedSegments?: string[]
  focusCustomerName?: string
  focusCustomerSegment?: string
  emailStyle?: string
}) {
  try {
    const [segmentResult, deadStockResult, reorderAlerts, contextRecords, focusedLaunchContext] = await Promise.all([
      input.focusCustomerName
        ? Promise.resolve({
            success: true as const,
            data: [
              {
                segment: input.focusCustomerSegment || input.selectedSegments?.[0] || "Customer Terpilih",
                matchedRecipients: 1,
                totalCustomers: 1,
                description: "Customer yang dipilih dari halaman segmentasi.",
              },
            ],
          })
        : getMarketingSegmentOptions(input.startDate, input.endDate),
      getDeadStockReport(90),
      getReorderAlerts(),
      buildMarketingMagicContextWithFocus({
        segmentNames: input.selectedSegments,
        focusCustomerName: input.focusCustomerName,
        focusCustomerSegment: input.focusCustomerSegment,
        startDate: input.startDate,
        endDate: input.endDate,
      }),
      input.focusCustomerName
        ? getCustomerCampaignLaunchContext(input.focusCustomerName, input.focusCustomerSegment || input.selectedSegments?.[0] || null)
        : Promise.resolve(null),
    ])

    const segmentSummary = segmentResult.success
      ? segmentResult.data.slice(0, 8).map((item) => ({
          segment: item.segment,
          matchedRecipients: item.matchedRecipients,
          totalCustomers: item.totalCustomers,
          description: item.description,
        }))
      : []

    const deadStockSummary = deadStockResult.success && deadStockResult.data
      ? deadStockResult.data.items.slice(0, 8).map((item) => ({
          productName: item.productName,
          category: item.category,
          quantity: item.quantity,
          daysInactive: item.daysInactive,
          value: item.value,
          sku: item.sku,
        }))
      : []

    const lowStockSummary = reorderAlerts.slice(0, 8).map((item) => ({
      materialNumber: item.product.materialNumber,
      productName: item.product.materialDescription,
      totalStock: item.totalStock,
      minStock: item.minStock,
          urgency: item.urgency,
    }))

    const contextSummary = contextRecords.map((record) => ({
      customerName: record.customerName,
      segment: record.segment,
      recency: record.recency,
      frequency: record.frequency,
      monetary: record.monetary,
      fleetMatches: record.fleetMatches,
      historyHighlights: record.historyHighlights,
    }))

    const raw = await callOllamaChat([
      {
        role: "system",
        content: `You are a senior marketing strategist for One Chitra.
You analyze customer segments and stock conditions, then recommend the most suitable campaign direction.
Do not mention AI, model, or automation.
Return ONLY valid JSON with this exact shape:
{
  "campaignName": "short internal campaign name in Indonesian",
  "description": "short internal note in Indonesian",
  "summary": "short paragraph in Indonesian",
  "recommendedSegments": ["segment"],
  "subjectIdeas": ["subject 1", "subject 2", "subject 3"],
  "ctaIdeas": ["cta 1", "cta 2", "cta 3"],
  "stockFocus": ["focus 1", "focus 2"],
  "sendWindow": "short timing recommendation",
  "reasoning": ["reason 1", "reason 2", "reason 3"]
}
Rules:
- Prioritize campaigns that help move dead stock or safe-stock inventory.
- Avoid pushing low-stock items aggressively.
- Recommended segments must come from the provided segment list.
- Use the fleet and order-history fuzzy matches as semi-raw signals, not as exact truth.
- If there is a meaningful connection between fleet needs, order history, and stock availability, mention it in the reasoning.
- Align the campaign tone and structure with the requested email style.
- Use concise Indonesian.`,
      },
      {
        role: "user",
        content: JSON.stringify({
          brief: input.brief,
          emailStyle: input.emailStyle || "Promosi",
          currentSubject: input.subject || "",
          currentContentSummary: (input.content || "").slice(0, 1500),
          segmentSummary,
          deadStockSummary,
          lowStockSummary,
          customerContext: contextSummary,
        }),
      },
    ])

    const parsed = JSON.parse(extractJsonBlock(raw)) as MarketingMagicAnalysis
    const recommendedRecipientsResult = input.focusCustomerName && focusedLaunchContext?.success && focusedLaunchContext.data?.matchedEmail
      ? {
          success: true as const,
          data: [
            {
              email: focusedLaunchContext.data.matchedEmail,
              name: focusedLaunchContext.data.matchedContactName || focusedLaunchContext.data.customerName,
              company: focusedLaunchContext.data.customerName,
              position: focusedLaunchContext.data.segment || "Customer",
              segment: focusedLaunchContext.data.segment || input.focusCustomerSegment || input.selectedSegments?.[0] || "Customer",
            },
          ],
        }
      : await getSegmentEmailRecipients(
          Array.isArray(parsed.recommendedSegments) ? parsed.recommendedSegments : [],
          input.startDate,
          input.endDate
        )
    const subjectForDraft = Array.isArray(parsed.subjectIdeas) && parsed.subjectIdeas[0]
      ? parsed.subjectIdeas[0]
      : input.subject || "Penawaran Spesial One Chitra"
    const ctaForDraft = Array.isArray(parsed.ctaIdeas) ? parsed.ctaIdeas.slice(0, 2).join(", ") : ""
    const stockFocusForDraft = Array.isArray(parsed.stockFocus) ? parsed.stockFocus.slice(0, 3).join(", ") : ""
    const segmentForDraft = Array.isArray(parsed.recommendedSegments) ? parsed.recommendedSegments.join(", ") : ""

    const draftPrompt = [
      `Buat email marketing HTML profesional untuk One Chitra dalam bahasa Indonesia yang sangat rapi dan siap kirim.`,
      `Tipe email yang harus dipakai: ${input.emailStyle || "Promosi"}.`,
      `Tujuan campaign: ${input.brief}`,
      `Nama campaign internal: ${parsed.campaignName || "Campaign Baru"}`,
      `Catatan internal: ${parsed.description || ""}`,
      `Target segmen: ${segmentForDraft}`,
      `Subject utama: ${subjectForDraft}`,
      `CTA utama: ${ctaForDraft}`,
      `Fokus stok/produk: ${stockFocusForDraft}`,
      `Gunakan placeholder {{name}}, {{company}}, dan {{position}} secara natural.`,
      `Buat struktur yang ringkas, jelas, dan langsung siap dipakai di editor email.`,
      `Susun layout dengan urutan: header brand, judul utama, pembuka singkat, maksimum 2 blok highlight produk/layanan, value proposition singkat, CTA button, penutup singkat, footer minimal.`,
      `Jangan tampilkan list produk sebagai teks mentah panjang. Gunakan kartu produk yang rapi dengan label part number, stok, dan manfaat secara singkat.`,
      `Tampilan harus premium, bersih, mobile-friendly, dan tidak berantakan.`
    ].join("\n")

    const emailDraftResult = await generateEmailHtml(draftPrompt)

    return {
      success: true as const,
      data: {
        campaignName: parsed.campaignName || "",
        description: parsed.description || "",
        summary: parsed.summary || "",
        recommendedSegments: Array.isArray(parsed.recommendedSegments) ? parsed.recommendedSegments : [],
        subjectIdeas: Array.isArray(parsed.subjectIdeas) ? parsed.subjectIdeas.slice(0, 5) : [],
        ctaIdeas: Array.isArray(parsed.ctaIdeas) ? parsed.ctaIdeas.slice(0, 5) : [],
        stockFocus: Array.isArray(parsed.stockFocus) ? parsed.stockFocus.slice(0, 5) : [],
        sendWindow: parsed.sendWindow || "",
        reasoning: Array.isArray(parsed.reasoning) ? parsed.reasoning.slice(0, 5) : [],
        rawSignals: contextSummary.slice(0, 4),
        contentHtml: emailDraftResult.success ? (emailDraftResult.html || "") : "",
        recommendedRecipients: recommendedRecipientsResult.success
          ? recommendedRecipientsResult.data.slice(0, 12)
          : [],
        suggestedScheduleAt: getSuggestedScheduleIso(),
      },
    }
  } catch (error: unknown) {
    console.error("Marketing Magic Analysis Error:", error)
    return { success: false as const, error: error instanceof Error ? error.message : "Failed to generate marketing analysis" }
  }
}
