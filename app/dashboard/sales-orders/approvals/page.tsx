import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getShippingApprovals } from "@/app/actions/sales-order-shipping-approval"
import { ApprovalManagement } from "./_components/approval-management"

interface ApprovalsPageProps {
    searchParams: Promise<{
        batch?: string
    }>
}

export default async function SalesOrdersApprovalsPage({ searchParams }: ApprovalsPageProps) {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
        redirect("/auth/sign-in?callbackUrl=/dashboard/sales-orders/approvals")
    }

    const resolvedParams = await searchParams
    const batchId = resolvedParams.batch

    const result = await getShippingApprovals({ batchId })

    return (
        <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
            <ApprovalManagement
                batches={result.batches || []}
                orders={result.orders || []}
                currentUser={{
                    id: session.user.id,
                    name: session.user.name || null,
                    email: session.user.email || null,
                    role: (session.user as any).role || null,
                }}
                selectedBatchId={batchId}
            />
        </div>
    )
}
