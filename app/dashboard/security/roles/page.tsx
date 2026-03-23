import dynamic from "next/dynamic"
import { getSecurityRoles, getAllSecurityPermissions } from "@/app/actions/security"

const RolesMatrix = dynamic(
    () => import("./_components/roles-matrix").then((module) => module.RolesMatrix),
    {
        ssr: false,
        loading: () => <div className="text-muted-foreground text-sm">Loading roles…</div>,
    }
)

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
            <RolesMatrix roles={roles} allPermissions={allPermissions} />
        </div>
    )
}
