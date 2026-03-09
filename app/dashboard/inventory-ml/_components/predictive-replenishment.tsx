"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MaterialCombobox } from "./material-combobox"
import { Label } from "@/components/ui/label"
import { Loader2, Sparkles, History } from "lucide-react"
import { generateAIPrediction, getSalesHistory } from "@/app/actions/inventory-ml"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { PredictionChart } from "./prediction-chart"
import { PredictionHistoryList } from "./prediction-history-list"

export function PredictiveReplenishment() {
    const [productCode, setProductCode] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [result, setResult] = useState<any>(null)
    const [salesHistory, setSalesHistory] = useState<any[]>([])
    const [isLoadingChart, setIsLoadingChart] = useState(false)
    const [refreshTrigger, setRefreshTrigger] = useState(0)

    const handleGenerate = async () => {
        if (!productCode) {
            toast.error("Silakan masukkan Material Number")
            return
        }
        setIsLoading(true)
        setResult(null)
        setSalesHistory([])
        try {
            const res = await generateAIPrediction(productCode, 'REPLENISHMENT')
            if (res.success) {
                setResult(res.data)
                if (res.cached) {
                    toast.success("Mengambil data prediksi dari cache (24 jam terakhir)")
                } else {
                    toast.success("Prediksi AI berhasil dibuat")
                }
                // Trigger history refresh
                setRefreshTrigger(prev => prev + 1)

                // Load sales history for chart
                setIsLoadingChart(true)
                const historyRes = await getSalesHistory(productCode)
                if (historyRes.success && historyRes.data) {
                    setSalesHistory(historyRes.data)
                }
                setIsLoadingChart(false)
            } else {
                toast.error(res.error || "Gagal membuat prediksi")
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
                                <Sparkles className="w-5 h-5 text-primary" />
                                Generate Prediksi Baru
                            </CardTitle>
                            <CardDescription>
                                Masukkan Material Number / Product Code dari SAP untuk mendapatkan saran restock dari AI.
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
                                className="w-full"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        AI Sedang Menganalisa...
                                    </>
                                ) : (
                                    "Mulai Analisis AI"
                                )}
                            </Button>

                            {result && (
                                <div className="pt-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
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
                </div>

                <div className="space-y-6">
                    <PredictionHistoryList
                        predictionType="REPLENISHMENT"
                        title="Riwayat Analisis AI"
                        icon={<History className="w-5 h-5" />}
                        onRefresh={refreshTrigger}
                    />
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
