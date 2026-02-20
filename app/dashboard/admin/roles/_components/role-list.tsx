"use client"

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RoleWithPermissions } from "@/lib/types"
import { deleteRole } from "@/app/actions/roles"
import { RoleDialog } from "./role-dialog"
import { Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { usePermissions } from "@/hooks/use-permissions"

import { PermissionGroup } from "./role-dialog"

interface RoleListProps {
    roles: RoleWithPermissions[]
    allPermissions: PermissionGroup
}

export function RoleList({ roles, allPermissions }: RoleListProps) {
    const { hasResourcePermission } = usePermissions()
    const canEdit = hasResourcePermission('roles', 'edit')
    const canDelete = hasResourcePermission('roles', 'delete')

    const handleDelete = async (roleId: number) => {
        if (confirm("Are you sure you want to delete this role?")) {
            const result = await deleteRole(roleId)
            if (result.success) {
                toast.success("Role deleted successfully")
            } else {
                toast.error(result.error || "Failed to delete role")
            }
        }
    }

    return (
        <div className="border rounded-md">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Role Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Permissions Count</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {roles.map((role) => (
                        <TableRow key={role.id}>
                            <TableCell className="font-medium">{role.name}</TableCell>
                            <TableCell>{role.description}</TableCell>
                            <TableCell>
                                <Badge variant="secondary">
                                    {role.permissions?.length || 0} permissions
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                    {canEdit && (
                                        <RoleDialog
                                            role={role}
                                            allPermissions={allPermissions}
                                            trigger={
                                                <Button variant="ghost" size="icon">
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                            }
                                        />
                                    )}
                                    {canDelete && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-destructive hover:text-destructive"
                                            onClick={() => handleDelete(role.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
