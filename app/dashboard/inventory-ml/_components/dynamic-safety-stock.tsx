"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
    AlertTriangle,
    BarChart3,
    BrainCircuit,
    Boxes,
    Clock3,
    Coins,
    Download,
    FileText,
    Gauge,
    Loader2,
    Package,
    ReceiptText,
    ShieldAlert,
    ShieldCheck,
    Sparkles,
    Target,
    TrendingUp,
    Truck,
    Users,
} from "lucide-react"
import { toast } from "sonner"

import {
    generateAIPrediction,
    getInventoryPlanningAdvisor,
    getLatestSafetyStockPredictionByMaterial,
    getMaterialSalesRevenueHistory,
    getRecentPredictions,
    getSafetyStockAnalytics,
    type InventoryPlanningAdvisor,
    type SalesRevenueHistoryYearGroup,
    type SafetyStockAnalytics,
} from "@/app/actions/inventory-ml"
import { getMaterialVendorReference, type MaterialVendorReference } from "@/app/actions/inventory-vendors"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { MaterialCombobox } from "./material-combobox"
import { SafetyStockInsightsChart } from "./safety-stock-insights-chart"

interface PredictionHistoryItem {
    id: number
    productCode: string
    productName: string | null
    predictionType: string
    recommendedStock: number
    rationale: string
    createdAt: string | Date
}

interface SafetyStockPredictionResult {
    id?: number
    productCode: string
    productName: string | null
    recommendedStock: number
    rationale: string
    currentStock?: number | null
    createdAt?: string | Date
}

interface SafetyStockReportMetric {
    label?: string
    value?: string
    icon?: string
}

interface SafetyStockRecommendation {
    title?: string
    detail?: string
}

interface SafetyStockReport {
    summary?: string
    status?: "Safe" | "Warning" | "Critical"
    metrics?: SafetyStockReportMetric[]
    recommendations?: SafetyStockRecommendation[]
}

const currencyFormatter = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
})

const numberFormatter = new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
})

const oneDecimalFormatter = new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
})

const docCurrencyFallbackFormatter = new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
})

const serviceLevelOptions = ["90", "95", "99"] as const
const exportHiddenClassName = "export-button-hide"

const waitForNextPaint = () =>
    new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))

const triggerBrowserDownload = (blob: Blob, filename: string) => {
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = objectUrl
    anchor.download = filename
    anchor.rel = "noopener"
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()

    window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl)
    }, 1000)
}

const formatQuantity = (value: number | null | undefined) => {
    if (value === null || value === undefined) {
        return "-"
    }

    if (Math.abs(value) > 0 && Math.abs(value) < 1) {
        return `${value.toFixed(2)} qty`
    }

    if (Math.abs(value) < 10 && !Number.isInteger(value)) {
        return `${oneDecimalFormatter.format(value)} qty`
    }

    return `${numberFormatter.format(value)} qty`
}

const formatCurrency = (value: number) => currencyFormatter.format(value)

const formatDateTime = (value: string | Date) => new Date(value).toLocaleString("id-ID")

const formatDocumentCurrency = (value: number, currency: string | null | undefined) => {
    if (!currency) {
        return docCurrencyFallbackFormatter.format(value)
    }

    try {
        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        }).format(value)
    } catch {
        return `${currency} ${docCurrencyFallbackFormatter.format(value)}`
    }
}

const formatDate = (value: string | Date | null) => {
    if (!value) {
        return "-"
    }

    return new Date(value).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    })
}

const formatDays = (value: number | null | undefined) => {
    if (value === null || value === undefined) {
        return "Belum ada demand"
    }

    return `${oneDecimalFormatter.format(value)} hari`
}

const parseReport = (rationale: string): SafetyStockReport | null => {
    try {
        const parsed = JSON.parse(rationale) as SafetyStockReport
        return parsed && typeof parsed === "object" ? parsed : null
    } catch {
        return null
    }
}

const getSummaryText = (rationale: string) => {
    const report = parseReport(rationale)
    return report?.summary || rationale
}

const getRevenueSummaryLabel = (group: SalesRevenueHistoryYearGroup) => {
    if (group.revenueByCurrency.length === 0) {
        return docCurrencyFallbackFormatter.format(group.totalRevenueInDocCurr)
    }

    return group.revenueByCurrency
        .map((item) => formatDocumentCurrency(item.totalRevenueInDocCurr, item.currency))
        .join(" • ")
}

const getStatusBadgeVariant = (status?: string) => {
    if (status === "Safe") return "success"
    if (status === "Warning") return "warning"
    if (status === "Critical") return "destructive"
    return "outline"
}

const getDeadStockTone = (status: SafetyStockAnalytics["deadStock"]["status"]) => {
    if (status === "Dead Risk") return "border-rose-200 bg-rose-50 text-rose-900"
    if (status === "Watchlist") return "border-amber-200 bg-amber-50 text-amber-900"
    return "border-emerald-200 bg-emerald-50 text-emerald-900"
}

const getExcessTone = (status: SafetyStockAnalytics["excessStatus"]) => {
    if (status === "Overstock") return "border-amber-200 bg-amber-50 text-amber-900"
    if (status === "Lean") return "border-rose-200 bg-rose-50 text-rose-900"
    return "border-emerald-200 bg-emerald-50 text-emerald-900"
}

const getLeadTimeTone = (status: SafetyStockAnalytics["leadTime"]["status"]) => {
    if (status === "Volatile") return "border-rose-200 bg-rose-50 text-rose-900"
    if (status === "Perlu Perhatian") return "border-amber-200 bg-amber-50 text-amber-900"
    return "border-sky-200 bg-sky-50 text-sky-900"
}

export function DynamicSafetyStock() {
    const reportRef = useRef<HTMLDivElement | null>(null)
    const autoLinkHandledRef = useRef<string | null>(null)
    const searchParams = useSearchParams()
    const [productCode, setProductCode] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [isLoadingInsights, setIsLoadingInsights] = useState(false)
    const [isLoadingSalesHistory, setIsLoadingSalesHistory] = useState(false)
    const [isExportingPdf, setIsExportingPdf] = useState(false)
    const [isPreparingPdf, setIsPreparingPdf] = useState(false)
    const [result, setResult] = useState<SafetyStockPredictionResult | null>(null)
    const [history, setHistory] = useState<PredictionHistoryItem[]>([])
    const [analytics, setAnalytics] = useState<SafetyStockAnalytics | null>(null)
    const [salesHistoryGroups, setSalesHistoryGroups] = useState<SalesRevenueHistoryYearGroup[]>([])
    const [expandedSalesYears, setExpandedSalesYears] = useState<string[]>([])
    const [reportGeneratedAt, setReportGeneratedAt] = useState<string | null>(null)
    const [activeHistoryId, setActiveHistoryId] = useState<number | null>(null)
    const [serviceLevel, setServiceLevel] = useState<(typeof serviceLevelOptions)[number]>("95")
    const [suddenOrderQty, setSuddenOrderQty] = useState(100)
    const [vendorReference, setVendorReference] = useState<MaterialVendorReference | null>(null)
    const [isLoadingVendorReference, setIsLoadingVendorReference] = useState(false)
    const [vendorName, setVendorName] = useState("")
    const [deliveryTimeInput, setDeliveryTimeInput] = useState("")
    const [advisor, setAdvisor] = useState<InventoryPlanningAdvisor | null>(null)
    const [isLoadingAdvisor, setIsLoadingAdvisor] = useState(false)

    useEffect(() => {
        loadHistory()
    }, [])

    useEffect(() => {
        const normalizedMaterial = productCode.trim()
        if (!normalizedMaterial) {
            setVendorReference(null)
            return
        }

        const loadVendorReference = async () => {
            setIsLoadingVendorReference(true)
            const response = await getMaterialVendorReference(normalizedMaterial)
            if (response.success && response.data) {
                setVendorReference(response.data)
                setVendorName(response.data.defaultVendorName || "")
                setDeliveryTimeInput(
                    response.data.defaultLeadTimeDays !== null && response.data.defaultLeadTimeDays !== undefined
                        ? String(response.data.defaultLeadTimeDays)
                        : "",
                )
            } else {
                setVendorReference(null)
            }
            setIsLoadingVendorReference(false)
        }

        void loadVendorReference()
    }, [productCode])

    const loadHistory = async () => {
        const response = await getRecentPredictions()
        if (response.success && response.data) {
            setHistory(response.data.filter((item) => item.predictionType === "SAFETY_STOCK"))
        }
    }

    const scrollReportIntoView = () => {
        requestAnimationFrame(() => {
            reportRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
            })
        })
    }

    const loadPredictionDetails = async (
        prediction: SafetyStockPredictionResult,
        options?: {
            preserveActiveYear?: boolean
            vendorName?: string
            customLeadTimeDays?: number | null
        }
    ) => {
        try {
            setResult(prediction)
            setProductCode(prediction.productCode)
            setReportGeneratedAt(
                prediction.createdAt ? new Date(prediction.createdAt).toISOString() : new Date().toISOString()
            )
            setAnalytics(null)
            setSalesHistoryGroups([])
            setAdvisor(null)
            if (!options?.preserveActiveYear) {
                setExpandedSalesYears([])
            }
            setIsLoadingInsights(true)
            setIsLoadingSalesHistory(true)

            const [analyticsResponse, salesHistoryResponse] = await Promise.all([
                getSafetyStockAnalytics(prediction.productCode, {
                    recommendedSafetyStock: prediction.recommendedStock,
                    selectedVendorName: options?.vendorName || null,
                    customLeadTimeDays: options?.customLeadTimeDays ?? null,
                }),
                getMaterialSalesRevenueHistory(prediction.productCode),
            ])

            if (analyticsResponse.success && analyticsResponse.data) {
                setAnalytics(analyticsResponse.data)
                setSuddenOrderQty(analyticsResponse.data.scenarios.suddenOrderSuggestion)
            } else {
                toast.error(analyticsResponse.error || "Insight lanjutan gagal dimuat")
            }

            if (salesHistoryResponse.success && salesHistoryResponse.data) {
                setSalesHistoryGroups(salesHistoryResponse.data)
                setExpandedSalesYears((previousYears) => {
                    if (previousYears.length > 0) {
                        const validYears = previousYears.filter((year) =>
                            salesHistoryResponse.data?.some((group) => group.year === year)
                        )
                        if (validYears.length > 0) {
                            return validYears
                        }
                    }

                    return salesHistoryResponse.data.slice(0, 1).map((group) => group.year)
                })
            } else if (!salesHistoryResponse.success) {
                toast.error(salesHistoryResponse.error || "History penjualan produk gagal dimuat")
            }

            scrollReportIntoView()
        } finally {
            setIsLoadingInsights(false)
            setIsLoadingSalesHistory(false)
        }
    }

    const loadAdvisor = async (
        materialNumber: string,
        options?: {
            vendorName?: string
            customLeadTimeDays?: number | null
        }
    ) => {
        setIsLoadingAdvisor(true)
        try {
            const response = await getInventoryPlanningAdvisor(materialNumber, {
                selectedVendorName: options?.vendorName || null,
                customLeadTimeDays: options?.customLeadTimeDays ?? null,
            })

            if (response.data) {
                setAdvisor(response.data)
            } else {
                setAdvisor(null)
            }

            if (!response.success && !response.data) {
                toast.error(response.error || "Advisor AI gagal dimuat")
            }
        } finally {
            setIsLoadingAdvisor(false)
        }
    }

    const handleSelectHistory = async (item: PredictionHistoryItem) => {
        setActiveHistoryId(item.id)

        try {
            await loadPredictionDetails(
                {
                    id: item.id,
                    productCode: item.productCode,
                    productName: item.productName,
                    recommendedStock: item.recommendedStock,
                    rationale: item.rationale,
                    createdAt: item.createdAt,
                },
                {
                    preserveActiveYear: false,
                    vendorName: vendorName.trim() || undefined,
                    customLeadTimeDays: deliveryTimeInput ? Number(deliveryTimeInput) : null,
                }
            )
            await loadAdvisor(item.productCode, {
                vendorName: vendorName.trim() || undefined,
                customLeadTimeDays: deliveryTimeInput ? Number(deliveryTimeInput) : null,
            })
            toast.success(`History ${item.productCode} berhasil ditampilkan`)
        } catch (error) {
            const message = error instanceof Error ? error.message : "Gagal membuka history analisa"
            toast.error(message)
        }
    }

    const runSafetyStockCalculation = async (materialInput: string) => {
        const normalizedMaterial = materialInput.trim()
        if (!normalizedMaterial) {
            toast.error("Silakan masukkan Material Number")
            return
        }

        setProductCode(normalizedMaterial)

        setIsLoading(true)
        setIsLoadingInsights(false)
        setIsLoadingSalesHistory(false)
        setResult(null)
        setAnalytics(null)
        setSalesHistoryGroups([])
        setExpandedSalesYears([])
        setReportGeneratedAt(null)
        setActiveHistoryId(null)

        try {
            const predictionResponse = await generateAIPrediction(normalizedMaterial, "SAFETY_STOCK", { forceRefresh: true })

            if (!predictionResponse.success || !predictionResponse.data) {
                toast.error(predictionResponse.error || "Gagal membuat perhitungan")
                return
            }

            const nextResult: SafetyStockPredictionResult = {
                id: predictionResponse.data.id,
                productCode: predictionResponse.data.productCode,
                productName: predictionResponse.data.productName,
                recommendedStock: predictionResponse.data.recommendedStock,
                rationale: predictionResponse.data.rationale,
                currentStock: predictionResponse.data.currentStock,
                createdAt: predictionResponse.data.createdAt,
            }
            setActiveHistoryId(predictionResponse.data.id)

            if (predictionResponse.cached) {
                toast.success("Mengambil data prediksi dari cache 24 jam terakhir")
            } else {
                toast.success("Analisis Safety Stock berhasil dibuat")
            }

            await loadPredictionDetails(nextResult, {
                preserveActiveYear: false,
                vendorName: vendorName.trim() || undefined,
                customLeadTimeDays: deliveryTimeInput ? Number(deliveryTimeInput) : null,
            })
            await loadAdvisor(nextResult.productCode, {
                vendorName: vendorName.trim() || undefined,
                customLeadTimeDays: deliveryTimeInput ? Number(deliveryTimeInput) : null,
            })
            await loadHistory()
        } catch (error) {
            const message = error instanceof Error ? error.message : "Terjadi kesalahan"
            toast.error(message)
        } finally {
            setIsLoading(false)
        }
    }

    const handleGenerate = async () => {
        await runSafetyStockCalculation(productCode)
    }

    const handleApplyVendorLeadTime = async () => {
        if (!result) {
            toast.error("Silakan hitung safety stock terlebih dahulu")
            return
        }

        await loadPredictionDetails(result, {
            preserveActiveYear: true,
            vendorName: vendorName.trim() || undefined,
            customLeadTimeDays: deliveryTimeInput ? Number(deliveryTimeInput) : null,
        })
        await loadAdvisor(result.productCode, {
            vendorName: vendorName.trim() || undefined,
            customLeadTimeDays: deliveryTimeInput ? Number(deliveryTimeInput) : null,
        })
        toast.success("ROP dan lead time berhasil diperbarui")
    }

    // This hydration should only react to URL query changes.
    /* eslint-disable react-hooks/exhaustive-deps */
    useEffect(() => {
        const materialFromQuery = searchParams.get("material")?.trim()
        if (!materialFromQuery) {
            return
        }

        const autoRun = searchParams.get("autoRun") === "1"
        const queryKey = `${materialFromQuery}|${searchParams.get("predictionId") || ""}|${autoRun ? "1" : "0"}`
        if (autoLinkHandledRef.current === queryKey) {
            return
        }
        autoLinkHandledRef.current = queryKey

        const hydrateFromLinkedMaterial = async () => {
            setProductCode(materialFromQuery)

            const latestPrediction = await getLatestSafetyStockPredictionByMaterial(materialFromQuery)

            if (latestPrediction.success && latestPrediction.data) {
                setActiveHistoryId(latestPrediction.data.id)
                await loadPredictionDetails(
                    {
                        id: latestPrediction.data.id,
                        productCode: latestPrediction.data.productCode,
                        productName: latestPrediction.data.productName,
                        recommendedStock: latestPrediction.data.recommendedStock,
                        rationale: latestPrediction.data.rationale,
                        currentStock: latestPrediction.data.currentStock,
                        createdAt: latestPrediction.data.createdAt,
                    },
                    {
                        preserveActiveYear: false,
                        vendorName: vendorName.trim() || undefined,
                        customLeadTimeDays: deliveryTimeInput ? Number(deliveryTimeInput) : null,
                    }
                )
                await loadAdvisor(latestPrediction.data.productCode, {
                    vendorName: vendorName.trim() || undefined,
                    customLeadTimeDays: deliveryTimeInput ? Number(deliveryTimeInput) : null,
                })
                await loadHistory()
                return
            }

            if (autoRun) {
                await runSafetyStockCalculation(materialFromQuery)
            }
        }

        void hydrateFromLinkedMaterial()
    }, [searchParams])
    /* eslint-enable react-hooks/exhaustive-deps */

    const handleExportPdf = async () => {
        if (!reportRef.current || !analytics || !result) {
            toast.error("Silakan hitung Dynamic Safety Stock terlebih dahulu")
            return
        }

        const previousExpandedYears = [...expandedSalesYears]

        try {
            setIsExportingPdf(true)
            setIsPreparingPdf(true)

            if (salesHistoryGroups.length > 0) {
                setExpandedSalesYears(salesHistoryGroups.map((group) => group.year))
            }

            await waitForNextPaint()

            const { toCanvas } = await import("html-to-image")
            const { jsPDF } = await import("jspdf")
            const canvas = await toCanvas(reportRef.current, {
                backgroundColor: "#ffffff",
                pixelRatio: 2,
                cacheBust: true,
                skipAutoScale: true,
                filter: (node) => {
                    return !(
                        node instanceof HTMLElement &&
                        node.classList.contains(exportHiddenClassName)
                    )
                },
            })

            const pdf = new jsPDF({
                orientation: "p",
                unit: "mm",
                format: "a4",
            })

            const margin = 10
            const pageWidth = pdf.internal.pageSize.getWidth()
            const pageHeight = pdf.internal.pageSize.getHeight()
            const printableWidth = pageWidth - (margin * 2)
            const printableHeight = pageHeight - (margin * 2)
            const imageHeight = (canvas.height * printableWidth) / canvas.width
            const imageData = canvas.toDataURL("image/png")

            let remainingHeight = imageHeight
            let position = margin

            pdf.addImage(imageData, "PNG", margin, position, printableWidth, imageHeight, undefined, "FAST")
            remainingHeight -= printableHeight

            while (remainingHeight > 0) {
                position = margin - (imageHeight - remainingHeight)
                pdf.addPage()
                pdf.addImage(imageData, "PNG", margin, position, printableWidth, imageHeight, undefined, "FAST")
                remainingHeight -= printableHeight
            }

            const safeMaterialNo = result.productCode.replace(/[^a-zA-Z0-9-_]+/g, "-")
            const exportDate = new Date().toISOString().slice(0, 10)
            const filename = `dynamic-safety-stock-${safeMaterialNo}-${exportDate}.pdf`
            const pdfBlob = pdf.output("blob")

            triggerBrowserDownload(pdfBlob, filename)
            toast.success("Report PDF berhasil dibuat")
        } catch (error) {
            console.error("Dynamic Safety Stock PDF export failed:", error)
            const message = error instanceof Error ? error.message : "Gagal membuat PDF"
            toast.error(message)
        } finally {
            setExpandedSalesYears(previousExpandedYears)
            setIsPreparingPdf(false)
            setIsExportingPdf(false)
        }
    }

    const report = result ? parseReport(result.rationale) : null
    const selectedScenario = analytics?.scenarios.options.find(
        (option) => String(option.serviceLevel) === serviceLevel
    ) ?? analytics?.scenarios.options[0]
    const simulatedStock = analytics ? Math.max(0, analytics.currentStock - suddenOrderQty) : 0
    const simulatedDaysOfCover = analytics && analytics.avgDailyDemand > 0
        ? Number((simulatedStock / analytics.avgDailyDemand).toFixed(1))
        : null
    const simulatedDaysUntilReorder = analytics && selectedScenario && analytics.avgDailyDemand > 0
        ? Math.max(0, Math.floor((simulatedStock - selectedScenario.reorderPoint) / analytics.avgDailyDemand))
        : null
    const simulatedGapToRop = selectedScenario
        ? Math.max(0, selectedScenario.reorderPoint - simulatedStock)
        : 0
    const scenarioSliderMax = analytics
        ? Math.max(100, Math.ceil(analytics.currentStock + analytics.dynamicSafetyStock))
        : 400

    return (
        <div className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.82fr)]">
                <Card className="overflow-hidden border-indigo-100 shadow-sm">
                    <CardHeader className="bg-gradient-to-br from-indigo-50 via-white to-sky-50">
                        <CardTitle className="flex items-center gap-2">
                            <BrainCircuit className="h-5 w-5 text-indigo-500" />
                            Dynamic Safety Stock
                        </CardTitle>
                        <CardDescription className="max-w-2xl text-sm leading-relaxed">
                            Hitung safety stock, baca risiko stockout lebih cepat lewat chart time-series,
                            dan lihat dampak modal mengendap langsung dari material SAP yang Anda pilih.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 p-5">
                        <div className="space-y-2">
                            <Label>Material Number</Label>
                            <MaterialCombobox value={productCode} onChange={setProductCode} />
                        </div>

                        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between gap-3">
                                    <Label htmlFor="vendor-name">Vendor</Label>
                                    <Button asChild variant="link" className="h-auto p-0 text-sky-700">
                                        <Link href="/dashboard/inventory-ml/vendors">Kelola Vendor Delivery</Link>
                                    </Button>
                                </div>
                                <Input
                                    id="vendor-name"
                                    value={vendorName}
                                    onChange={(event) => setVendorName(event.target.value)}
                                    placeholder="Masukkan nama vendor"
                                />
                                <div className="flex flex-wrap gap-2">
                                    {vendorReference?.vendors.slice(0, 4).map((vendor) => (
                                        <Button
                                            key={`${vendor.vendorName}-${vendor.source}`}
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                setVendorName(vendor.vendorName)
                                                setDeliveryTimeInput(vendor.leadTimeDays ? String(vendor.leadTimeDays) : "")
                                            }}
                                            className="h-8"
                                        >
                                            {vendor.vendorName}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="delivery-time">Delivery Time (hari)</Label>
                                <Input
                                    id="delivery-time"
                                    type="number"
                                    min={1}
                                    value={deliveryTimeInput}
                                    onChange={(event) => setDeliveryTimeInput(event.target.value)}
                                    placeholder="21"
                                />
                                <p className="text-xs text-muted-foreground">
                                    {isLoadingVendorReference
                                        ? "Memuat referensi vendor..."
                                        : vendorReference?.defaultVendorName
                                            ? `Default dari master: ${vendorReference.defaultVendorName} • ${vendorReference.defaultLeadTimeDays ?? "-"} hari`
                                            : "Bisa diisi manual atau dipilih dari master vendor."}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row">
                            <Button
                                onClick={handleGenerate}
                                disabled={isLoading}
                                className="flex-1 bg-indigo-600 text-white hover:bg-indigo-700"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Menghitung Dynamic Safety Stock...
                                    </>
                                ) : (
                                    "Kalkulasi Safety Stock"
                                )}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleExportPdf}
                                disabled={!analytics || isExportingPdf || isLoading}
                                className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                            >
                                {isExportingPdf ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Menyiapkan PDF...
                                    </>
                                ) : (
                                    <>
                                        <Download className="mr-2 h-4 w-4" />
                                        Save PDF Report
                                    </>
                                )}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleApplyVendorLeadTime}
                                disabled={!result || isLoadingInsights}
                                className="border-sky-200 text-sky-700 hover:bg-sky-50"
                            >
                                Terapkan Vendor & Delivery
                            </Button>
                        </div>

                        {result && (
                            <Alert className="border-indigo-200 bg-indigo-50/80">
                                <ShieldCheck className="h-4 w-4 text-indigo-600" />
                                <AlertTitle className="flex flex-wrap items-center gap-2 text-indigo-900">
                                    <span>Safety Stock AI: {numberFormatter.format(result.recommendedStock)} qty</span>
                                    {report?.status && (
                                        <Badge variant={getStatusBadgeVariant(report.status)}>
                                            {report.status}
                                        </Badge>
                                    )}
                                </AlertTitle>
                                <AlertDescription className="mt-2 space-y-3 text-sm leading-relaxed text-indigo-950/80">
                                    <p>{report?.summary || "Model AI telah membuat ringkasan safety stock terbaru."}</p>
                                    {report?.metrics && report.metrics.length > 0 && (
                                        <div className="grid gap-2 sm:grid-cols-3">
                                            {report.metrics.slice(0, 3).map((metric) => (
                                                <div
                                                    key={`${metric.label}-${metric.value}`}
                                                    className="rounded-xl border border-indigo-100 bg-white/80 p-3"
                                                >
                                                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-500">
                                                        {metric.label}
                                                    </p>
                                                    <p className="mt-1 text-base font-semibold text-slate-900">
                                                        {metric.value || "-"}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </AlertDescription>
                            </Alert>
                        )}
                    </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-muted-foreground">
                            <ShieldAlert className="h-5 w-5" />
                            History Perhitungan
                        </CardTitle>
                        <CardDescription>
                            Klik history untuk menampilkan kembali analisa lama di layout report yang sama.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="max-h-[420px] space-y-4 overflow-y-auto pr-1">
                            {history.length === 0 ? (
                                <p className="py-8 text-center text-sm text-muted-foreground">
                                    Belum ada data history perhitungan.
                                </p>
                            ) : (
                                history.map((item) => {
                                    const itemReport = parseReport(item.rationale)

                                    return (
                                        <button
                                            type="button"
                                            key={item.id}
                                            onClick={() => void handleSelectHistory(item)}
                                            disabled={isLoadingInsights || isLoading}
                                            className={cn(
                                                "w-full space-y-2 rounded-2xl border p-4 text-left text-sm shadow-sm transition-all",
                                                activeHistoryId === item.id
                                                    ? "border-indigo-300 bg-indigo-50/70 shadow-indigo-100"
                                                    : "border-indigo-100 bg-white hover:border-indigo-200 hover:bg-indigo-50/40"
                                            )}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="font-semibold text-slate-900">{item.productCode}</p>
                                                    {item.productName && (
                                                        <p className="truncate text-xs text-muted-foreground">
                                                            {item.productName}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="text-right">
                                                    <p className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-800">
                                                        {numberFormatter.format(item.recommendedStock)} qty
                                                    </p>
                                                    {itemReport?.status && (
                                                        <Badge
                                                            variant={getStatusBadgeVariant(itemReport.status)}
                                                            className="mt-2"
                                                        >
                                                            {itemReport.status}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                            <p className="line-clamp-3 text-slate-600">
                                                {getSummaryText(item.rationale)}
                                            </p>
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="text-[11px] font-medium text-indigo-600">
                                                    {activeHistoryId === item.id ? "Sedang ditampilkan" : "Tampilkan analisa"}
                                                </span>
                                                <div className="text-right text-[10px] text-slate-400">
                                                    {formatDateTime(item.createdAt)}
                                                </div>
                                            </div>
                                        </button>
                                    )
                                })
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {result && isLoadingInsights && (
                <Card>
                    <CardContent className="flex h-[260px] items-center justify-center">
                        <div className="flex flex-col items-center gap-3 text-center">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <div className="space-y-1">
                                <p className="font-medium text-slate-900">Menyusun insight Dynamic Safety Stock...</p>
                                <p className="text-sm text-muted-foreground">
                                    Menyiapkan forecast, analisa excess stock, ROP, dan simulasi what-if.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {analytics && (
                <div ref={reportRef} className="space-y-6">
                    <Card className="border-slate-200 shadow-sm">
                        <CardContent className="space-y-5 p-5">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-indigo-700">
                                        <FileText className="h-4 w-4" />
                                        Report Dynamic Safety Stock
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-bold text-slate-900">
                                            {analytics.materialNo}
                                        </h3>
                                        <p className="mt-1 text-sm text-slate-600">
                                            {analytics.materialDesc || result?.productName || "Material SAP"}
                                        </p>
                                    </div>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                        Generated At
                                    </p>
                                    <p className="mt-1 font-semibold text-slate-900">
                                        {formatDateTime(reportGeneratedAt || new Date())}
                                    </p>
                                    <p className="mt-2 text-xs text-slate-500">
                                        Detail transaksi diambil dari tabel `Sales_revenue_sap`.
                                    </p>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleExportPdf}
                                        disabled={!analytics || isExportingPdf}
                                        className={cn(
                                            "mt-3 w-full border-indigo-200 text-indigo-700 hover:bg-indigo-50",
                                            exportHiddenClassName
                                        )}
                                    >
                                        {isExportingPdf ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Menyiapkan PDF...
                                            </>
                                        ) : (
                                            <>
                                                <Download className="mr-2 h-4 w-4" />
                                                Save PDF Report
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                <div className="rounded-2xl border bg-slate-50 p-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                        Safety Stock AI
                                    </p>
                                    <p className="mt-1 text-xl font-bold text-slate-900">
                                        {formatQuantity(result?.recommendedStock || 0)}
                                    </p>
                                </div>
                                <div className="rounded-2xl border bg-slate-50 p-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                        Current Stock
                                    </p>
                                    <p className="mt-1 text-xl font-bold text-slate-900">
                                        {formatQuantity(analytics.currentStock)}
                                    </p>
                                </div>
                                <div className="rounded-2xl border bg-slate-50 p-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                        Reorder Point
                                    </p>
                                    <p className="mt-1 text-xl font-bold text-slate-900">
                                        {formatQuantity(analytics.reorderPoint)}
                                    </p>
                                </div>
                                <div className="rounded-2xl border bg-slate-50 p-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                        Status
                                    </p>
                                    <div className="mt-2">
                                        <Badge variant={getStatusBadgeVariant(report?.status || analytics.excessStatus)}>
                                            {report?.status || analytics.excessStatus}
                                        </Badge>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">
                                    Executive Summary
                                </p>
                                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                                    {report?.summary || "Model AI telah membuat ringkasan safety stock terbaru."}
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                        <Card className="border-slate-200 shadow-sm">
                            <CardContent className="flex items-center gap-4 p-5">
                                <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
                                    <Package className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                        Current Stock
                                    </p>
                                    <p className="mt-1 text-2xl font-bold text-slate-900">
                                        {numberFormatter.format(analytics.currentStock)}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border-rose-100 shadow-sm">
                            <CardContent className="flex items-center gap-4 p-5">
                                <div className="rounded-2xl bg-rose-50 p-3 text-rose-700">
                                    <ShieldCheck className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                        Dynamic Safety Stock
                                    </p>
                                    <p className="mt-1 text-2xl font-bold text-slate-900">
                                        {numberFormatter.format(analytics.dynamicSafetyStock)}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border-violet-100 shadow-sm">
                            <CardContent className="flex items-center gap-4 p-5">
                                <div className="rounded-2xl bg-violet-50 p-3 text-violet-700">
                                    <Target className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                        Reorder Point
                                    </p>
                                    <p className="mt-1 text-2xl font-bold text-slate-900">
                                        {numberFormatter.format(analytics.reorderPoint)}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border-amber-100 shadow-sm">
                            <CardContent className="flex items-center gap-4 p-5">
                                <div className="rounded-2xl bg-amber-50 p-3 text-amber-700">
                                    <Clock3 className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                        Days of Cover
                                    </p>
                                    <p className="mt-1 text-2xl font-bold text-slate-900">
                                        {formatDays(analytics.daysOfCover)}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border-emerald-100 shadow-sm">
                            <CardContent className="flex items-center gap-4 p-5">
                                <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
                                    <Coins className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                        Excess Value
                                    </p>
                                    <p className="mt-1 text-2xl font-bold text-slate-900">
                                        {formatCurrency(analytics.excessStockValue)}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <SafetyStockInsightsChart analytics={analytics} />

                    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
                        <Card className="border-slate-200 shadow-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Coins className="h-5 w-5 text-amber-600" />
                                    Analisa Excess Stock
                                </CardTitle>
                                <CardDescription>
                                    Melihat apakah stok saat ini masih efisien atau justru terlalu besar dibanding demand.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div
                                    className={cn(
                                        "rounded-2xl border p-4",
                                        getExcessTone(analytics.excessStatus)
                                    )}
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-[0.18em]">
                                                Status Stok
                                            </p>
                                            <p className="mt-2 text-xl font-bold">{analytics.excessStatus}</p>
                                        </div>
                                        <Badge variant="outline" className="bg-white/70">
                                            Unit cost approx. {formatCurrency(analytics.unitCost)}
                                        </Badge>
                                    </div>
                                    <p className="mt-3 text-sm leading-relaxed">
                                        Stok saat ini {numberFormatter.format(analytics.currentStock)} qty.
                                        Dengan ROP {numberFormatter.format(analytics.reorderPoint)} qty,
                                        ada potensi modal mengendap sebanyak{" "}
                                        <span className="font-semibold">
                                            {numberFormatter.format(analytics.excessStockUnits)} qty
                                        </span>{" "}
                                        atau sekitar{" "}
                                        <span className="font-semibold">
                                            {formatCurrency(analytics.excessStockValue)}
                                        </span>.
                                    </p>
                                </div>

                                <div
                                    className={cn(
                                        "rounded-2xl border p-4",
                                        getDeadStockTone(analytics.deadStock.status)
                                    )}
                                >
                                    <div className="flex flex-wrap items-center gap-2">
                                        <AlertTriangle className="h-4 w-4" />
                                        <p className="font-semibold">
                                            Dead Stock Alert: {analytics.deadStock.status}
                                        </p>
                                    </div>
                                    <p className="mt-3 text-sm leading-relaxed">
                                        {analytics.deadStock.message}
                                    </p>
                                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                        <div className="rounded-xl bg-white/70 p-3">
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">
                                                Last Movement
                                            </p>
                                            <p className="mt-1 font-semibold">
                                                {formatDate(analytics.deadStock.lastMovementDate)}
                                            </p>
                                        </div>
                                        <div className="rounded-xl bg-white/70 p-3">
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">
                                                No Movement
                                            </p>
                                            <p className="mt-1 font-semibold">
                                                {analytics.deadStock.monthsWithoutMovement} bulan
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-slate-200 shadow-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Truck className="h-5 w-5 text-violet-600" />
                                    Dynamic Reorder Point & Lead Time
                                </CardTitle>
                                <CardDescription>
                                    Kapan mulai pesan lagi dan seberapa stabil vendor mengirim material ini.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4">
                                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">
                                            Countdown to Reorder
                                        </p>
                                        <p className="mt-2 text-2xl font-bold text-slate-900">
                                            {analytics.daysUntilReorder === null
                                                ? "Belum ada demand"
                                                : analytics.daysUntilReorder === 0
                                                    ? "Pesan sekarang"
                                                    : `${numberFormatter.format(analytics.daysUntilReorder)} hari lagi`}
                                        </p>
                                        <p className="mt-2 text-sm text-slate-600">
                                            Formula ROP = (Average Daily Sales x Lead Time) + Safety Stock
                                        </p>
                                    </div>
                                    <div
                                        className={cn(
                                            "rounded-2xl border p-4",
                                            getLeadTimeTone(analytics.leadTime.status)
                                        )}
                                    >
                                        <p className="text-xs font-semibold uppercase tracking-[0.18em]">
                                            Vendor Performance
                                        </p>
                                        <p className="mt-2 text-2xl font-bold">{analytics.leadTime.status}</p>
                                        <p className="mt-2 text-sm leading-relaxed">
                                            {analytics.leadTime.insight}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-3">
                                    <div className="rounded-xl border bg-slate-50 p-4">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                            Avg Lead Time
                                        </p>
                                        <p className="mt-1 text-xl font-bold text-slate-900">
                                            {oneDecimalFormatter.format(analytics.leadTime.averageDays)} hari
                                        </p>
                                    </div>
                                    <div className="rounded-xl border bg-slate-50 p-4">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                            Variability
                                        </p>
                                        <p className="mt-1 text-xl font-bold text-slate-900">
                                            {oneDecimalFormatter.format(analytics.leadTime.stdDevDays)} hari
                                        </p>
                                    </div>
                                    <div className="rounded-xl border bg-slate-50 p-4">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                            Buffer Added
                                        </p>
                                        <p className="mt-1 text-xl font-bold text-slate-900">
                                            {numberFormatter.format(analytics.leadTime.bufferIncrease)} qty
                                        </p>
                                    </div>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="rounded-xl border bg-slate-50 p-4">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                            Lead Time Source
                                        </p>
                                        <p className="mt-1 text-base font-bold text-slate-900">
                                            {analytics.leadTime.sourceLabel}
                                        </p>
                                    </div>
                                    <div className="rounded-xl border bg-slate-50 p-4">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                            Applied Vendor
                                        </p>
                                        <p className="mt-1 text-base font-bold text-slate-900">
                                            {analytics.leadTime.selectedVendorName || "Mengikuti histori umum"}
                                        </p>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                        Top Vendors
                                    </p>
                                    <div className="mt-3 space-y-3">
                                        {analytics.leadTime.vendors.length === 0 ? (
                                            <p className="text-sm text-muted-foreground">
                                                Belum ada histori vendor yang cukup untuk material ini.
                                            </p>
                                        ) : (
                                            analytics.leadTime.vendors.map((vendor) => (
                                                <div
                                                    key={vendor.name}
                                                    className="flex items-start justify-between gap-4 rounded-xl border bg-white p-3"
                                                >
                                                    <div className="min-w-0">
                                                        <p className="truncate font-semibold text-slate-900">
                                                            {vendor.name}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {vendor.sampleSize} PO • {numberFormatter.format(vendor.orderedQty)} qty
                                                        </p>
                                                    </div>
                                                    <p className="shrink-0 text-sm font-semibold text-slate-700">
                                                        {oneDecimalFormatter.format(vendor.averageDays)} hari
                                                    </p>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.92fr)]">
                        <Card className="border-slate-200 shadow-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Gauge className="h-5 w-5 text-rose-600" />
                                    Planning Scorecard
                                </CardTitle>
                                <CardDescription>
                                    Ringkasan risiko, urgency order, dan target replenishment agar keputusan PO lebih cepat.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="rounded-2xl border border-rose-100 bg-rose-50/70 p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">
                                                Stockout Risk
                                            </p>
                                            <Badge variant={analytics.planning.stockoutRiskLabel === "Critical" ? "destructive" : analytics.planning.stockoutRiskLabel === "High" ? "warning" : "outline"}>
                                                {analytics.planning.stockoutRiskLabel}
                                            </Badge>
                                        </div>
                                        <p className="mt-2 text-2xl font-bold text-slate-900">
                                            {analytics.planning.stockoutRiskScore}/100
                                        </p>
                                        <Progress value={analytics.planning.stockoutRiskScore} className="mt-3 h-2" />
                                    </div>

                                    <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                                                Urgency Order
                                            </p>
                                            <Badge variant={analytics.planning.urgencyLabel === "Order Now" ? "destructive" : analytics.planning.urgencyLabel === "Order Soon" ? "warning" : "outline"}>
                                                {analytics.planning.urgencyLabel}
                                            </Badge>
                                        </div>
                                        <p className="mt-2 text-2xl font-bold text-slate-900">
                                            {analytics.planning.urgencyScore}/100
                                        </p>
                                        <Progress value={analytics.planning.urgencyScore} className="mt-3 h-2" />
                                    </div>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                    <div className="rounded-xl border bg-slate-50 p-4">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Recommended PO Qty</p>
                                        <p className="mt-1 text-xl font-bold text-slate-900">{formatQuantity(analytics.planning.recommendedOrderQty)}</p>
                                    </div>
                                    <div className="rounded-xl border bg-slate-50 p-4">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Target Max Stock</p>
                                        <p className="mt-1 text-xl font-bold text-slate-900">{formatQuantity(analytics.planning.targetMaxStock)}</p>
                                    </div>
                                    <div className="rounded-xl border bg-slate-50 p-4">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Next Review</p>
                                        <p className="mt-1 text-xl font-bold text-slate-900">{analytics.planning.nextReviewDate ? formatDate(analytics.planning.nextReviewDate) : "-"}</p>
                                    </div>
                                    <div className="rounded-xl border bg-slate-50 p-4">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Review Cadence</p>
                                        <p className="mt-1 text-xl font-bold text-slate-900">{analytics.planning.suggestedReviewDays ? `${analytics.planning.suggestedReviewDays} hari` : "-"}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-slate-200 shadow-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Users className="h-5 w-5 text-amber-600" />
                                    Demand Pattern & Vendor Mix
                                </CardTitle>
                                <CardDescription>
                                    Membantu membaca apakah material ini stabil, musiman, atau terlalu bergantung pada satu vendor.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Demand Pattern</p>
                                        <p className="mt-2 text-2xl font-bold text-slate-900">{analytics.planning.demandPattern}</p>
                                        <p className="mt-2 text-sm text-slate-600">{analytics.forecast.confidenceNote}</p>
                                    </div>
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Vendor Dependency</p>
                                        <p className="mt-2 text-2xl font-bold text-slate-900">{analytics.planning.vendorDependencyPct}%</p>
                                        <p className="mt-2 text-sm text-slate-600">Dependensi vendor: {analytics.planning.vendorDependencyLabel}</p>
                                    </div>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="rounded-xl border bg-slate-50 p-4">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Seasonality Index</p>
                                        <p className="mt-1 text-xl font-bold text-slate-900">{oneDecimalFormatter.format(analytics.planning.seasonalityIndex)}x</p>
                                    </div>
                                    <div className="rounded-xl border bg-slate-50 p-4">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Forecast 3 Bulan</p>
                                        <p className="mt-1 text-xl font-bold text-slate-900">{formatQuantity(analytics.forecast.nextQuarterDemand)}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.95fr)]">
                        <Card className="border-slate-200 shadow-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Sparkles className="h-5 w-5 text-sky-600" />
                                    Simulasi What-If
                                </CardTitle>
                                <CardDescription>
                                    Uji skenario order mendadak dan bandingkan safety stock berdasarkan service level.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_200px]">
                                    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <Label htmlFor="sudden-order" className="font-medium">
                                                Pesanan Mendadak
                                            </Label>
                                            <span className="text-sm font-semibold text-slate-700">
                                                {numberFormatter.format(suddenOrderQty)} qty
                                            </span>
                                        </div>
                                        <Slider
                                            value={[suddenOrderQty]}
                                            onValueChange={(values) => setSuddenOrderQty(values[0] || 0)}
                                            min={0}
                                            max={scenarioSliderMax}
                                            step={5}
                                        />
                                        <Input
                                            id="sudden-order"
                                            type="number"
                                            min={0}
                                            max={scenarioSliderMax}
                                            value={suddenOrderQty}
                                            onChange={(event) => setSuddenOrderQty(Number(event.target.value) || 0)}
                                        />
                                    </div>

                                    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                                        <Label htmlFor="service-level" className="font-medium">
                                            Service Level
                                        </Label>
                                        <Select
                                            value={serviceLevel}
                                            onValueChange={(value) => {
                                                if (serviceLevelOptions.includes(value as (typeof serviceLevelOptions)[number])) {
                                                    setServiceLevel(value as (typeof serviceLevelOptions)[number])
                                                }
                                            }}
                                        >
                                            <SelectTrigger id="service-level" className="w-full bg-white">
                                                <SelectValue placeholder="Pilih service level" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {serviceLevelOptions.map((value) => (
                                                    <SelectItem key={value} value={value}>
                                                        {value}%
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-xs leading-relaxed text-muted-foreground">
                                            99% berarti hampir tidak pernah stockout, tapi stok pengaman akan lebih tinggi.
                                        </p>
                                    </div>
                                </div>

                                <div className="grid gap-3 md:grid-cols-3">
                                    {analytics.scenarios.options.map((option) => (
                                        <div
                                            key={option.serviceLevel}
                                            className={cn(
                                                "rounded-2xl border p-4 transition-colors",
                                                String(option.serviceLevel) === serviceLevel
                                                    ? "border-sky-300 bg-sky-50"
                                                    : "border-slate-200 bg-white"
                                            )}
                                        >
                                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                                Service Level
                                            </p>
                                            <p className="mt-1 text-2xl font-bold text-slate-900">{option.label}</p>
                                            <div className="mt-3 space-y-2 text-sm text-slate-600">
                                                <p>Safety Stock: {formatQuantity(option.safetyStock)}</p>
                                                <p>ROP: {formatQuantity(option.reorderPoint)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {selectedScenario && (
                                    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-sky-50 p-5">
                                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                                    After Shock Stock
                                                </p>
                                                <p className="mt-1 text-xl font-bold text-slate-900">
                                                    {formatQuantity(simulatedStock)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                                    New Cover
                                                </p>
                                                <p className="mt-1 text-xl font-bold text-slate-900">
                                                    {formatDays(simulatedDaysOfCover)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                                    Reorder Countdown
                                                </p>
                                                <p className="mt-1 text-xl font-bold text-slate-900">
                                                    {simulatedDaysUntilReorder === null
                                                        ? "Belum ada demand"
                                                        : simulatedDaysUntilReorder === 0
                                                            ? "Segera order"
                                                            : `${numberFormatter.format(simulatedDaysUntilReorder)} hari`}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                                    Gap to ROP
                                                </p>
                                                <p className="mt-1 text-xl font-bold text-slate-900">
                                                    {formatQuantity(simulatedGapToRop)}
                                                </p>
                                            </div>
                                        </div>
                                        <p className="mt-4 text-sm leading-relaxed text-slate-600">
                                            Jika ada order mendadak {numberFormatter.format(suddenOrderQty)} qty
                                            dengan target service level {selectedScenario.label}, maka safety stock
                                            ideal menjadi {numberFormatter.format(selectedScenario.safetyStock)} qty
                                            dan titik pesan ulang ada di {numberFormatter.format(selectedScenario.reorderPoint)} qty.
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="border-slate-200 shadow-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <BarChart3 className="h-5 w-5 text-emerald-600" />
                                    Insight Sekarang vs Masa Depan
                                </CardTitle>
                                <CardDescription>
                                    Ringkasan perbandingan kondisi saat ini dan peluang optimasi berikutnya.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                            Saat Ini
                                        </p>
                                        <p className="mt-2 text-lg font-bold text-slate-900">
                                            {report?.status || analytics.excessStatus}
                                        </p>
                                        <p className="mt-2 text-sm leading-relaxed text-slate-600">
                                            Safety stock AI saat ini {numberFormatter.format(result?.recommendedStock || 0)} qty
                                            dengan ketahanan stok {formatDays(analytics.daysOfCover)}.
                                        </p>
                                    </div>
                                    <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
                                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                                            Deep Insight
                                        </p>
                                        <p className="mt-2 text-lg font-bold text-slate-900">
                                            {analytics.excessStatus === "Overstock" ? "Safe, but inefficient" : "Safe and responsive"}
                                        </p>
                                        <p className="mt-2 text-sm leading-relaxed text-slate-600">
                                            Dashboard sekarang juga membaca modal mengendap, countdown ke ROP,
                                            performa vendor, dan simulasi service level 90% vs 99%.
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {(report?.recommendations && report.recommendations.length > 0
                                        ? report.recommendations
                                        : [
                                            {
                                                title: "Review Safety Stock Berkala",
                                                detail: "Naikkan review cadence saat lead time vendor volatile atau demand musiman mulai naik.",
                                            },
                                            {
                                                title: "Optimasi Modal Mengendap",
                                                detail: "Gunakan excess stock value untuk memutuskan promosi, bundling, atau redistribusi antar lokasi.",
                                            },
                                        ]
                                    ).slice(0, 3).map((recommendation) => (
                                        <div
                                            key={`${recommendation.title}-${recommendation.detail}`}
                                            className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                                        >
                                            <p className="font-semibold text-slate-900">
                                                {recommendation.title || "Strategi Safety Stock"}
                                            </p>
                                            <p className="mt-2 text-sm leading-relaxed text-slate-600">
                                                {recommendation.detail || "Gunakan insight ini sebagai acuan review mingguan."}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="border-slate-200 shadow-sm">
                        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <BrainCircuit className="h-5 w-5 text-indigo-600" />
                                    AI Inventory Advisor
                                </CardTitle>
                                <CardDescription>
                                    Advisor ini memakai metrik forecast yang sudah dihitung lalu diringkas oleh Ollama agar tindak lanjut pembelian lebih jelas.
                                </CardDescription>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => void loadAdvisor(analytics.materialNo, {
                                    vendorName: vendorName.trim() || undefined,
                                    customLeadTimeDays: deliveryTimeInput ? Number(deliveryTimeInput) : null,
                                })}
                                disabled={isLoadingAdvisor}
                            >
                                {isLoadingAdvisor ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Menyusun Advisor...
                                    </>
                                ) : (
                                    "Refresh Advisor"
                                )}
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {advisor ? (
                                <>
                                    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <Badge variant={advisor.priority === "Critical" ? "destructive" : advisor.priority === "High" ? "warning" : "outline"}>
                                                Priority {advisor.priority}
                                            </Badge>
                                        </div>
                                        <p className="mt-3 text-sm leading-relaxed text-slate-700">
                                            {advisor.summary}
                                        </p>
                                    </div>

                                    <div className="grid gap-4 lg:grid-cols-2">
                                        <div className="space-y-3">
                                            {advisor.actions.map((action) => (
                                                <div key={`${action.title}-${action.detail}`} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                                                    <p className="font-semibold text-slate-900">{action.title}</p>
                                                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{action.detail}</p>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
                                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                                                Watchouts
                                            </p>
                                            <div className="mt-3 space-y-3">
                                                {advisor.watchouts.map((watchout) => (
                                                    <p key={watchout} className="rounded-xl bg-white/80 p-3 text-sm leading-relaxed text-slate-700">
                                                        {watchout}
                                                    </p>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                                    Advisor AI akan muncul setelah material dianalisis.
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.92fr)]">
                        <Card className="border-slate-200 shadow-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <TrendingUp className="h-5 w-5 text-sky-600" />
                                    Riwayat Penjualan Tetap Tersedia
                                </CardTitle>
                                <CardDescription>
                                    Grafik membantu membaca pola lebih cepat, tapi tabel ini tetap disediakan untuk audit angka.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-hidden rounded-2xl border">
                                    <div className={cn(isPreparingPdf ? "overflow-visible" : "max-h-[360px] overflow-y-auto")}>
                                        <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="sticky top-0 bg-slate-100 text-slate-600">
                                                <tr>
                                                    <th className="px-4 py-3 text-left font-semibold">Bulan</th>
                                                    <th className="px-4 py-3 text-right font-semibold">Total Qty Keluar</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {analytics.history.map((entry) => (
                                                    <tr key={entry.period} className="border-t bg-white">
                                                        <td className="px-4 py-3">{entry.label}</td>
                                                        <td className="px-4 py-3 text-right font-semibold text-slate-900">
                                                            {numberFormatter.format(entry.qty)} qty
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-slate-200 shadow-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Gauge className="h-5 w-5 text-indigo-600" />
                                    Demand & Forecast Summary
                                </CardTitle>
                                <CardDescription>
                                    Angka ringkas untuk membantu review cepat saat meeting procurement atau warehouse.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="rounded-2xl border bg-slate-50 p-4">
                                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                            Avg Monthly Demand
                                        </p>
                                        <p className="mt-1 text-xl font-bold text-slate-900">
                                            {formatQuantity(analytics.avgMonthlyDemand)}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl border bg-slate-50 p-4">
                                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                            Avg Daily Demand
                                        </p>
                                        <p className="mt-1 text-xl font-bold text-slate-900">
                                            {formatQuantity(analytics.avgDailyDemand)}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl border bg-slate-50 p-4">
                                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                            Base Calc Safety Stock
                                        </p>
                                        <p className="mt-1 text-xl font-bold text-slate-900">
                                            {formatQuantity(analytics.calculatedSafetyStock)}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl border bg-slate-50 p-4">
                                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                            AI Recommendation
                                        </p>
                                        <p className="mt-1 text-xl font-bold text-slate-900">
                                            {formatQuantity(analytics.aiRecommendedSafetyStock)}
                                        </p>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                        Snapshot
                                    </p>
                                    <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-600">
                                        <p>
                                            Forecast demand bulan depan sekitar{" "}
                                            <span className="font-semibold text-slate-900">
                                                {numberFormatter.format(analytics.forecast.nextMonthDemand)} qty
                                            </span>
                                            , sedangkan kebutuhan kuartal berikutnya diperkirakan{" "}
                                            <span className="font-semibold text-slate-900">
                                                {numberFormatter.format(analytics.forecast.nextQuarterDemand)} qty
                                            </span>.
                                        </p>
                                        <p>{analytics.forecast.confidenceNote}</p>
                                        <p>{analytics.forecast.seasonalityNote}</p>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
                                    <div className="flex items-start gap-3">
                                        <Boxes className="mt-0.5 h-5 w-5 text-indigo-600" />
                                        <div>
                                            <p className="font-semibold text-slate-900">
                                                Kenapa angka dynamic safety stock bisa lebih tinggi?
                                            </p>
                                            <p className="mt-2 text-sm leading-relaxed text-slate-600">
                                                Karena rekomendasi akhir sekarang juga mempertimbangkan variability demand
                                                dan deviasi lead time vendor. Jadi bukan hanya aman dari stockout,
                                                tapi juga lebih realistis terhadap risiko keterlambatan pasokan.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="border-slate-200 shadow-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <ReceiptText className="h-5 w-5 text-indigo-600" />
                                History Penjualan Product
                            </CardTitle>
                            <CardDescription>
                                Detail transaksi per tahun dari `Sales_revenue_sap` dengan customer, nomor PO,
                                tanggal PO, qty, dan revenue in doc curr.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {isLoadingSalesHistory ? (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Memuat detail history penjualan produk...
                                </div>
                            ) : salesHistoryGroups.length === 0 ? (
                                <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                                    Belum ada detail history penjualan untuk material ini di `Sales_revenue_sap`.
                                </div>
                            ) : (
                                <Accordion
                                    type="multiple"
                                    value={expandedSalesYears}
                                    onValueChange={setExpandedSalesYears}
                                    className="space-y-3"
                                >
                                    {salesHistoryGroups.map((group) => (
                                        <AccordionItem
                                            key={group.year}
                                            value={group.year}
                                            className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
                                        >
                                            <AccordionTrigger className="px-4 py-4 hover:no-underline">
                                                <div className="flex w-full flex-col gap-4 text-left lg:flex-row lg:items-start lg:justify-between">
                                                    <div>
                                                        <p className="text-lg font-bold text-slate-900">
                                                            Tahun {group.year}
                                                        </p>
                                                        <p className="mt-1 text-sm text-slate-500">
                                                            Total setahun: {getRevenueSummaryLabel(group)}
                                                        </p>
                                                    </div>
                                                    <div className="grid gap-3 sm:grid-cols-3">
                                                        <div className="rounded-xl border bg-slate-50 px-3 py-2">
                                                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                                                Total Qty
                                                            </p>
                                                            <p className="mt-1 font-semibold text-slate-900">
                                                                {formatQuantity(group.totalQty)}
                                                            </p>
                                                        </div>
                                                        <div className="rounded-xl border bg-slate-50 px-3 py-2">
                                                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                                                Customer
                                                            </p>
                                                            <p className="mt-1 font-semibold text-slate-900">
                                                                {group.totalCustomers} customer
                                                            </p>
                                                        </div>
                                                        <div className="rounded-xl border bg-slate-50 px-3 py-2">
                                                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                                                Total PO
                                                            </p>
                                                            <p className="mt-1 font-semibold text-slate-900">
                                                                {group.totalOrders} transaksi
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="px-4 pb-4">
                                                <div className="overflow-hidden rounded-2xl border">
                                                    <div className={cn(isPreparingPdf ? "overflow-visible" : "max-h-[360px] overflow-y-auto")}>
                                                        <table className="w-full text-sm">
                                                            <thead className="sticky top-0 bg-slate-100 text-slate-600">
                                                                <tr>
                                                                    <th className="px-4 py-3 text-left font-semibold">Customer</th>
                                                                    <th className="px-4 py-3 text-left font-semibold">No. PO</th>
                                                                    <th className="px-4 py-3 text-left font-semibold">Date PO</th>
                                                                    <th className="px-4 py-3 text-right font-semibold">Qty</th>
                                                                    <th className="px-4 py-3 text-right font-semibold">Revenue in Doc Curr</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {group.rows.map((row) => (
                                                                    <tr key={row.id} className="border-t bg-white">
                                                                        <td className="px-4 py-3">
                                                                            <div className="flex items-start gap-2">
                                                                                <Users className="mt-0.5 h-4 w-4 text-slate-400" />
                                                                                <div>
                                                                                    <p className="font-semibold text-slate-900">
                                                                                        {row.customerName || row.customerCode || "-"}
                                                                                    </p>
                                                                                    {row.customerCode && row.customerName && (
                                                                                        <p className="text-xs text-muted-foreground">
                                                                                            {row.customerCode}
                                                                                        </p>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-4 py-3 font-medium text-slate-700">
                                                                            {row.poNo || "-"}
                                                                        </td>
                                                                        <td className="px-4 py-3 text-slate-700">
                                                                            {formatDate(row.poDate)}
                                                                        </td>
                                                                        <td className="px-4 py-3 text-right font-semibold text-slate-900">
                                                                            {formatQuantity(row.qty)}
                                                                        </td>
                                                                        <td className="px-4 py-3 text-right font-semibold text-slate-900">
                                                                            {formatDocumentCurrency(row.revenueInDocCurr, row.currency)}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    )
}
