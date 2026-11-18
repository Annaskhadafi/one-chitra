import { Settings2 } from "lucide-react"
import { getQuotationApprovalTiers, getSalesApproverMatrix, getStandardMarginBaseline } from "@/app/actions/approval-engine"
import { db } from "@/db"
import { user } from "@/db/schema/auth"
import { ApprovalEngineClient } from "./_components/approval-engine-client"
import { asc } from "drizzle-orm"

export const metadata = {
    title: "Quotation Approval Engine – One Chitra",
}

export default async function ApprovalEnginePage() {
    const [tiersRes, matrixRes, allUsers, standardMargin] = await Promise.all([
        getQuotationApprovalTiers(),
        getSalesApproverMatrix(),
        db.select({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
        }).from(user).orderBy(asc(user.name)),
        getStandardMarginBaseline(),
    ])

    const tiers = tiersRes.success && tiersRes.data ? tiersRes.data : []
    const matrixRows = matrixRes.success && matrixRes.data ? matrixRes.data : []

    return (
        <div className="space-y-6 p-6">
            <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
                    <Settings2 className="h-6 w-6" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Quotation Approval Engine</h1>
                    <p className="text-sm text-muted-foreground">
                        Kelola batas limit margin (Prime Tyre vs PAS) dan pemetaan rantai persetujuan berjenjang per Sales Person.
                    </p>
                </div>
            </div>

            <ApprovalEngineClient
                initialTiers={tiers as any}
                initialMatrixRows={matrixRows as any}
                allUsers={allUsers}
                initialStandardMargin={standardMargin}
            />
        </div>
    )
}
