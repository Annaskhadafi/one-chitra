import { redirect } from "next/navigation"
import { getVendorTenantForCurrentUser } from "@/app/actions/vendor-invoices"
import { VendorInvoiceCreateForm } from "./_components/create-invoice-form"
import { ArrowLeft, FilePlus } from "lucide-react"
import Link from "next/link"

export const metadata = {
    title: "Ajukan Invoice Baru | One Chitra Partner Portal",
    description: "Formulir pengajuan faktur tagihan vendor ke sistem One Chitra.",
}

export default async function NewVendorInvoicePage() {
    const tenantData = await getVendorTenantForCurrentUser()

    if (!tenantData) {
        redirect("/vendor/login")
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 py-4">
            <div className="flex items-center gap-3">
                <Link
                    href="/vendor/dashboard"
                    className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <FilePlus className="w-6 h-6 text-primary" />
                        Pengajuan Tagihan Invoice Baru
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Mitra Vendor: <strong className="text-slate-800 dark:text-slate-200">{tenantData.name}</strong> ({tenantData.code})
                    </p>
                </div>
            </div>

            <VendorInvoiceCreateForm tenant={tenantData} />
        </div>
    )
}
