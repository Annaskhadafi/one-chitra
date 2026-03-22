"use client"

import { useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { BillingTable } from "./_components/billing-table"
import type { BillingRecordDisplay } from "@/lib/types"

interface BillingClientProps {
    data: BillingRecordDisplay[]
}

export function BillingClient({ data }: BillingClientProps) {
    const [queryClient] = useState(() => new QueryClient())

    return (
        <QueryClientProvider client={queryClient}>
            <BillingTable data={data} />
        </QueryClientProvider>
    )
}
