import { Suspense } from "react"
import { getAuthenticatedSession } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { MLSettingsClient } from "./_components/ml-settings-client"
import { getMLSettings } from "@/app/actions/inventory-ml"
import { db } from "@/db"
import { roles } from "@/db/schema"
import { eq } from "drizzle-orm"

export const metadata = {
    title: "ML Settings - Inventory Forecast",
    description: "Configure ML parameters for inventory predictions"
}

async function checkAdminAccess(userId: string) {
    const dbUser = await db.query.user.findFirst({
        where: (u, { eq }) => eq(u.id, userId),
    })

    if (!dbUser?.role) {
        return false
    }

    const userRole = dbUser.role.toLowerCase()

    // Allow admin, superuser, or inventory_manager roles (Requirement 9.2)
    return userRole === 'admin' ||
        userRole === 'superuser' ||
        userRole === 'inventory_manager' ||
        userRole === 'inventory manager'
}

export default async function MLSettingsPage() {
    // Check authentication and permissions
    const session = await getAuthenticatedSession("inventory", "edit")

    // Additional role check for admin/inventory_manager (Requirement 9.2)
    const hasAccess = await checkAdminAccess(session.user.id)

    if (!hasAccess) {
        redirect("/dashboard/inventory-ml?error=unauthorized")
    }

    // Fetch current settings
    const currentSettings = await getMLSettings()

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">ML Settings</h1>
                    <p className="text-muted-foreground mt-1">
                        Configure ML model parameters for inventory predictions
                    </p>
                </div>
            </div>

            <Suspense fallback={<div>Loading settings...</div>}>
                <MLSettingsClient
                    initialSettings={currentSettings}
                    userId={session.user.id}
                />
            </Suspense>
        </div>
    )
}
