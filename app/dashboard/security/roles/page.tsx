import { getSecurityRoles, getAllSecurityPermissions } from "@/app/actions/security"
import { RolesMatrixShell } from "./_components/roles-matrix-shell"
import { db } from "@/db"
import { settings } from "@/db/schema"
import {
    NAVBAR_MENU_SETTING_KEY,
    parseNavigationConfigFromSetting,
    collectPermissionMenuEntries,
} from "@/lib/navigation-menu"
import { eq } from "drizzle-orm"

export default async function SecurityRolesPage() {
    const [roles, allPermissions, navbarMenuSetting] = await Promise.all([
        getSecurityRoles(),
        getAllSecurityPermissions(),
        db
            .select({ value: settings.value })
            .from(settings)
            .where(eq(settings.key, NAVBAR_MENU_SETTING_KEY))
            .limit(1),
    ])

    const menuEntries = collectPermissionMenuEntries(
        parseNavigationConfigFromSetting(navbarMenuSetting[0]?.value ?? null)
    )

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Roles &amp; Permissions</h1>
                <p className="text-muted-foreground">
                    Create roles, assign permissions, and control what each role can access.
                </p>
            </div>
            <RolesMatrixShell
                roles={roles}
                allPermissions={allPermissions}
                menuEntries={menuEntries}
            />
        </div>
    )
}
