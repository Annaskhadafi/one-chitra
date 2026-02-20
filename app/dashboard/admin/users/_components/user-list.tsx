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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { UserRoleDialog } from "./user-role-dialog"

import { User } from "@/lib/types"
import { useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Users, Shield, UserCheck, Trash2 } from "lucide-react"
import { ScoreCard } from "@/components/score-card"
import { BulkActions } from "@/components/bulk-actions"
import { bulkDeleteUsers, bulkUpdateUserRole, deleteUser } from "@/app/actions/users"
import { AddUserDialog } from "./add-user-dialog"
import { ImportUsersDialog } from "./import-users-dialog"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { usePermissions } from "@/hooks/use-permissions"

interface UserListProps {
    users: User[]
    roles: { id: number; name: string }[]
}

export function UserList({ users, roles }: UserListProps) {
    const { hasResourcePermission } = usePermissions()
    const canCreate = hasResourcePermission('users', 'create')
    const canEdit = hasResourcePermission('users', 'edit')
    const canDelete = hasResourcePermission('users', 'delete')

    const [selectedIds, setSelectedIds] = useState<string[]>([])

    // Stats calculation
    const totalUsers = users.length
    const adminCount = users.filter(u => u.role?.toLowerCase() === 'admin').length
    const staffCount = users.filter(u => u.role?.toLowerCase() === 'staff').length

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(users.map(u => u.id))
        } else {
            setSelectedIds([])
        }
    }

    const handleSelectOne = (checked: boolean, userId: string) => {
        if (checked) {
            setSelectedIds(prev => [...prev, userId])
        } else {
            setSelectedIds(prev => prev.filter(id => id !== userId))
        }
    }

    const handleBulkDelete = async () => {
        if (confirm("Are you sure you want to delete selected users?")) {
            await bulkDeleteUsers(selectedIds)
            setSelectedIds([])
        }
    }

    const handleBulkEditRole = async () => {
        const role = prompt("Enter new role for selected users (admin/staff/user):")
        if (role) {
            await bulkUpdateUserRole(selectedIds, role)
            setSelectedIds([])
        }
    }

    const router = useRouter()

    const handleDelete = async (userId: string) => {
        if (confirm("Are you sure you want to delete this user?")) {
            const result = await deleteUser(userId)
            if (result.success) {
                toast.success("User deleted")
            } else {
                toast.error("Failed to delete user")
            }
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div className="grid gap-4 md:grid-cols-3 w-full">
                    <ScoreCard
                        title="Total Users"
                        value={totalUsers}
                        icon={Users}
                        description="Active users in the system"
                        gradient="from-blue-500/10 via-blue-400/5 to-indigo-500/10 border-blue-200/50 dark:from-blue-500/20 dark:via-blue-400/10 dark:to-indigo-500/20 dark:border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/20"
                        iconColor="text-blue-600 dark:text-blue-400"
                        textColor="text-blue-900 dark:text-blue-100"
                    />
                    <ScoreCard
                        title="Administrators"
                        value={adminCount}
                        icon={Shield}
                        description="Users with full access"
                        gradient="from-rose-500/10 via-rose-400/5 to-pink-500/10 border-rose-200/50 dark:from-rose-500/20 dark:via-rose-400/10 dark:to-pink-500/20 dark:border-rose-500/30 hover:shadow-lg hover:shadow-rose-500/20"
                        iconColor="text-rose-600 dark:text-rose-400"
                        textColor="text-rose-900 dark:text-rose-100"
                    />
                    <ScoreCard
                        title="Staff Members"
                        value={staffCount}
                        icon={UserCheck}
                        description="Regular staff users"
                        gradient="from-emerald-500/10 via-emerald-400/5 to-teal-500/10 border-emerald-200/50 dark:from-emerald-500/20 dark:via-emerald-400/10 dark:to-teal-500/20 dark:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/20"
                        iconColor="text-emerald-600 dark:text-emerald-400"
                        textColor="text-emerald-900 dark:text-emerald-100"
                    />
                </div>
            </div>

            {canCreate && (
                <div className="flex justify-end gap-2">
                    <ImportUsersDialog />
                    <AddUserDialog roles={roles} />
                </div>
            )}

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50px]">
                                <Checkbox
                                    checked={selectedIds.length === users.length && users.length > 0}
                                    onCheckedChange={handleSelectAll}
                                />
                            </TableHead>
                            <TableHead>User</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.map((user) => (
                            <TableRow key={user.id}>
                                <TableCell>
                                    <Checkbox
                                        checked={selectedIds.includes(user.id)}
                                        onCheckedChange={(checked) => handleSelectOne(!!checked, user.id)}
                                    />
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={user.image || ""} />
                                            <AvatarFallback>{user.name?.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <span className="font-medium">{user.name}</span>
                                    </div>
                                </TableCell>
                                <TableCell>{user.email}</TableCell>
                                <TableCell>
                                    <Badge variant="outline">{user.role}</Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end items-center gap-2">
                                        {canEdit && (
                                            <UserRoleDialog
                                                userId={user.id}
                                                currentRole={user.role}
                                                roles={roles}
                                                trigger={
                                                    <Button variant="ghost" size="sm">
                                                        Edit Role
                                                    </Button>
                                                }
                                            />
                                        )}
                                        {canDelete && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => handleDelete(user.id)}
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

            {selectedIds.length > 0 && (canEdit || canDelete) && (
                <BulkActions
                    selectedCount={selectedIds.length}
                    onDelete={canDelete ? handleBulkDelete : () => { }}
                    onEdit={canEdit ? handleBulkEditRole : () => { }}
                    entityName="user"
                />
            )}
        </div>
    )
}
