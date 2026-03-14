"use client"

import { useState, useEffect } from "react"
import { useSession } from "@/lib/auth-client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Trash2, UserSearch, Target, Loader2, Sparkles, BrainCircuit, History, Box, ShieldCheck, ShieldAlert, Search, LayoutDashboard, Settings, ChevronLeft, ChevronRight, Eye, LineChart } from "lucide-react"
import { generateMLPrediction, getRecentPredictions, deleteMLPrediction, generateMLCustomerRecommendation, getMLSettings, getPredictionHistoricalInsights } from "@/app/actions/inventory-ml"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DashboardTab } from "./dashboard-tab"
import { useMaterialSearch, useCustomerSearch } from "../_hooks/use-sap-data"
import { MLSettingsClient } from "../settings/_components/ml-settings-client"
import { MLReportViewer } from "./ml-report-viewer"

type RecentPredictionsResult = Awaited<ReturnType<typeof getRecentPredictions>>
type PredictionHistoryItem = NonNullable<Extract<RecentPredictionsResult, { success: true }>["data"]>[number]
type PredictionHistoricalInsights = NonNullable<Extract<Awaited<ReturnType<typeof getPredictionHistoricalInsights>>, { success: true }>["data"]>
type HistoricalTopProduct = PredictionHistoricalInsights["topProducts"][number]
type MLSettingsData = Awaited<ReturnType<typeof getMLSettings>>

interface CustomerSearchItem {
    customerCode: string
    customerName: string
}

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : "Terjadi kesalahan"
const detailDialogContentClassName = "max-h-[94vh] overflow-y-auto p-4 sm:p-6 lg:p-8"
const detailDialogStyle = {
    width: "min(98vw, 1800px)",
    maxWidth: "min(98vw, 1800px)",
}

function CustomerSearch({ value, onChange }: { value: string; onChange: (val: string, name?: string) => void }) {
    const [search, setSearch] = useState("")
    const [showResults, setShowResults] = useState(false)

    // Use React Query hook with 1-hour cache (Requirements: 10.3)
    const { data: searchResult, isLoading: isSearching } = useCustomerSearch(search)
    const results = (searchResult?.data || []) as CustomerSearchItem[]

    return (
        <div className="relative">
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <UserSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Cari nama atau kode customer..."
                        value={search || value}
                        onChange={(e) => {
                            setSearch(e.target.value)
                            setShowResults(true)
                            if (!e.target.value) onChange("")
                        }}
                        onFocus={() => setShowResults(true)}
                        className="pl-9"
                    />
                </div>
            </div>
            {showResults && (search.length >= 2) && (
                <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {isSearching ? (
                        <div className="p-3 text-sm text-muted-foreground flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" /> Mencari...
                        </div>
                    ) : results.length === 0 ? (
                        <div className="p-3 text-sm text-muted-foreground">Tidak ditemukan.</div>
                    ) : (
                        results.map((cust) => (
                            <button
                                key={cust.customerCode}
                                type="button"
                                className="w-full text-left px-3 py-2 hover:bg-accent transition-colors text-sm border-b last:border-b-0"
                                onClick={() => {
                                    onChange(cust.customerCode, cust.customerName)
                                    setSearch(cust.customerName)
                                    setShowResults(false)
                                }}
                            >
                                <div className="font-medium">{cust.customerName}</div>
                                <div className="text-xs text-muted-foreground">{cust.customerCode}</div>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    )
}

function MaterialSearch({ value, onChange }: { value: string; onChange: (val: string) => void }) {
    const [search, setSearch] = useState("")
    const [showResults, setShowResults] = useState(false)

    // Use React Query hook with 1-hour cache (Requirements: 10.3)
    const { data: searchResult, isLoading: isSearching } = useMaterialSearch(search)
    const results = searchResult?.data || []

    return (
        <div className="relative">
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Cari material number atau nama barang..."
                        value={search || value}
                        onChange={(e) => {
                            setSearch(e.target.value)
                            setShowResults(true)
                            if (!e.target.value) onChange("")
                        }}
                        onFocus={() => setShowResults(true)}
                        className="pl-9"
                    />
                </div>
            </div>
            {showResults && (search.length >= 2) && (
                <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {isSearching ? (
                        <div className="p-3 text-sm text-muted-foreground flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" /> Mencari...
                        </div>
                    ) : results.length === 0 ? (
                        <div className="p-3 text-sm text-muted-foreground">Tidak ditemukan.</div>
                    ) : (
                        results.map((mat) => (
                            <button
                                key={mat.materialNo}
                                type="button"
                                className="w-full text-left px-3 py-2 hover:bg-accent transition-colors text-sm border-b last:border-b-0"
                                onClick={() => {
                                    onChange(mat.materialNo || "")
                                    setSearch(mat.materialNo || "")
                                    setShowResults(false)
                                }}
                            >
                                <div className="font-medium">{mat.materialNo}</div>
                                <div className="text-xs text-muted-foreground">{mat.materialDesc}</div>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    )
}


function HistoricalInsightsPanel({ predictionType }: { predictionType: "REPLENISHMENT" | "SAFETY_STOCK" | "CUSTOMER_RECOMMENDATION" }) {
    const [insights, setInsights] = useState<PredictionHistoricalInsights | null>(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        const loadInsights = async () => {
            setLoading(true)
            const res = await getPredictionHistoricalInsights({ predictionType, days: 90 })
            if (res.success && res.data) {
                setInsights(res.data)
            } else {
                setInsights(null)
            }
            setLoading(false)
        }

        loadInsights()
    }, [predictionType])

    return (
        <Card className="md:col-span-2 border-primary/20 bg-primary/5">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <LineChart className="h-4 w-4 text-primary" />
                    Historical Insights
                </CardTitle>
                <CardDescription>Ringkasan pola dari history prediksi 90 hari terakhir.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {loading ? (
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Memuat insight historis...
                    </div>
                ) : !insights ? (
                    <p className="text-sm text-muted-foreground">Belum ada insight historis untuk filter ini.</p>
                ) : (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="rounded-lg border bg-background/80 p-3">
                                <p className="text-[10px] uppercase font-bold text-muted-foreground">Total Prediksi</p>
                                <p className="text-xl font-bold">{insights.totalPredictions}</p>
                            </div>
                            <div className="rounded-lg border bg-background/80 p-3">
                                <p className="text-[10px] uppercase font-bold text-muted-foreground">Avg. Akurasi</p>
                                <p className="text-xl font-bold">{insights.avgAccuracy}%</p>
                            </div>
                            <div className="rounded-lg border bg-background/80 p-3">
                                <p className="text-[10px] uppercase font-bold text-muted-foreground">Tren Rekomendasi</p>
                                <p className="text-xl font-bold">{insights.recommendationTrend}%</p>
                            </div>
                        </div>
                        <ul className="list-disc list-inside text-sm space-y-1">
                            {insights.insightBullets?.map((item: string, idx: number) => (
                                <li key={idx}>{item}</li>
                            ))}
                        </ul>
                        {insights.topProducts?.length > 0 && (
                            <div>
                                <p className="text-xs font-bold text-muted-foreground mb-2">Top Recurring Products</p>
                                <div className="space-y-1 text-sm">
                                    {insights.topProducts.slice(0, 3).map((item: HistoricalTopProduct) => (
                                        <div key={item.code} className="flex justify-between rounded border bg-background/80 px-3 py-1.5">
                                            <span className="truncate">{item.name}</span>
                                            <span className="font-semibold">{item.count}x</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    )
}

function ReplenishmentTab() {
    const [productCode, setProductCode] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [result, setResult] = useState<PredictionHistoryItem | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [history, setHistory] = useState<PredictionHistoryItem[]>([])
    const [currentPage, setCurrentPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [totalCount, setTotalCount] = useState(0)
    const [selectedDetail, setSelectedDetail] = useState<PredictionHistoryItem | null>(null)
    const pageSize = 20

    useEffect(() => { loadHistory() }, [currentPage])

    const loadHistory = async () => {
        const res = await getRecentPredictions({ predictionType: "REPLENISHMENT", page: currentPage, pageSize })
        if (res.success && res.data) {
            setHistory(res.data)
            setTotalPages(res.totalPages || 1)
            setTotalCount(res.totalCount || 0)
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm("Hapus history ini?")) return
        const res = await deleteMLPrediction(id)
        if (res.success) {
            toast.success("Riwayat dihapus")
            loadHistory()
        } else {
            toast.error(res.error || "Gagal menghapus")
        }
    }

    const handleGenerate = async () => {
        if (!productCode.trim()) {
            toast.error("Silakan masukkan Material Number")
            return
        }
        setIsLoading(true)
        setResult(null)
        setError(null)
        try {
            const res = await generateMLPrediction(productCode.trim(), 'REPLENISHMENT')
            if (res.success) {
                setResult(res.data)
                toast.success(res.cached ? "Dari cache (24 jam)" : "Prediksi ML berhasil!")
                loadHistory()
            } else {
                setError(res.error || "Gagal membuat prediksi")
                toast.error(res.error || "Gagal membuat prediksi")
            }
        } catch (err: unknown) {
            const message = getErrorMessage(err)
            setError(message)
            toast.error(message)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="grid gap-6 md:grid-cols-2">
            <HistoricalInsightsPanel predictionType="REPLENISHMENT" />
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-primary" />
                        Generate Prediksi Restock
                    </CardTitle>
                    <CardDescription>
                        Masukkan Material Number dari SAP untuk mendapatkan saran restock dari ML.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Material Number</Label>
                        <MaterialSearch value={productCode} onChange={setProductCode} />
                    </div>
                    <Button onClick={handleGenerate} disabled={isLoading} className="w-full">
                        {isLoading ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> ML Sedang Menganalisa...</>
                        ) : "Mulai Analisis ML"}
                    </Button>

                    {error && (
                        <Alert variant="destructive">
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription className="text-xs break-all">{error}</AlertDescription>
                        </Alert>
                    )}

                    {result && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 pt-4">
                            <MLReportViewer rationale={result.rationale} />
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-muted-foreground">
                        <History className="w-5 h-5" /> Riwayat Analisis
                    </CardTitle>
                    <CardDescription>
                        {totalCount > 0 && `Menampilkan ${history.length} dari ${totalCount} riwayat`}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                        {history.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">Belum ada riwayat.</p>
                        ) : history.map((item) => (
                            <div key={item.id} className="p-3 rounded-lg border bg-card shadow-sm space-y-1 text-sm group relative">
                                {/* Action buttons */}
                                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-primary hover:bg-primary/10"
                                        title="Lihat Detail"
                                        onClick={() => setSelectedDetail(item)}
                                    >
                                        <Eye className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                        title="Hapus"
                                        onClick={() => handleDelete(item.id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                                <Accordion type="single" collapsible className="w-full">
                                    <AccordionItem value="report" className="border-none">
                                        <AccordionTrigger className="py-2 hover:no-underline">
                                            <div className="flex justify-between items-center font-medium w-full pr-4">
                                                <div className="min-w-0 text-left">
                                                    <span className="flex items-center gap-1.5 font-bold">
                                                        <Box className="w-4 h-4 shrink-0" />
                                                        <span className="truncate">{item.productCode}</span>
                                                    </span>
                                                    <p className="pl-5 text-xs font-normal text-muted-foreground truncate">
                                                        {item.productName || "Nama produk tidak tersedia"}
                                                    </p>
                                                </div>
                                                <span className="text-primary font-bold">{item.recommendedStock} Pcs</span>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent>
                                            <div className="border-t pt-4 mt-2">
                                                <MLReportViewer rationale={item.rationale} />
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                </Accordion>
                                <div className="text-[10px] text-muted-foreground text-right">
                                    {new Date(item.createdAt).toLocaleString('id-ID')}
                                </div>
                            </div>
                        ))}
                    </div>
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-4 pt-4 border-t">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                            >
                                <ChevronLeft className="h-4 w-4 mr-1" />
                                Previous
                            </Button>
                            <span className="text-sm text-muted-foreground">
                                Page {currentPage} of {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                            >
                                Next
                                <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Detail Popup Full-Width */}
            <Dialog open={!!selectedDetail} onOpenChange={(open) => !open && setSelectedDetail(null)}>
                <DialogContent className={detailDialogContentClassName} style={detailDialogStyle}>
                    <DialogHeader>
                        <DialogTitle className="flex flex-col gap-2 pr-8 text-left leading-snug lg:flex-row lg:items-start lg:justify-between">
                            <span className="flex min-w-0 items-start gap-2">
                                <Box className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                                <span className="min-w-0 break-words">Detail Analisis: {selectedDetail?.productName || selectedDetail?.productCode}</span>
                            </span>
                            <span className="text-sm font-normal text-muted-foreground">
                                {selectedDetail && new Date(selectedDetail.createdAt).toLocaleString('id-ID')}
                            </span>
                        </DialogTitle>
                    </DialogHeader>
                    {selectedDetail && (
                        <div className="mt-2 text-left">
                            <div className="text-sm text-muted-foreground mb-4 px-1">Material Number: {selectedDetail.productCode}</div>
                            <div className="flex items-center justify-between mb-4 p-3 rounded-lg bg-muted/50 border">
                                <span className="text-sm font-medium text-muted-foreground">Stok Rekomendasi ML</span>
                                <span className="text-2xl font-bold text-primary">{selectedDetail.recommendedStock} Pcs</span>
                            </div>
                            <MLReportViewer rationale={selectedDetail.rationale} />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}

function SafetyStockTab() {
    const [productCode, setProductCode] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [result, setResult] = useState<PredictionHistoryItem | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [history, setHistory] = useState<PredictionHistoryItem[]>([])
    const [currentPage, setCurrentPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [totalCount, setTotalCount] = useState(0)
    const [selectedDetail, setSelectedDetail] = useState<PredictionHistoryItem | null>(null)
    const pageSize = 20

    useEffect(() => { loadHistory() }, [currentPage])

    const loadHistory = async () => {
        const res = await getRecentPredictions({ predictionType: "SAFETY_STOCK", page: currentPage, pageSize })
        if (res.success && res.data) {
            setHistory(res.data)
            setTotalPages(res.totalPages || 1)
            setTotalCount(res.totalCount || 0)
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm("Hapus history ini?")) return
        const res = await deleteMLPrediction(id)
        if (res.success) {
            toast.success("Riwayat dihapus")
            loadHistory()
        } else {
            toast.error(res.error || "Gagal menghapus")
        }
    }

    const handleGenerate = async () => {
        if (!productCode.trim()) {
            toast.error("Silakan masukkan Material Number")
            return
        }
        setIsLoading(true)
        setResult(null)
        setError(null)
        try {
            const res = await generateMLPrediction(productCode.trim(), 'SAFETY_STOCK')
            if (res.success) {
                setResult(res.data)
                toast.success(res.cached ? "Dari cache (24 jam)" : "Safety Stock berhasil dihitung!")
                loadHistory()
            } else {
                setError(res.error || "Gagal membuat perhitungan")
                toast.error(res.error || "Gagal membuat perhitungan")
            }
        } catch (err: unknown) {
            const message = getErrorMessage(err)
            setError(message)
            toast.error(message)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="grid gap-6 md:grid-cols-2">
            <HistoricalInsightsPanel predictionType="SAFETY_STOCK" />
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BrainCircuit className="w-5 h-5 text-indigo-500" />
                        Hitung Safety Stock Pintar
                    </CardTitle>
                    <CardDescription>
                        Gunakan ML untuk menentukan buffer inventory optimal.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Material Number</Label>
                        <MaterialSearch value={productCode} onChange={setProductCode} />
                    </div>
                    <Button onClick={handleGenerate} disabled={isLoading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                        {isLoading ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> ML Computing...</>
                        ) : "Kalkulasi Safety Stock"}
                    </Button>

                    {error && (
                        <Alert variant="destructive">
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription className="text-xs break-all">{error}</AlertDescription>
                        </Alert>
                    )}

                    {result && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 pt-4">
                            <MLReportViewer rationale={result.rationale} />
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-muted-foreground">
                        <ShieldAlert className="w-5 h-5" /> History Perhitungan
                    </CardTitle>
                    <CardDescription>
                        {totalCount > 0 && `Menampilkan ${history.length} dari ${totalCount} riwayat`}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                        {history.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">Belum ada history.</p>
                        ) : history.map((item) => (
                            <div key={item.id} className="p-3 rounded-lg border bg-card shadow-sm space-y-1 text-sm group relative">
                                {/* Action buttons */}
                                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-indigo-500 hover:bg-indigo-500/10"
                                        title="Lihat Detail"
                                        onClick={() => setSelectedDetail(item)}
                                    >
                                        <Eye className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                        title="Hapus"
                                        onClick={() => handleDelete(item.id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                                <Accordion type="single" collapsible className="w-full">
                                    <AccordionItem value="report" className="border-none">
                                        <AccordionTrigger className="py-2 hover:no-underline">
                                            <div className="flex justify-between items-center font-medium w-full pr-4">
                                                <div className="min-w-0 text-left">
                                                    <span className="font-bold truncate block">{item.productCode}</span>
                                                    <p className="text-xs font-normal text-muted-foreground truncate">
                                                        {item.productName || "Nama produk tidak tersedia"}
                                                    </p>
                                                </div>
                                                <span className="bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 px-2 py-0.5 rounded text-xs font-bold">
                                                    {item.recommendedStock} Pcs
                                                </span>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent>
                                            <div className="border-t pt-4 mt-2">
                                                <MLReportViewer rationale={item.rationale} />
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                </Accordion>
                                <div className="text-[10px] text-muted-foreground text-right">
                                    {new Date(item.createdAt).toLocaleString('id-ID')}
                                </div>
                            </div>
                        ))}
                    </div>
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-4 pt-4 border-t">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                            >
                                <ChevronLeft className="h-4 w-4 mr-1" />
                                Previous
                            </Button>
                            <span className="text-sm text-muted-foreground">
                                Page {currentPage} of {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                            >
                                Next
                                <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Detail Popup Full-Width */}
            <Dialog open={!!selectedDetail} onOpenChange={(open) => !open && setSelectedDetail(null)}>
                <DialogContent className={detailDialogContentClassName} style={detailDialogStyle}>
                    <DialogHeader>
                        <DialogTitle className="flex flex-col gap-2 pr-8 text-left leading-snug lg:flex-row lg:items-start lg:justify-between">
                            <span className="flex min-w-0 items-start gap-2">
                                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500" />
                                <span className="min-w-0 break-words">Detail Safety Stock: {selectedDetail?.productName || selectedDetail?.productCode}</span>
                            </span>
                            <span className="text-sm font-normal text-muted-foreground">
                                {selectedDetail && new Date(selectedDetail.createdAt).toLocaleString('id-ID')}
                            </span>
                        </DialogTitle>
                    </DialogHeader>
                    {selectedDetail && (
                        <div className="mt-2 text-left">
                            <div className="text-sm text-muted-foreground mb-4 px-1">Material Number: {selectedDetail.productCode}</div>
                            <div className="flex items-center justify-between mb-4 p-3 rounded-lg bg-indigo-50 border border-indigo-100 dark:bg-indigo-950/20 dark:border-indigo-900/30">
                                <span className="text-sm font-medium text-indigo-900 dark:text-indigo-200">Safety Stock Optimal</span>
                                <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{selectedDetail.recommendedStock} Pcs</span>
                            </div>
                            <MLReportViewer rationale={selectedDetail.rationale} />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}

function CustomerRecommendationTab() {
    const [customerCode, setCustomerCode] = useState("")
    const [customerName, setCustomerName] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [result, setResult] = useState<PredictionHistoryItem | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [history, setHistory] = useState<PredictionHistoryItem[]>([])
    const [currentPage, setCurrentPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [totalCount, setTotalCount] = useState(0)
    const [selectedCustomerDetail, setSelectedCustomerDetail] = useState<PredictionHistoryItem | null>(null)
    const pageSize = 20

    useEffect(() => { loadHistory() }, [currentPage])

    const loadHistory = async () => {
        const res = await getRecentPredictions({ predictionType: "CUSTOMER_RECOMMENDATION", page: currentPage, pageSize })
        if (res.success && res.data) {
            setHistory(res.data)
            setTotalPages(res.totalPages || 1)
            setTotalCount(res.totalCount || 0)
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm("Hapus history ini?")) return
        const res = await deleteMLPrediction(id)
        if (res.success) {
            toast.success("Riwayat dihapus")
            loadHistory()
        } else {
            toast.error(res.error || "Gagal menghapus")
        }
    }

    const handleGenerate = async () => {
        if (!customerCode.trim()) {
            toast.error("Silakan pilih Customer")
            return
        }
        setIsLoading(true)
        setResult(null)
        setError(null)
        try {
            const res = await generateMLCustomerRecommendation(customerCode.trim())
            if (res.success) {
                setResult(res.data)
                toast.success(res.cached ? "Dari cache (24 jam)" : "Rekomendasi berhasil dibuat!")
                loadHistory()
            } else {
                setError(res.error || "Gagal membuat rekomendasi")
                toast.error(res.error || "Gagal membuat rekomendasi")
            }
        } catch (err: unknown) {
            const message = getErrorMessage(err)
            setError(message)
            toast.error(message)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="grid gap-6 md:grid-cols-2">
            <HistoricalInsightsPanel predictionType="CUSTOMER_RECOMMENDATION" />
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Target className="w-5 h-5 text-rose-500" />
                        ML Customer Recommendation
                    </CardTitle>
                    <CardDescription>
                        Analisis data fleet dan history penjualan untuk merekomendasikan produk ke customer.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Pilih Customer</Label>
                        <CustomerSearch value={customerName} onChange={(code, name) => {
                            setCustomerCode(code)
                            setCustomerName(name || "")
                        }} />
                    </div>
                    <Button onClick={handleGenerate} disabled={isLoading} className="w-full bg-rose-600 hover:bg-rose-700 text-white">
                        {isLoading ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Menganalisis Customer...</>
                        ) : "Generate Rekomendasi Penjualan"}
                    </Button>

                    {error && (
                        <Alert variant="destructive">
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription className="text-xs break-all">{error}</AlertDescription>
                        </Alert>
                    )}

                    {result && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 pt-4">
                            <MLReportViewer rationale={result.rationale} />
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-muted-foreground">
                        <History className="w-5 h-5" /> Riwayat Rekomendasi
                    </CardTitle>
                    <CardDescription>
                        {totalCount > 0 && `Menampilkan ${history.length} dari ${totalCount} riwayat`}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3 max-h-[500px] overflow-y-auto">
                        {history.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">Belum ada riwayat.</p>
                        ) : history.map((item) => (
                            <div key={item.id} className="p-3 rounded-lg border bg-card shadow-sm space-y-1 text-sm group relative">
                                {/* Action buttons */}
                                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-rose-500 hover:bg-rose-500/10"
                                        title="Lihat Detail"
                                        onClick={() => setSelectedCustomerDetail(item)}
                                    >
                                        <Eye className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                        title="Hapus"
                                        onClick={() => handleDelete(item.id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                                <Accordion type="single" collapsible className="w-full">
                                    <AccordionItem value="report" className="border-none">
                                        <AccordionTrigger className="py-2 hover:no-underline">
                                            <div className="flex justify-between items-center font-medium w-full pr-4 text-left">
                                                <span className="font-bold truncate">{item.productName || item.productCode}</span>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent>
                                            <div className="text-xs text-muted-foreground mb-2 px-1">Kode: {item.productCode}</div>
                                            <div className="border-t pt-4 mt-2">
                                                <MLReportViewer rationale={item.rationale} />
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                </Accordion>
                                <div className="text-[10px] text-muted-foreground text-right pt-2">
                                    {new Date(item.createdAt).toLocaleString('id-ID')}
                                </div>
                            </div>
                        ))}
                    </div>
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-4 pt-4 border-t">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                            >
                                <ChevronLeft className="h-4 w-4 mr-1" />
                                Previous
                            </Button>
                            <span className="text-sm text-muted-foreground">
                                Page {currentPage} of {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                            >
                                Next
                                <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Detail Popup Full-Width */}
            <Dialog open={!!selectedCustomerDetail} onOpenChange={(open) => !open && setSelectedCustomerDetail(null)}>
                <DialogContent className={detailDialogContentClassName} style={detailDialogStyle}>
                    <DialogHeader>
                        <DialogTitle className="flex flex-col gap-2 pr-8 text-left leading-snug lg:flex-row lg:items-start lg:justify-between">
                            <span className="flex min-w-0 items-start gap-2">
                                <Target className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
                                <span className="min-w-0 break-words">Detail Rekomendasi: {selectedCustomerDetail?.productName || selectedCustomerDetail?.productCode}</span>
                            </span>
                            <span className="text-sm font-normal text-muted-foreground">
                                {selectedCustomerDetail && new Date(selectedCustomerDetail.createdAt).toLocaleString('id-ID')}
                            </span>
                        </DialogTitle>
                    </DialogHeader>
                    {selectedCustomerDetail && (
                        <div className="mt-2 text-left">
                            <div className="text-sm text-muted-foreground mb-4 px-1">Kode Customer: {selectedCustomerDetail.productCode}</div>
                            <MLReportViewer rationale={selectedCustomerDetail.rationale} />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}

export function InventoryMLClient() {
    const [activeTab, setActiveTab] = useState("dashboard")
    const { data: session } = useSession()
    const [mlSettings, setMLSettings] = useState<MLSettingsData | null>(null)
    const [isLoadingSettings, setIsLoadingSettings] = useState(false)
    const [hasSettingsAccess, setHasSettingsAccess] = useState(false)

    // Check if user has admin or inventory_manager role (Requirement 9.2)
    // Use useEffect to avoid hydration mismatch
    useEffect(() => {
        if (session?.user?.role) {
            const userRole = session.user.role.toLowerCase()
            const hasAccess = userRole === "admin" ||
                userRole === "superuser" ||
                userRole === "inventory_manager" ||
                userRole === "inventory manager"
            setHasSettingsAccess(hasAccess)
        }
    }, [session])

    // Load ML settings when settings tab is accessed
    useEffect(() => {
        if (activeTab === "settings" && hasSettingsAccess && !mlSettings) {
            loadMLSettings()
        }
    }, [activeTab, hasSettingsAccess, mlSettings])

    const loadMLSettings = async () => {
        setIsLoadingSettings(true)
        try {
            const settings = await getMLSettings()
            setMLSettings(settings)
        } catch (error) {
            console.error("Failed to load ML settings:", error)
            toast.error("Failed to load ML settings")
        } finally {
            setIsLoadingSettings(false)
        }
    }

    return (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <div className="-mx-1 w-[calc(100%+0.5rem)] overflow-x-auto pb-2 pl-1 sm:mx-0 sm:w-full sm:pl-0 [scrollbar-width:thin]">
                <TabsList className="inline-flex h-auto min-w-max justify-start gap-1 whitespace-nowrap">
                    <TabsTrigger value="dashboard" className="shrink-0 whitespace-nowrap px-3 text-xs sm:text-sm">
                        <LayoutDashboard className="h-4 w-4 mr-1.5 sm:mr-2" />
                        Dashboard
                    </TabsTrigger>
                    <TabsTrigger value="replenishment" className="shrink-0 whitespace-nowrap px-3 text-xs sm:text-sm">Predictive Replenishment</TabsTrigger>
                    <TabsTrigger value="safetystock" className="shrink-0 whitespace-nowrap px-3 text-xs sm:text-sm">Dynamic Safety Stock</TabsTrigger>
                    <TabsTrigger value="recommendation" className="shrink-0 whitespace-nowrap px-3 text-xs sm:text-sm">Customer Recommendation</TabsTrigger>
                    {hasSettingsAccess && (
                        <TabsTrigger value="settings" className="shrink-0 whitespace-nowrap px-3 text-xs sm:text-sm">
                            <Settings className="h-4 w-4 mr-1.5 sm:mr-2" />
                            Settings
                        </TabsTrigger>
                    )}
                </TabsList>
            </div>
            <TabsContent value="dashboard">
                <DashboardTab onNavigate={setActiveTab} />
            </TabsContent>
            <TabsContent value="replenishment">
                <ReplenishmentTab />
            </TabsContent>
            <TabsContent value="safetystock">
                <SafetyStockTab />
            </TabsContent>
            <TabsContent value="recommendation">
                <CustomerRecommendationTab />
            </TabsContent>
            {hasSettingsAccess && (
                <TabsContent value="settings">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Settings className="h-5 w-5" />
                                ML Settings
                            </CardTitle>
                            <CardDescription>
                                Konfigurasi parameter ML untuk optimasi prediksi inventory
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isLoadingSettings ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                </div>
                            ) : mlSettings ? (
                                <MLSettingsClient
                                    initialSettings={mlSettings}
                                    userId={session?.user?.id || ""}
                                />
                            ) : (
                                <div className="text-center py-8 text-muted-foreground">
                                    Failed to load settings
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            )}
        </Tabs>
    )
}
