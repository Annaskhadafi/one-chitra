import { Paintbrush } from "lucide-react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"
import { db } from "@/db"
import { getNavbarTheme } from "@/lib/navbar-theme"
import { NavbarThemeForm } from "./_components/navbar-theme-form"

export const metadata = {
    title: "Navbar Settings – One Chitra",
}

export default async function NavbarSettingsPage() {
    const session = await auth.api.getSession({
        headers: await headers(),
    })

    if (!session?.user?.id) {
        redirect("/sign-in")
    }

    const dbUser = await db.query.user.findFirst({
        where: (user, { eq }) => eq(user.id, session.user.id),
    })

    const roleLower = dbUser?.role?.toLowerCase()
    if (roleLower !== "admin" && roleLower !== "superuser") {
        redirect("/dashboard")
    }

    const theme = await getNavbarTheme()

    return (
        <div className="space-y-6 p-6">
            <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                    <Paintbrush className="h-6 w-6 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Navbar Settings</h1>
                    <p className="text-sm text-muted-foreground">
                        Ubah warna navbar global dan terapkan ke semua role.
                    </p>
                </div>
            </div>

            <NavbarThemeForm initialTheme={theme} />
        </div>
    )
}
