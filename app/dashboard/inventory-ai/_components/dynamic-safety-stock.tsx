"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MaterialCombobox } from "./material-combobox"
import { Label } from "@/components/ui/label"
import { Loader2, BrainCircuit, ShieldAlert, ShieldCheck } from "lucide-react"
import { generateAIPrediction, getRecentPredictions, getSalesHistory } from "@/app/actions/inventory-ai"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { PredictionChart } from "./prediction-chart"

export function DynamicSafetyStock() {
    const [productCode, setProductCode] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [result, setResult] = useState<any>(null)
    const [history, setHistory] = useState<any[]>([])
    const [salesHistory, setSalesHistory] = useState<any[]>([])
    const [isLoadingChart, setIsLoadingChart] = useState(false)

    useEffect(() => {
        loadHistory()
    }, [])

    const loadHistory = async () => {
        const res = await getRecentPredictions()
        if (res.success && res.data) {
            setHistory(res.data.filter((d: any) => d.predictionType === 'SAFETY_STOCK'))
        }
    }

    const handleGenerate = async () => {
        if (!productCode) {
            toast.error("Silakan masukkan Material Number")
            return
        }
        setIsLoading(true)
        setResult(null)
        setSalesHistory([])
        try {
            const res = await generateAIPrediction(productCode, 'SAFETY_STOCK')
            if (res.success) {
                setResult(res.data)
                if (res.cached) {
                    toast.success("Mengambil data prediksi dari cache (24 jam terakhir)")
                } else {
                    toast.success("Analisis Safety Stock berhasil dibuat")
                }
                loadHistory()
                
                // Load sales history for chart
                setIsLoadingChart(true)
                const historyRes = await getSalesHistory(productCode)
                if (historyRes.success && historyRes.data) {
                    setSalesHistory(historyRes.data)
                }
                setIsLoadingChart(false)
            } else {
                toast.error(res.error || "Gagal membuat perhitungan")
            }
        } catch (err: any) {
            toast.error(err.message || "Terjadi kesalahan")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <BrainCircuit className="w-5 h-5 text-indigo-500" />
                                Hitung Safety Stock Pintar
                            </CardTitle>
                            <CardDescription>
                                Gunakan model AI untuk menentukan buffer inventory yang tepat agar tidak overstock dan tidak stockout.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Material Number</Label>
                                <MaterialCombobox
                                    value={productCode}
                                    onChange={setProductCode}
                                />
                            </div>
                            <Button
                                onClick={handleGenerate}
                                disabled={isLoading}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        AI Computing...
                                    </>
                                ) : (
                                    "Kalkulasi Safety Stock"
                                )}
                            </Button>

                            {result && (
                                <div className="pt-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                    <Alert className="bg-indigo-50 border-indigo-200">
                                        <ShieldCheck className="h-4 w-4 text-indigo-600" />
                                        <AlertTitle className="text-indigo-800 font-semibold">
                                            Rekomendasi Safety Stock: {result.recommendedStock} Pcs
                                        </AlertTitle>
                                        <AlertDescription className="mt-2 text-sm leading-relaxed text-indigo-900/80">
                                            {result.rationale}
                                        </AlertDescription>
                                    </Alert>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card className="h-full">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-muted-foreground">
                                <ShieldAlert className="w-5 h-5" />
                                History Perhitungan
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {history.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-8">
                                        Belum ada data history perhitungan.
                                    </p>
                                ) : (
                                    history.map((item) => (
                                        <div key={item.id} className="p-3 rounded-lg border border-indigo-100 bg-white shadow-sm space-y-2 text-sm">
                                            <div className="flex justify-between items-center font-medium">
                                                <span className="text-slate-700">{item.productCode}</span>
                                                <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded text-xs font-bold">
                                                    {item.recommendedStock} Pcs
                                                </span>
                                            </div>
                                            {item.productName && <p className="text-muted-foreground text-xs">{item.productName}</p>}
                                            <p className="pt-1 text-slate-600">{item.rationale}</p>
                                            <div className="text-[10px] text-slate-400 pt-2 text-right">
                                                {new Date(item.createdAt).toLocaleString('id-ID')}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Sales Trend Chart */}
            {result && salesHistory.length > 0 && (
                <div className="animate-in fade-in slide-in-from-bottom-3 duration-700">
                    <PredictionChart
                        data={salesHistory}
                        productCode={result.productCode}
                        productName={result.productName}
                        currentStock={result.currentStock}
                        recommendedStock={result.recommendedStock}
                    />
                </div>
            )}

            {result && isLoadingChart && (
                <Card>
                    <CardContent className="flex items-center justify-center h-[400px]">
                        <div className="flex flex-col items-center gap-2">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">Loading sales history...</p>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
