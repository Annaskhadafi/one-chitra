"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MaterialCombobox } from "./material-combobox"
import { Label } from "@/components/ui/label"
import { Loader2, Sparkles, History, Box } from "lucide-react"
import { generateAIPrediction, getRecentPredictions } from "@/app/actions/inventory-ai"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function PredictiveReplenishment() {
    const [productCode, setProductCode] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [result, setResult] = useState<any>(null)
    const [history, setHistory] = useState<any[]>([])

    useEffect(() => {
        loadHistory()
    }, [])

    const loadHistory = async () => {
        const res = await getRecentPredictions()
        if (res.success && res.data) {
            setHistory(res.data.filter((d: any) => d.predictionType === 'REPLENISHMENT'))
        }
    }

    const handleGenerate = async () => {
        if (!productCode) {
            toast.error("Silakan masukkan Material Number")
            return
        }
        setIsLoading(true)
        setResult(null)
        try {
            const res = await generateAIPrediction(productCode, 'REPLENISHMENT')
            if (res.success) {
                setResult(res.data)
                if (res.cached) {
                    toast.success("Mengambil data prediksi dari cache (24 jam terakhir)")
                } else {
                    toast.success("Prediksi AI berhasil dibuat")
                }
                loadHistory()
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
                <Card className="h-full">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-muted-foreground">
                            <History className="w-5 h-5" />
                            Riwayat Analisis AI
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {history.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-8">
                                    Belum ada data riwayat prediksi.
                                </p>
                            ) : (
                                history.map((item) => (
                                    <div key={item.id} className="p-3 rounded-lg border bg-card text-card-foreground shadow-sm space-y-2 text-sm">
                                        <div className="flex justify-between items-center font-medium">
                                            <span className="flex items-center gap-1.5"><Box className="w-4 h-4" /> {item.productCode}</span>
                                            <span className="text-primary">{item.recommendedStock} Pcs</span>
                                        </div>
                                        {item.productName && <p className="text-muted-foreground text-xs">{item.productName}</p>}
                                        <p className="pt-1">{item.rationale}</p>
                                        <div className="text-[10px] text-muted-foreground pt-2 text-right">
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
    )
}
