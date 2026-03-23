import { getSecurityRoles, getAllSecurityPermissions } from "@/app/actions/security"
import { RolesMatrixShell } from "./_components/roles-matrix-shell"

export default async function SecurityRolesPage() {
    const [roles, allPermissions] = await Promise.all([
        getSecurityRoles(),
        getAllSecurityPermissions(),
    ])

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Roles &amp; Permissions</h1>
                <p className="text-muted-foreground">
                    Create roles, assign permissions, and control what each role can access.
                </p>
            </div>
            <RolesMatrixShell roles={roles} allPermissions={allPermissions} />
        </div>
    )
}
