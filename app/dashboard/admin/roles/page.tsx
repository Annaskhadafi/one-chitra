import { Suspense } from "react"
import { getRoles, getRoleWithPermissions } from "@/app/actions/roles"
import { getAllPermissions } from "@/app/actions/permissions"
import { getWarehouses } from "@/app/actions/warehouse"
import { RoleList } from "./_components/role-list"
import { RoleDialog } from "./_components/role-dialog"
import { SyncPermissionsButton } from "./_components/sync-button"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import type { RoleWithPermissions } from "@/lib/types"
import { PermissionGuard } from "@/components/permission-guard"

export default async function RolesPage() {
    const [roles, allPermissions, warehouses] = await Promise.all([
        getRoles(),
        getAllPermissions(),
        getWarehouses(),
    ]) // This also auto-syncs now, but button is good for manual trigger

    // Fetch detailed permissions for each role
    // In a real app with many roles, this might need optimization
    const rolesWithPerms = await Promise.all(
        roles.map(r => getRoleWithPermissions(r.id))
    )

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Roles & Permissions</h1>
                    <p className="text-muted-foreground">Manage roles and their access levels.</p>
                </div>
                <div className="flex items-center gap-2">
                    <PermissionGuard resource="roles" action="edit">
                        <SyncPermissionsButton />
                    </PermissionGuard>
                    <PermissionGuard resource="roles" action="create">
                        <RoleDialog
                            allPermissions={allPermissions}
                            trigger={
                                <Button>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Create Role
                                </Button>
                            }
                        />
                    </PermissionGuard>
                </div>
            </div>

            <Suspense fallback={<div>Loading roles...</div>}>
                <RoleList
                    roles={rolesWithPerms.filter((r): r is RoleWithPermissions => r !== null)}
                    allPermissions={allPermissions}
                    warehouses={warehouses}
                />
            </Suspense>
        </div>
    )
}

