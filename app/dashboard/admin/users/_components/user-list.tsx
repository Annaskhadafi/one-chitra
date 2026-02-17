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
import { Users, Shield, UserCheck } from "lucide-react"
import { ScoreCard } from "@/components/score-card"
import { BulkActions } from "@/components/bulk-actions"
import { bulkDeleteUsers, bulkUpdateUserRole } from "@/app/actions/users"

interface UserListProps {
    users: User[]
    roles: { id: number; name: string }[]
}

export function UserList({ users, roles }: UserListProps) {
    const [selectedIds, setSelectedIds] = useState<string[]>([])

    // Stats calculation
    const totalUsers = users.length
    const adminCount = users.filter(u => u.role === 'admin').length
    const staffCount = users.filter(u => u.role === 'staff').length

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

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
                <ScoreCard
                    title="Total Users"
                    value={totalUsers}
                    icon={Users}
                    description="Active users in the system"
                />
                <ScoreCard
                    title="Administrators"
                    value={adminCount}
                    icon={Shield}
                    description="Users with full access"
                />
                <ScoreCard
                    title="Staff Members"
                    value={staffCount}
                    icon={UserCheck}
                    description="Regular staff users"
                />
            </div>

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
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <BulkActions
                selectedCount={selectedIds.length}
                onDelete={handleBulkDelete}
                onEdit={handleBulkEditRole}
                entityName="user"
            />
        </div>
    )
}
