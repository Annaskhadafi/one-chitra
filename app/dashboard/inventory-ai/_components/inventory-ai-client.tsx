"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Trash2, UserSearch, Target, Truck, MapPin, Loader2, Sparkles, BrainCircuit, History, Box, ShieldCheck, ShieldAlert, Search } from "lucide-react"
import { generateAIPrediction, getRecentPredictions, searchMaterials, deleteAIPrediction, searchCustomers, generateCustomerRecommendation } from "@/app/actions/inventory-ai"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { cn } from "@/lib/utils"

function CustomerSearch({ value, onChange }: { value: string; onChange: (val: string, name?: string) => void }) {
    const [search, setSearch] = useState("")
    const [results, setResults] = useState<any[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [showResults, setShowResults] = useState(false)

    const doSearch = useCallback(async (q: string) => {
        if (q.length < 2) { setResults([]); return }
        setIsSearching(true)
        try {
            const res = await searchCustomers(q)
            if (res.success && res.data) setResults(res.data)
        } catch { /* ignore */ }
        setIsSearching(false)
    }, [])

    useEffect(() => {
        const timer = setTimeout(() => doSearch(search), 400)
        return () => clearTimeout(timer)
    }, [search, doSearch])

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
    const [results, setResults] = useState<any[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [showResults, setShowResults] = useState(false)

    const doSearch = useCallback(async (q: string) => {
        if (q.length < 2) { setResults([]); return }
        setIsSearching(true)
        try {
            const res = await searchMaterials(q)
            if (res.success && res.data) setResults(res.data)
        } catch { /* ignore */ }
        setIsSearching(false)
    }, [])

    useEffect(() => {
        const timer = setTimeout(() => doSearch(search), 400)
        return () => clearTimeout(timer)
    }, [search, doSearch])

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
                                    onChange(mat.materialNo)
                                    setSearch(mat.materialNo)
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

    useEffect(() => { loadHistory() }, [])

    const loadHistory = async () => {
        const res = await getRecentPredictions()
        if (res.success && res.data) {
            setHistory(res.data.filter((d: any) => d.predictionType === 'REPLENISHMENT'))
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm("Hapus history ini?")) return
        const res = await deleteAIPrediction(id)
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
            const res = await generateAIPrediction(productCode.trim(), 'REPLENISHMENT')
            if (res.success) {
                setResult(res.data)
                toast.success(res.cached ? "Dari cache (24 jam)" : "Prediksi AI berhasil!")
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
                        Masukkan Material Number dari SAP untuk mendapatkan saran restock dari AI.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Material Number</Label>
                        <MaterialSearch value={productCode} onChange={setProductCode} />
                    </div>
                    <Button onClick={handleGenerate} disabled={isLoading} className="w-full">
                        {isLoading ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> AI Sedang Menganalisa...</>
                        ) : "Mulai Analisis AI"}
                    </Button>

                    {error && (
                        <Alert variant="destructive">
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription className="text-xs break-all">{error}</AlertDescription>
                        </Alert>
                    )}

                    {result && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <Alert className="bg-primary/5 border-primary/20">
                                <Sparkles className="h-4 w-4 text-primary" />
                                <AlertTitle className="text-primary font-semibold">
                                    Rekomendasi Restock: {result.recommendedStock} Pcs
                                </AlertTitle>
                                <AlertDescription className="mt-2 text-sm leading-relaxed">
                                    {result.rationale}
                                </AlertDescription>
                            </Alert>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-muted-foreground">
                        <History className="w-5 h-5" /> Riwayat Analisis
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                        {history.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">Belum ada riwayat.</p>
                        ) : history.map((item) => (
                            <div key={item.id} className="p-3 rounded-lg border bg-card shadow-sm space-y-1 text-sm group relative">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                                    onClick={() => handleDelete(item.id)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                                <div className="flex justify-between items-center font-medium pr-8">
                                    <span className="flex items-center gap-1.5"><Box className="w-4 h-4" /> {item.productCode}</span>
                                    <span className="text-primary font-bold">{item.recommendedStock} Pcs</span>
                                </div>
                                {item.productName && <p className="text-muted-foreground text-xs">{item.productName}</p>}
                                <p className="text-xs">{item.rationale}</p>
                                <div className="text-[10px] text-muted-foreground text-right">
                                    {new Date(item.createdAt).toLocaleString('id-ID')}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

function SafetyStockTab() {
    const [productCode, setProductCode] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [result, setResult] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)
    const [history, setHistory] = useState<any[]>([])

    useEffect(() => { loadHistory() }, [])

    const loadHistory = async () => {
        const res = await getRecentPredictions()
        if (res.success && res.data) {
            setHistory(res.data.filter((d: any) => d.predictionType === 'SAFETY_STOCK'))
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm("Hapus history ini?")) return
        const res = await deleteAIPrediction(id)
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
            const res = await generateAIPrediction(productCode.trim(), 'SAFETY_STOCK')
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
                        Gunakan AI untuk menentukan buffer inventory optimal.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Material Number</Label>
                        <MaterialSearch value={productCode} onChange={setProductCode} />
                    </div>
                    <Button onClick={handleGenerate} disabled={isLoading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                        {isLoading ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> AI Computing...</>
                        ) : "Kalkulasi Safety Stock"}
                    </Button>

                    {error && (
                        <Alert variant="destructive">
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription className="text-xs break-all">{error}</AlertDescription>
                        </Alert>
                    )}

                    {result && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <Alert className="bg-indigo-50 border-indigo-200 dark:bg-indigo-950/30 dark:border-indigo-800">
                                <ShieldCheck className="h-4 w-4 text-indigo-600" />
                                <AlertTitle className="text-indigo-800 dark:text-indigo-300 font-semibold">
                                    Safety Stock Optimal: {result.recommendedStock} Pcs
                                </AlertTitle>
                                <AlertDescription className="mt-2 text-sm leading-relaxed">
                                    {result.rationale}
                                </AlertDescription>
                            </Alert>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-muted-foreground">
                        <ShieldAlert className="w-5 h-5" /> History Perhitungan
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                        {history.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">Belum ada history.</p>
                        ) : history.map((item) => (
                            <div key={item.id} className="p-3 rounded-lg border bg-card shadow-sm space-y-1 text-sm group relative">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                                    onClick={() => handleDelete(item.id)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                                <div className="flex justify-between items-center font-medium pr-8">
                                    <span>{item.productCode}</span>
                                    <span className="bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 px-2 py-0.5 rounded text-xs font-bold">
                                        {item.recommendedStock} Pcs
                                    </span>
                                </div>
                                {item.productName && <p className="text-muted-foreground text-xs">{item.productName}</p>}
                                <p className="text-xs">{item.rationale}</p>
                                <div className="text-[10px] text-muted-foreground text-right">
                                    {new Date(item.createdAt).toLocaleString('id-ID')}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
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

    useEffect(() => { loadHistory() }, [])

    const loadHistory = async () => {
        const res = await getRecentPredictions()
        if (res.success && res.data) {
            setHistory(res.data.filter((d: any) => d.predictionType === 'CUSTOMER_RECOMMENDATION'))
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm("Hapus history ini?")) return
        const res = await deleteAIPrediction(id)
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
            const res = await generateCustomerRecommendation(customerCode.trim())
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
                        AI Customer Recommendation
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
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <Alert className="bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:border-rose-800">
                                <Sparkles className="h-4 w-4 text-rose-600" />
                                <AlertTitle className="text-rose-800 dark:text-rose-300 font-semibold">
                                    Rekomendasi Strategis:
                                </AlertTitle>
                                <AlertDescription className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">
                                    {result.rationale}
                                </AlertDescription>
                            </Alert>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-muted-foreground">
                        <History className="w-5 h-5" /> Riwayat Rekomendasi
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3 max-h-[500px] overflow-y-auto">
                        {history.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">Belum ada riwayat.</p>
                        ) : history.map((item) => (
                            <div key={item.id} className="p-3 rounded-lg border bg-card shadow-sm space-y-1 text-sm group relative">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                                    onClick={() => handleDelete(item.id)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                                <div className="flex justify-between items-center font-medium pr-8">
                                    <span className="flex items-center gap-1.5 font-bold truncate">{item.productName || item.productCode}</span>
                                </div>
                                <div className="text-xs text-muted-foreground mb-2">Kode: {item.productCode}</div>
                                <p className="text-xs whitespace-pre-wrap line-clamp-6">{item.rationale}</p>
                                <div className="text-[10px] text-muted-foreground text-right pt-2">
                                    {new Date(item.createdAt).toLocaleString('id-ID')}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

export function InventoryAIClient() {
    return (
        <Tabs defaultValue="replenishment" className="space-y-4">
            <TabsList>
                <TabsTrigger value="replenishment">Predictive Replenishment</TabsTrigger>
                <TabsTrigger value="safetystock">Dynamic Safety Stock</TabsTrigger>
                <TabsTrigger value="recommendation">Customer Recommendation</TabsTrigger>
            </TabsList>
            <TabsContent value="replenishment">
                <ReplenishmentTab />
            </TabsContent>
            <TabsContent value="safetystock">
                <SafetyStockTab />
            </TabsContent>
            <TabsContent value="recommendation">
                <CustomerRecommendationTab />
            </TabsContent>
        </Tabs>
    )
}
