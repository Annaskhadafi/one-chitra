import { Suspense } from "react"
import { getQuotationAnalysis } from "@/app/actions/quotation-analysis"
import { QuotationAnalysisClient } from "./_components/quotation-analysis-client"

export const metadata = {
    title: "Quotation Analysis Report | One Chitra",
    description: "Analisa konversi kuotasi dan rekomendasi pemulihan peluang yang hilang",
}

export default async function QuotationAnalysisPage() {
    const analysisResponse = await getQuotationAnalysis()

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]">Memuat Laporan Analisis...</div>}>
                <QuotationAnalysisClient initialData={analysisResponse.success ? analysisResponse.data : null} />
            </Suspense>
        </div>
    )
}
