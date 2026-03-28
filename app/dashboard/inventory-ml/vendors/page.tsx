import Link from "next/link"
import { redirect } from "next/navigation"

import { getAuthenticatedSession } from "@/lib/rbac"
import { db } from "@/db"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { getInventoryVendorProfiles } from "@/app/actions/inventory-vendors"

import { VendorLeadTimeClient } from "./_components/vendor-lead-time-client"

export const metadata = {
    title: "Vendor Delivery Setup - ML Inventory Forecast",
    description: "Kelola vendor, material yang dijual, dan lead time delivery untuk kebutuhan ROP inventory ML.",
}

async function checkAccess(userId: string) {
    const dbUser = await db.query.user.findFirst({
        where: (u, { eq }) => eq(u.id, userId),
    })

    const role = dbUser?.role?.toLowerCase()
    return role === "admin" || role === "superuser" || role === "inventory_manager" || role === "inventory manager"
}

export default async function InventoryVendorLeadTimePage() {
    const session = await getAuthenticatedSession("inventory", "view")
    const hasAccess = await checkAccess(session.user.id)

    if (!hasAccess) {
        redirect("/dashboard/inventory-ml?error=unauthorized")
    }

    const profiles = await getInventoryVendorProfiles()

    return (
        <div className="flex flex-col gap-6 p-4 md:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <PageHeader
                    title="Vendor Delivery Setup"
                    subtitle="Tentukan vendor menjual material apa saja dan berapa lead time delivery-nya agar perhitungan ROP lebih akurat."
                />
                <Button asChild variant="outline" className="w-full sm:w-auto">
                    <Link href="/dashboard/inventory-ml">Kembali ke ML Forecast</Link>
                </Button>
            </div>
            <VendorLeadTimeClient initialProfiles={profiles} />
        </div>
    )
}
