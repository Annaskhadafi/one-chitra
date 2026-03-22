import { getAuthenticatedSession } from "@/lib/rbac"
import { getMLFilters } from "@/app/actions/revenue-ml"
import { MLRevenueClient } from "./_components/ml-revenue-client"
import { Card, CardContent } from "@/components/ui/card"

export const metadata = {
    title: "ML Revenue Forecast | One Chitra",
    description: "Advanced Machine Learning Revenue Forecasting System",
}

export default async function MLRevenuePage() {
    await getAuthenticatedSession("revenue-forecast", "view")
    const filterRes = await getMLFilters()

    return (
        <div className="flex flex-col gap-6 p-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-black tracking-tight text-primary">
                    Machine Learning <span className="text-foreground">Revenue Forecast</span>
                </h1>
                <p className="text-muted-foreground text-sm font-medium">
                    Analisis prediktif pendapatan menggunakan dekomposisi statistik (Tren & Musiman) dengan tingkat akurasi terukur.
                </p>
            </div>

            <MLRevenueClient
                initialFilters={{
                    categories: filterRes.success ? filterRes.categories || [] : [],
                    customers: filterRes.success ? filterRes.customers || [] : []
                }}
            />
        </div>
    )
}
