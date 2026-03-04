"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { BillingTable } from "./_components/billing-table"
import type { BillingRecordDisplay } from "@/lib/types"

const queryClient = new QueryClient()

interface BillingClientProps {
    data: BillingRecordDisplay[]
}

export function BillingClient({ data }: BillingClientProps) {
    return (
        <QueryClientProvider client={queryClient}>
            <BillingTable data={data} />
        </QueryClientProvider>
    )
}
