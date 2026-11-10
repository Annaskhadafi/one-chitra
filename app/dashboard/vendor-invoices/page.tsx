import { Suspense } from "react"
import {
    getAllVendorTenantsAction,
    getSapVendorMasterListAction,
    getVendorContractsAction,
    getVendorInvoiceDashboardStats,
    getVendorInvoicesAction,
} from "@/app/actions/vendor-invoices"
import { VendorInvoicesManagerClient } from "./_components/vendor-invoices-manager-client"
import { PageHeader } from "@/components/page-header"
import { FileSpreadsheet, Loader2 } from "lucide-react"

export const metadata = {
    title: "Vendor Invoice Management & Checkout | One Chitra",
    description: "Sistem terpadu monitoring invoice vendor, validation gate checklist, otorisasi pembayaran, proyeksi cash flow 3 bulan, dan batch payment checkout.",
}

export default async function VendorInvoicesDashboardPage() {
    const [stats, invoices, tenants, sapVendors, contracts] = await Promise.all([
        getVendorInvoiceDashboardStats(),
        getVendorInvoicesAction({ limit: 300 }),
        getAllVendorTenantsAction(),
        getSapVendorMasterListAction({ limit: 50 }),
        getVendorContractsAction(),
    ])

    return (
        <div className="flex-1 space-y-6 p-8 pt-6">
            <PageHeader
                title="Vendor Invoice Management & Checkout"
                subtitle="Kelola seluruh siklus invoice vendor: Validation Gate Admin, Validasi Pajak Finance, Otorisasi Manager, Proyeksi Pembayaran 3 Bulan, dan Batch Payment Checkout."
                icon={FileSpreadsheet}
            />

            <Suspense
                fallback={
                    <div className="flex h-[400px] items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <span className="ml-2 text-muted-foreground">Memuat data invoice vendor...</span>
                    </div>
                }
            >
                <VendorInvoicesManagerClient
                    initialStats={stats}
                    initialInvoices={invoices}
                    initialTenants={tenants}
                    initialSapVendors={sapVendors}
                    initialContracts={contracts}
                />
            </Suspense>
        </div>
    )
}
