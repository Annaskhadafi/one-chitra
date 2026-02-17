import { Suspense } from "react"
import { getRoles, getRoleWithPermissions } from "@/app/actions/roles"
import { getAllPermissions } from "@/app/actions/permissions"
import { RoleList } from "./_components/role-list"
import { RoleDialog } from "./_components/role-dialog"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

export default async function RolesPage() {
    const roles = await getRoles()
    const allPermissions = await getAllPermissions()

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
                <RoleDialog
                    allPermissions={allPermissions}
                    trigger={
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Create Role
                        </Button>
                    }
                />
            </div>

            <Suspense fallback={<div>Loading roles...</div>}>
                <RoleList
                    roles={rolesWithPerms.filter(Boolean) as any}
                    allPermissions={allPermissions}
                />
            </Suspense>
        </div>
    )
}
