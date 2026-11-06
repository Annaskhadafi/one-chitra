import { redirect } from "next/navigation"
import { getVendorTenantForCurrentUser, getVendorInvoicesAction } from "@/app/actions/vendor-invoices"
import { VendorDashboardClient } from "./_components/vendor-dashboard-client"

export const metadata = {
    title: "Dashboard Tagihan Vendor | One Chitra",
    description: "Monitoring status pengajuan faktur tagihan dan riwayat pembayaran.",
}

export default async function VendorDashboardPage() {
    const tenantData = await getVendorTenantForCurrentUser()

    if (!tenantData) {
        redirect("/vendor/login")
    }

    const invoices = await getVendorInvoicesAction({
        tenantId: tenantData.id,
    })

    return (
        <div className="space-y-6">
            <VendorDashboardClient tenant={tenantData} initialInvoices={invoices} />
        </div>
    )
}
