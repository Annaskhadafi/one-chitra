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
import { ResetPasswordDialog } from "./reset-password-dialog"

import { User } from "@/lib/types"
import { useState, useMemo, useCallback } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Users, Shield, UserCheck, Trash2, ChevronUp, ChevronDown, Key } from "lucide-react"
import { ScoreCard } from "@/components/score-card"
import { BulkActions } from "@/components/bulk-actions"
import { bulkDeleteUsers, bulkUpdateUserRole, deleteUser, getUsers } from "@/app/actions/users"
import { AddUserDialog } from "./add-user-dialog"
import { ImportUsersDialog } from "./import-users-dialog"
import { toast } from "sonner"
import { usePermissions } from "@/hooks/use-permissions"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    getSortedRowModel,
    SortingState,
    useReactTable,
} from "@tanstack/react-table"

interface UserListProps {
    users: User[]
    roles: { id: number; name: string }[]
}

export function UserList({ users: initialUsers, roles }: UserListProps) {
    const queryClient = useQueryClient()
    const { hasResourcePermission } = usePermissions()
    const canCreate = hasResourcePermission('users', 'create')
    const canEdit = hasResourcePermission('users', 'edit')
    const canDelete = hasResourcePermission('users', 'delete')

    const { data = initialUsers } = useQuery({
        queryKey: ["users"],
        queryFn: getUsers,
        initialData: initialUsers,
        staleTime: 60 * 1000,
    })

    const [sorting, setSorting] = useState<SortingState>([])
    const [rowSelection, setRowSelection] = useState({})
    const [resetUser, setResetUser] = useState<User | null>(null)

    // Mutations
    const deleteMutation = useMutation({
        mutationFn: (ids: string[]) => ids.length === 1 ? deleteUser(ids[0]) : bulkDeleteUsers(ids),
        onMutate: async (ids) => {
            await queryClient.cancelQueries({ queryKey: ["users"] })
            const previousUsers = queryClient.getQueryData<User[]>(["users"])

            if (previousUsers) {
                queryClient.setQueryData<User[]>(["users"], (old) =>
                    old?.filter(u => !ids.includes(u.id))
                )
            }

            return { previousUsers }
        },
        onError: (err, variables, context) => {
            if (context?.previousUsers) {
                queryClient.setQueryData(["users"], context.previousUsers)
            }
            toast.error("Failed to delete user(s)")
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["users"] })
        },
    })

    const updateRoleMutation = useMutation({
        mutationFn: ({ ids, role }: { ids: string[], role: string }) => bulkUpdateUserRole(ids, role),
        onMutate: async ({ ids, role }) => {
            await queryClient.cancelQueries({ queryKey: ["users"] })
            const previousUsers = queryClient.getQueryData<User[]>(["users"])

            if (previousUsers) {
                queryClient.setQueryData<User[]>(["users"], (old) =>
                    old?.map(u => ids.includes(u.id) ? { ...u, role } : u)
                )
            }

            return { previousUsers }
        },
        onError: (err, variables, context) => {
            if (context?.previousUsers) {
                queryClient.setQueryData(["users"], context.previousUsers)
            }
            toast.error("Failed to update role(s)")
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["users"] })
        },
    })

    const handleDelete = useCallback(async (userId: string) => {
        if (confirm("Are you sure you want to delete this user?")) {
            deleteMutation.mutate([userId], {
                onSuccess: () => toast.success("User deleted")
            })
        }
    }, [deleteMutation])

    // Stats calculation
    const totalUsers = data.length
    const adminCount = data.filter(u => u.role?.toLowerCase() === 'admin').length
    const staffCount = data.filter(u => u.role?.toLowerCase() === 'staff').length

    const columns = useMemo<ColumnDef<User>[]>(() => [
        {
            id: "select",
            header: ({ table }) => (
                <Checkbox
                    checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="Select all"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label="Select row"
                />
            ),
            enableSorting: false,
            enableHiding: false,
        },
        {
            accessorKey: "name",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="-ml-4 h-8"
                >
                    User
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
            cell: ({ row }) => (
                <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                        <AvatarImage src={row.original.image || ""} />
                        <AvatarFallback>{row.original.name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{row.original.name}</span>
                </div>
            ),
        },
        {
            accessorKey: "email",
            header: "Email",
        },
        {
            accessorKey: "role",
            header: "Role",
            cell: ({ row }) => <Badge variant="outline">{row.original.role}</Badge>,
        },
        {
            id: "actions",
            header: () => <div className="text-right">Actions</div>,
            cell: ({ row }) => {
                const user = row.original
                return (
                    <div className="flex justify-end items-center gap-2">
                        {canEdit && (
                            <>
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
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                    onClick={() => setResetUser(user)}
                                    title="Reset Password"
                                >
                                    <Key className="h-4 w-4" />
                                </Button>
                            </>
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
                )
            },
        },
    ], [canEdit, canDelete, roles, handleDelete])

    const table = useReactTable({
        data,
        columns,
        state: {
            sorting,
            rowSelection,
        },
        onSortingChange: setSorting,
        onRowSelectionChange: setRowSelection,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    })

    const handleBulkDelete = async () => {
        const selectedIds = table.getSelectedRowModel().flatRows.map(r => r.original.id)
        if (confirm("Are you sure you want to delete selected users?")) {
            deleteMutation.mutate(selectedIds, {
                onSuccess: (result) => {
                    if (result.success) {
                        toast.success("Users deleted")
                        setRowSelection({})
                    } else {
                        toast.error(result.error || "Failed to delete users")
                    }
                }
            })
        }
    }

    const handleBulkEditRole = async () => {
        const selectedIds = table.getSelectedRowModel().flatRows.map(r => r.original.id)
        const role = prompt("Enter new role for selected users (admin/staff/user):")
        if (role) {
            updateRoleMutation.mutate({ ids: selectedIds, role }, {
                onSuccess: (result) => {
                    if (result.success) {
                        toast.success("Roles updated")
                        setRowSelection({})
                    } else {
                        toast.error(result.error || "Failed to update roles")
                    }
                }
            })
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
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <TableHead key={header.id}>
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(
                                                header.column.columnDef.header,
                                                header.getContext()
                                            )}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && "selected"}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-24 text-center">
                                    No results.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {table.getSelectedRowModel().flatRows.length > 0 && (canEdit || canDelete) && (
                <BulkActions
                    selectedCount={table.getSelectedRowModel().flatRows.length}
                    onDelete={canDelete ? handleBulkDelete : () => { }}
                    onEdit={canEdit ? handleBulkEditRole : () => { }}
                    entityName="user"
                />
            )}

            <ResetPasswordDialog
                user={resetUser ? { id: resetUser.id, name: resetUser.name || '', email: resetUser.email || '' } : null}
                open={!!resetUser}
                onOpenChange={(open) => !open && setResetUser(null)}
            />
        </div>
    )
}
