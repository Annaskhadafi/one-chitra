"use client"

import { useState, useEffect } from "react"
import { useSession } from "@/lib/auth-client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Trash2, UserSearch, Target, Loader2, Sparkles, BrainCircuit, History, Box, ShieldCheck, ShieldAlert, Search, LayoutDashboard, Settings, ChevronLeft, ChevronRight, Eye, X } from "lucide-react"
import { generateMLPrediction, getRecentPredictions, deleteMLPrediction, generateMLCustomerRecommendation, getMLSettings } from "@/app/actions/inventory-ml"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DashboardTab } from "./dashboard-tab"
import { useMaterialSearch, useCustomerSearch } from "../_hooks/use-sap-data"
import { MLSettingsClient } from "../settings/_components/ml-settings-client"
import { MLReportViewer } from "./ml-report-viewer"

function CustomerSearch({ value, onChange }: { value: string; onChange: (val: string, name?: string) => void }) {
    const [search, setSearch] = useState("")
    const [showResults, setShowResults] = useState(false)

    // Use React Query hook with 1-hour cache (Requirements: 10.3)
    const { data: searchResult, isLoading: isSearching } = useCustomerSearch(search)
    const results = searchResult?.data || []

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
                        results.map((cust: any) => (
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

function ReplenishmentTab() {
    const [productCode, setProductCode] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [result, setResult] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)
    const [history, setHistory] = useState<any[]>([])
    const [currentPage, setCurrentPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [totalCount, setTotalCount] = useState(0)
    const [selectedDetail, setSelectedDetail] = useState<any | null>(null)
    const pageSize = 20

    useEffect(() => { loadHistory() }, [currentPage])

    const loadHistory = async () => {
        const res = await getRecentPredictions({ page: currentPage, pageSize })
        if (res.success && res.data) {
            setHistory(res.data.filter((d: any) => d.predictionType === 'REPLENISHMENT'))
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
        } catch (err: any) {
            setError(err.message)
            toast.error(err.message || "Terjadi kesalahan")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="grid gap-6 md:grid-cols-2">
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
                                                <span className="flex items-center gap-1.5 font-bold"><Box className="w-4 h-4" /> {item.productCode}</span>
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
                <DialogContent className="max-w-[90vw] w-full max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg">
                            <Box className="w-5 h-5 text-primary" />
                            Detail Analisis: {selectedDetail?.productCode}
                            <span className="ml-auto text-sm font-normal text-muted-foreground mr-4">
                                {selectedDetail && new Date(selectedDetail.createdAt).toLocaleString('id-ID')}
                            </span>
                        </DialogTitle>
                    </DialogHeader>
                    {selectedDetail && (
                        <div className="mt-2 text-left">
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
    const [result, setResult] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)
    const [history, setHistory] = useState<any[]>([])
    const [currentPage, setCurrentPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [totalCount, setTotalCount] = useState(0)
    const [selectedDetail, setSelectedDetail] = useState<any | null>(null)
    const pageSize = 20

    useEffect(() => { loadHistory() }, [currentPage])

    const loadHistory = async () => {
        const res = await getRecentPredictions({ page: currentPage, pageSize })
        if (res.success && res.data) {
            setHistory(res.data.filter((d: any) => d.predictionType === 'SAFETY_STOCK'))
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
        } catch (err: any) {
            setError(err.message)
            toast.error(err.message || "Terjadi kesalahan")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="grid gap-6 md:grid-cols-2">
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
                                                <span className="font-bold">{item.productCode}</span>
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
                <DialogContent className="max-w-[90vw] w-full max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg">
                            <ShieldCheck className="w-5 h-5 text-indigo-500" />
                            Detail Safety Stock: {selectedDetail?.productCode}
                            <span className="ml-auto text-sm font-normal text-muted-foreground mr-4">
                                {selectedDetail && new Date(selectedDetail.createdAt).toLocaleString('id-ID')}
                            </span>
                        </DialogTitle>
                    </DialogHeader>
                    {selectedDetail && (
                        <div className="mt-2 text-left">
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
    const [result, setResult] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)
    const [history, setHistory] = useState<any[]>([])
    const [currentPage, setCurrentPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [totalCount, setTotalCount] = useState(0)
    const [selectedCustomerDetail, setSelectedCustomerDetail] = useState<any | null>(null)
    const pageSize = 20

    useEffect(() => { loadHistory() }, [currentPage])

    const loadHistory = async () => {
        const res = await getRecentPredictions({ page: currentPage, pageSize })
        if (res.success && res.data) {
            setHistory(res.data.filter((d: any) => d.predictionType === 'CUSTOMER_RECOMMENDATION'))
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
        } catch (err: any) {
            setError(err.message)
            toast.error(err.message || "Terjadi kesalahan")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="grid gap-6 md:grid-cols-2">
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
                <DialogContent className="max-w-[90vw] w-full max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg">
                            <Target className="w-5 h-5 text-rose-500" />
                            Detail Rekomendasi: {selectedCustomerDetail?.productName || selectedCustomerDetail?.productCode}
                            <span className="ml-auto text-sm font-normal text-muted-foreground mr-4">
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
    const [mlSettings, setMLSettings] = useState<any>(null)
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
    }, [activeTab, hasSettingsAccess])

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
            <TabsList>
                <TabsTrigger value="dashboard">
                    <LayoutDashboard className="h-4 w-4 mr-2" />
                    Dashboard
                </TabsTrigger>
                <TabsTrigger value="replenishment">Predictive Replenishment</TabsTrigger>
                <TabsTrigger value="safetystock">Dynamic Safety Stock</TabsTrigger>
                <TabsTrigger value="recommendation">Customer Recommendation</TabsTrigger>
                {hasSettingsAccess && (
                    <TabsTrigger value="settings">
                        <Settings className="h-4 w-4 mr-2" />
                        Settings
                    </TabsTrigger>
                )}
            </TabsList>
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
