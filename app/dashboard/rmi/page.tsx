import { Suspense } from "react"
import { getRmiRecords, getQuarterlyExchangeRates, getExchangeRateDependencies, seedRmiDashboardDefaults, getSapTireProducts, getRmiWeights } from "@/app/actions/rmi-dashboard"
import { RmiDashboardClient } from "./_components/rmi-dashboard-client"
import { Loader2 } from "lucide-react"

export const metadata = {
    title: "RMI & Kurs Quarterly Dashboard - One Chitra",
}

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function RmiDashboardPage() {
    // Jalankan seeding data default jika tabel kosong
    await seedRmiDashboardDefaults()

    // Ambil data awal dari database
    const [rmiRes, rateRes, fxDep, tireRes, weightsRes] = await Promise.all([
        getRmiRecords(),
        getQuarterlyExchangeRates(),
        getExchangeRateDependencies(),
        getSapTireProducts(),
        getRmiWeights()
    ])

    const rmiRecordsData = rmiRes.success && rmiRes.data ? rmiRes.data : []
    const quarterlyRatesData = rateRes.success && rateRes.data ? rateRes.data : []
    const realtimeRate = fxDep.success && fxDep.rate ? fxDep.rate : 17981 // default ke nilai tengah real
    const sapTiresData = tireRes.success && tireRes.data ? tireRes.data : []
    const weightsData = weightsRes.success && weightsRes.data ? weightsRes.data : null

    return (
        <div className="flex-1 space-y-4 p-6 md:p-8 pt-6 min-h-screen bg-slate-50/40">
            <Suspense fallback={
                <div className="h-[600px] flex flex-col items-center justify-center bg-card rounded-xl shadow-sm border">
                    <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-2" />
                    <p className="text-sm text-muted-foreground italic font-medium">Memuat Dashboard RMI & Kurs Quarterly...</p>
                </div>
            }>
                <RmiDashboardClient 
                    initialRmiRecords={rmiRecordsData} 
                    initialQuarterlyRates={quarterlyRatesData}
                    realtimeRate={realtimeRate}
                    sapTires={sapTiresData}
                    initialWeights={weightsData}
                />
            </Suspense>
        </div>
    )
}
