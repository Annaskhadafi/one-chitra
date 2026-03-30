"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Plus, FileText } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { FloatingNavButton } from "@/components/floating-nav-button"
import { VendorQuotationSearchModal } from "@/components/vendor-quotation-search-modal"
import { QuotationTable } from "./quotation-table"

interface QuotationsPageClientProps {
    data: Parameters<typeof QuotationTable>[0]["data"]
}

export function QuotationsPageClient({ data }: QuotationsPageClientProps) {
    const [isVendorQuotationOpen, setIsVendorQuotationOpen] = useState(false)

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex-1">
                    <PageHeader
                        title="Quotations"
                        subtitle="Manage quotations and pricing proposals."
                        icon={FileText}
                    />
                </div>
                <Link href="/dashboard/quotations/create">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Create Quotation
                    </Button>
                </Link>
            </div>

            <div className="flex-1">
                <QuotationTable data={data} />
            </div>

            <FloatingNavButton 
                onClick={() => setIsVendorQuotationOpen(true)}
                label="Cari Harga Vendor"
                position="middle-right"
            />

            <VendorQuotationSearchModal
                open={isVendorQuotationOpen}
                onOpenChange={setIsVendorQuotationOpen}
            />
        </div>
    )
}
