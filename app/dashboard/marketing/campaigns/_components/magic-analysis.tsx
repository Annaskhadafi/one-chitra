"use client"

import { useEffect, useMemo, useState } from "react"
import { generateMarketingMagicAnalysis } from "@/app/actions/ollama"
import { createEmailTemplate } from "@/app/actions/email"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Loader2, Sparkles, Wand2 } from "lucide-react"
import { toast } from "sonner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type TargetConfig = {
  userIds: string[]
  groupIds: number[]
  contactIds: number[]
  manual: string[]
  segmentNames: string[]
}

interface MagicAnalysisProps {
  initialBrief?: string
  autoRunOnMount?: boolean
  autoApplyOnAutoRun?: boolean
  autoRunKey?: string
  focusCustomerName?: string
  focusCustomerSegment?: string
  subject: string
  content: string
  targetConfig: TargetConfig
  onApply: (payload: {
    name?: string
    description?: string
    subject?: string
    content?: string
    segmentNames?: string[]
    manualRecipients?: string[]
    scheduledAt?: string
  }) => void
  onQuickDraft?: (payload: {
    name?: string
    description?: string
    subject?: string
    content?: string
    segmentNames?: string[]
    manualRecipients?: string[]
    scheduledAt?: string
  }) => Promise<void> | void
}

export function MagicAnalysis({
  initialBrief = "",
  autoRunOnMount = false,
  autoApplyOnAutoRun = false,
  autoRunKey = "",
  focusCustomerName = "",
  focusCustomerSegment = "",
  subject,
  content,
  targetConfig,
  onApply,
  onQuickDraft,
}: MagicAnalysisProps) {
  const [brief, setBrief] = useState("")
  const [loading, setLoading] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [lastAutoRunKey, setLastAutoRunKey] = useState("")
  const [result, setResult] = useState<null | {
    campaignName: string
    description: string
    summary: string
    recommendedSegments: string[]
    subjectIdeas: string[]
    ctaIdeas: string[]
    stockFocus: string[]
    sendWindow: string
    reasoning: string[]
    contentHtml: string
    suggestedScheduleAt: string
    recommendedRecipients: Array<{
      email: string
      name: string
      company: string
      position: string
      segment: string
    }>
    rawSignals: Array<{
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
    }>
  }>(null)
  const loadingMessages = [
    "Membaca segmentasi customer...",
    "Mencocokkan history order dengan stok...",
    "Menyelaraskan sinyal fleet dengan produk...",
    "Menyusun interpretasi campaign terbaik...",
  ]
  const [loadingStep, setLoadingStep] = useState(0)

  useEffect(() => {
    if (initialBrief) {
      setBrief(initialBrief)
    }
  }, [initialBrief])

  const focusProducts = useMemo(() => {
    if (!result) return []

    const productMap = new Map<string, {
      materialNumber: string
      materialDescription: string
      totalStock: number
      confidence: number
      warehouseCount: number
    }>()

    for (const signal of result.rawSignals) {
      for (const item of signal.historyHighlights) {
        for (const stockMatch of item.stockMatches) {
          const key = stockMatch.materialNumber
          const existing = productMap.get(key) || {
            materialNumber: stockMatch.materialNumber,
            materialDescription: stockMatch.materialDescription,
            totalStock: 0,
            confidence: stockMatch.confidence,
            warehouseCount: stockMatch.warehouseCount,
          }

          existing.totalStock = Math.max(existing.totalStock, stockMatch.totalStock)
          existing.confidence = Math.max(existing.confidence, stockMatch.confidence)
          existing.warehouseCount = Math.max(existing.warehouseCount, stockMatch.warehouseCount)
          productMap.set(key, existing)
        }
      }
    }

    return Array.from(productMap.values())
      .sort((a, b) => b.totalStock - a.totalStock || b.confidence - a.confidence)
      .slice(0, 6)
  }, [result])

  useEffect(() => {
    if (!loading) {
      setLoadingStep(0)
      return
    }

    const timer = setInterval(() => {
      setLoadingStep((prev) => (prev + 1) % loadingMessages.length)
    }, 1400)

    return () => clearInterval(timer)
  }, [loading])

  const buildApplyPayload = (analysisResult: NonNullable<typeof result>) => {
    const merged = Array.from(new Set([...(targetConfig.segmentNames || []), ...analysisResult.recommendedSegments]))
    return {
      name: analysisResult.campaignName,
      description: analysisResult.description,
      subject: analysisResult.subjectIdeas[0] || subject,
      content: analysisResult.contentHtml,
      segmentNames: merged,
      manualRecipients: analysisResult.recommendedRecipients.map((recipient) => recipient.email),
      scheduledAt: analysisResult.suggestedScheduleAt,
    }
  }

  const handleAnalyze = async (overrideBrief?: string, options?: { autoApply?: boolean }) => {
    const effectiveBrief = (overrideBrief ?? brief).trim()
    if (!effectiveBrief) {
      toast.error("Tuliskan tujuan campaign terlebih dahulu.")
      return
    }

    setLoading(true)
    try {
      const response = await generateMarketingMagicAnalysis({
        brief: effectiveBrief,
        subject,
        content,
        selectedSegments: targetConfig.segmentNames,
        focusCustomerName: focusCustomerName || undefined,
        focusCustomerSegment: focusCustomerSegment || undefined,
      })

      if (!response.success) {
        toast.error(response.error || "Gagal menjalankan Magic Analisis")
        return
      }

      setResult(response.data)
      if (options?.autoApply) {
        onApply(buildApplyPayload(response.data))
        toast.success("Magic Analisis selesai dan form otomatis terisi")
      } else {
        toast.success("Magic Analisis selesai disiapkan")
      }
    } catch (error: any) {
      toast.error(error.message || "Gagal menjalankan Magic Analisis")
    } finally {
      setLoading(false)
    }
  }

  const applySegments = () => {
    if (!result) return
    const merged = Array.from(new Set([...(targetConfig.segmentNames || []), ...result.recommendedSegments]))
    onApply({ segmentNames: merged })
    toast.success("Rekomendasi segmen diterapkan")
  }

  const applyAll = (mode: "standard" | "quick" = "standard") => {
    if (!result) return
    onApply(buildApplyPayload(result))
    toast.success(mode === "quick" ? "Draft cepat berhasil disiapkan" : "Form berhasil diisi otomatis")
  }

  const applyQuickDraft = () => {
    if (!result) return
    const payload = {
      name: result.campaignName,
      description: result.description,
      subject: result.subjectIdeas[0] || subject,
      content: result.contentHtml,
      segmentNames: Array.from(new Set([...(targetConfig.segmentNames || []), ...result.recommendedSegments])),
      manualRecipients: result.recommendedRecipients.map((recipient) => recipient.email),
      scheduledAt: result.suggestedScheduleAt,
    }

    if (!onQuickDraft) {
      applyAll("quick")
      return
    }

    setSavingDraft(true)
    Promise.resolve(onQuickDraft(payload))
      .then(() => toast.success("Draft cepat berhasil disimpan"))
      .catch((error: any) => toast.error(error?.message || "Gagal menyimpan draft cepat"))
      .finally(() => setSavingDraft(false))
  }

  const handleSaveTemplate = async () => {
    if (!result) return

    setSavingTemplate(true)
    try {
      const response = await createEmailTemplate({
        name: result.campaignName || `Magic Template ${new Date().toLocaleDateString("id-ID")}`,
        type: "custom",
        subject: result.subjectIdeas[0] || subject || "Subject Campaign",
        htmlContent: result.contentHtml || "<p></p>",
        textContent: result.summary,
        variables: ["name", "company", "position"],
        recipientRoles: [],
        recipientUserIds: [],
        ccEmails: [],
        isActive: true,
      })

      if (!response.success) {
        throw new Error(response.error || "Gagal menyimpan template")
      }

      toast.success("Hasil Magic Analisis berhasil disimpan sebagai template")
    } catch (error: any) {
      toast.error(error?.message || "Gagal menyimpan template")
    } finally {
      setSavingTemplate(false)
    }
  }

  useEffect(() => {
    if (!autoRunOnMount) return
    if (!initialBrief.trim()) return
    if (loading) return

    const key = autoRunKey || initialBrief
    if (lastAutoRunKey === key) return

    setLastAutoRunKey(key)
    void handleAnalyze(initialBrief, { autoApply: autoApplyOnAutoRun })
  }, [autoRunOnMount, autoApplyOnAutoRun, autoRunKey, initialBrief, loading, lastAutoRunKey])

  return (
    <Card className="border-amber-200/70 bg-gradient-to-br from-amber-50 via-white to-orange-50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="rounded-lg bg-amber-100 p-2">
            <Sparkles className="h-4 w-4 text-amber-700" />
          </div>
          Magic Analisis
        </CardTitle>
        <CardDescription>
          Analisis target campaign berdasarkan segmen customer dan kondisi stok yang tersedia.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Tujuan Campaign</label>
          <Textarea
            value={brief}
            onChange={(event) => setBrief(event.target.value)}
            placeholder="Contoh: Saya ingin mendorong repeat order untuk customer yang mulai pasif, sambil membantu menggerakkan stok oli yang lama tidak bergerak."
            className="min-h-[110px] bg-white"
          />
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => {
            void handleAnalyze()
          }}
          disabled={loading}
          className="border-amber-300 bg-white"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Menyusun Analisis...
            </>
          ) : (
            <>
              <Wand2 className="mr-2 h-4 w-4" />
              Jalankan Magic Analisis
            </>
          )}
        </Button>

        {loading && (
          <div className="overflow-hidden rounded-xl border bg-white">
            <div className="h-1 w-full bg-amber-100">
              <div className="h-full w-2/3 animate-pulse bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500" />
            </div>
            <div className="flex items-center gap-3 p-4">
              <div className="rounded-full bg-amber-100 p-2">
                <Sparkles className="h-4 w-4 animate-pulse text-amber-700" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-800">{loadingMessages[loadingStep]}</p>
                <p className="text-xs text-muted-foreground">
                  Magic Analisis sedang mengolah data semi-mentah dari customer, fleet, history order, dan stok.
                </p>
              </div>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-4 rounded-xl border bg-white/90 p-4">
            <div>
              <p className="text-sm font-semibold">Ringkasan</p>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{result.summary}</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">Segmen Direkomendasikan</p>
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={applySegments}>
                    Terapkan Segmen
                  </Button>
                  <Button type="button" size="sm" onClick={() => applyAll("standard")}>
                    Isi Form Otomatis
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={applyQuickDraft}>
                    {savingDraft ? "Menyimpan..." : "Buat Draft Cepat"}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={handleSaveTemplate} disabled={savingTemplate}>
                    {savingTemplate ? "Menyimpan Template..." : "Simpan Jadi Template"}
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {result.recommendedSegments.map((segment, index) => (
                  <Badge key={`${segment}-${index}`} variant="outline" className="bg-amber-50 text-amber-800 border-amber-200">
                    {segment}
                  </Badge>
                ))}
              </div>
            </div>

            {result.recommendedRecipients.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold">Penerima Rekomendasi</p>
                <div className="overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nama</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Perusahaan</TableHead>
                        <TableHead>Segmen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.recommendedRecipients.slice(0, 8).map((recipient, index) => (
                        <TableRow key={`${recipient.email}-${recipient.segment}-${index}`}>
                          <TableCell className="font-medium">{recipient.name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{recipient.email}</TableCell>
                          <TableCell>{recipient.company}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-sky-50 text-sky-800 border-sky-200">
                              {recipient.segment}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-xs text-muted-foreground">
                  Daftar ini adalah kandidat penerima hasil pencocokan segmentasi, history order, fleet, dan stok.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm font-semibold">Ide Subject</p>
              <div className="flex flex-wrap gap-2">
                {result.subjectIdeas.map((idea, index) => (
                  <button
                    key={`${idea}-${index}`}
                    type="button"
                    className="rounded-full border bg-slate-50 px-3 py-1.5 text-left text-xs hover:bg-slate-100"
                    onClick={() => onApply({ subject: idea })}
                  >
                    {idea}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm font-semibold">Fokus Stok</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {result.stockFocus.map((item, index) => (
                    <li key={`${item}-${index}`}>• {item}</li>
                  ))}
                </ul>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold">CTA & Timing</p>
                <p className="text-sm text-muted-foreground">{result.sendWindow}</p>
                <p className="text-xs text-muted-foreground">
                  Jadwal saran: {result.suggestedScheduleAt ? new Date(result.suggestedScheduleAt).toLocaleString("id-ID") : "-"}
                </p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {result.ctaIdeas.map((item, index) => (
                    <li key={`${item}-${index}`}>• {item}</li>
                  ))}
                </ul>
              </div>
            </div>

            {focusProducts.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold">Produk Fokus Rekomendasi</p>
                <div className="overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Material</TableHead>
                        <TableHead>Deskripsi</TableHead>
                        <TableHead className="text-right">Stock</TableHead>
                        <TableHead className="text-right">Cocok</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {focusProducts.map((product, index) => (
                        <TableRow key={`${product.materialNumber}-${product.materialDescription}-${index}`}>
                          <TableCell className="font-medium">{product.materialNumber}</TableCell>
                          <TableCell>{product.materialDescription}</TableCell>
                          <TableCell className="text-right">{product.totalStock}</TableCell>
                          <TableCell className="text-right">{Math.round(product.confidence * 100)}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm font-semibold">Alasan Rekomendasi</p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {result.reasoning.map((item, index) => (
                  <li key={`${item}-${index}`}>• {item}</li>
                ))}
              </ul>
            </div>

            {result.rawSignals.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-semibold">Sinyal Data Terbaca</p>
                <div className="space-y-3">
                  {result.rawSignals.map((signal, signalIndex) => (
                    <div key={`${signal.customerName}-${signal.segment}-${signalIndex}`} className="rounded-lg border bg-slate-50 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{signal.customerName}</span>
                        <Badge variant="outline">{signal.segment}</Badge>
                        <Badge variant="secondary">R {signal.recency} hari</Badge>
                        <Badge variant="secondary">F {signal.frequency}</Badge>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Revenue {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(signal.monetary)}
                      </p>

                      {signal.fleetMatches.length > 0 && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          Fleet cocok:
                          {signal.fleetMatches.slice(0, 2).map((fleet, fleetIndex) => (
                            <div key={`${signal.customerName}-${fleet.site}-${fleet.location}-${fleet.tireSize}-${fleetIndex}`} className="mt-1">
                              • {fleet.site} / {fleet.location} / {fleet.tireSize} / forecast {fleet.forecast} / cocok {Math.round(fleet.confidence * 100)}%
                            </div>
                          ))}
                        </div>
                      )}

                      {signal.historyHighlights.length > 0 && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          History + stok:
                          {signal.historyHighlights.slice(0, 2).map((item, historyIndex) => (
                            <div key={`${signal.customerName}-${item.materialNo}-${item.category}-${historyIndex}`} className="mt-1">
                              • {item.materialDescription} ({item.category}) qty {item.totalQty}, revenue {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(item.revenue)}
                              {item.stockMatches[0] ? `, stok cocok ${item.stockMatches[0].materialNumber} = ${item.stockMatches[0].totalStock}` : ", stok belum ketemu"}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
