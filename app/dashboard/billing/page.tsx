import { Suspense } from "react"
import { getBillingRecords } from "@/app/actions/billing"
import { BillingClient } from "./billing-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { BillingRecordDisplay } from "@/lib/types"
import { Loader2 } from "lucide-react"

export default async function BillingPage() {
    const result = await getBillingRecords()
    const data = result.success ? (result.data as BillingRecordDisplay[] || []) : []

    return (
        <div className="h-full flex-1 flex-col space-y-8 p-8 md:flex">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Billing Management</h2>
                    <p className="text-muted-foreground">
                        Monitor delivered items, invoices, and billing status.
                    </p>
                </div>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Billing Records</CardTitle>
                </CardHeader>
                <CardContent>
                    <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin" />}>
                        <BillingClient data={data} />
                    </Suspense>
                </CardContent>
            </Card>
        </div>
    )
}
