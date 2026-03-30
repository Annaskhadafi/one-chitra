import { Suspense } from "react"
import { getVendorQuotations } from "@/app/actions/vendor-quotation"
import { VendorQuotationsClient } from "./vendor-quotations-client"
import { PageHeader } from "@/components/page-header"
import { FileText, Loader2 } from "lucide-react"

export const metadata = {
    title: "Database Quotation Vendor | One Chitra",
    description: "Kelola dan ekstrak data quotation/penawaran harga dari vendor secara otomatis menggunakan AI OCR.",
}

export default async function VendorQuotationsPage() {
    const data = await getVendorQuotations()
    
    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <PageHeader
                title="Vendor Quotation Database"
                subtitle="Database penawaran harga dari vendor. Gunakan OCR untuk mengekstrak data dari dokumen PDF/gambar secara otomatis."
                icon={FileText}
            />

            <Suspense
                fallback={
                    <div className="flex h-[400px] items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <span className="ml-2 text-muted-foreground">Loading quotation database...</span>
                    </div>
                }
            >
                <VendorQuotationsClient initialData={data} />
            </Suspense>
        </div>
    )
}
