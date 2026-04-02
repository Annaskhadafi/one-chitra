"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { MoreHorizontal, Shield, Trash2 } from "lucide-react"

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
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { formatWarehouseLabel } from "@/lib/sloc"
import { deleteUser, getUsers } from "@/app/actions/users"
import { AddUserDialog } from "./add-user-dialog"
import { ImportUsersDialog } from "./import-users-dialog"
import { ResetPasswordDialog } from "./reset-password-dialog"
import { UserRoleDialog } from "./user-role-dialog"

type UserListUser = Awaited<ReturnType<typeof getUsers>>[number]
type UserListRole = { id: number; name: string }
type UserListWarehouse = { id: number; sloc: string; description?: string | null; type?: string | null }

type UserListProps = {
    users: UserListUser[]
    roles: UserListRole[]
    warehouses: UserListWarehouse[]
}

function getUserInitials(name: string | null | undefined) {
    const parts = (name ?? "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)

    if (parts.length === 0) return "U"
    return parts.map((part) => part[0]?.toUpperCase() ?? "").join("")
}

function getWarehouseAccessSummary(user: UserListUser) {
    if (!user.warehouseAccesses || user.warehouseAccesses.length === 0) {
        return ["All Warehouses"]
    }

    return user.warehouseAccesses.map((access) => {
        const label = access.warehouse ? formatWarehouseLabel(access.warehouse) : `Warehouse #${access.warehouseId}`
        const accessLabel = access.accessLevel === "view" ? "View" : "Edit"
        return `${label} (${accessLabel})`
    })
}

export function UserList(props: UserListProps) {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) {
        return (
            <div className="space-y-6">
                <div className="h-64 rounded-md border bg-muted/20 animate-pulse" />
            </div>
        )
    }

    return <UserListInner {...props} />
}

function UserListInner({ users, roles, warehouses }: UserListProps) {
    const router = useRouter()
    const [search, setSearch] = useState("")
    const [resetTarget, setResetTarget] = useState<UserListUser | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<UserListUser | null>(null)
    const [isDeleting, startDeleteTransition] = useTransition()

    const filteredUsers = useMemo(() => {
        const term = search.trim().toLowerCase()
        if (!term) return users

        return users.filter((user) => {
            const warehouseSummary = getWarehouseAccessSummary(user).join(" ").toLowerCase()
            return [
                user.name,
                user.email,
                user.role,
                warehouseSummary,
            ].some((value) => value?.toLowerCase().includes(term))
        })
    }, [search, users])

    const handleDelete = () => {
        if (!deleteTarget) return

        startDeleteTransition(async () => {
            const result = await deleteUser(deleteTarget.id)
            if (result.success) {
                toast.success(`User ${deleteTarget.name || deleteTarget.email} deleted`)
                setDeleteTarget(null)
                router.refresh()
            } else {
                toast.error(result.error || "Failed to delete user")
            }
        })
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Input
                    placeholder="Search name, email, role, warehouse..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="sm:max-w-sm"
                />
                <div className="flex flex-col gap-2 sm:flex-row">
                    <ImportUsersDialog />
                    <AddUserDialog roles={roles} warehouses={warehouses} />
                </div>
            </div>

            <div className="rounded-md border bg-card">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>User</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Warehouse Access</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredUsers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                        No users found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredUsers.map((user) => {
                                    const warehouseAccessSummary = getWarehouseAccessSummary(user)

                                    return (
                                        <TableRow key={user.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-9 w-9">
                                                        <AvatarImage src={user.image || undefined} alt={user.name || user.email} />
                                                        <AvatarFallback>{getUserInitials(user.name)}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="min-w-0">
                                                        <div className="font-medium">{user.name || "Unnamed User"}</div>
                                                        <div className="text-sm text-muted-foreground truncate">{user.email}</div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary">{user.role || "No role"}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap gap-1">
                                                    {warehouseAccessSummary.map((label) => (
                                                        <Badge key={`${user.id}-${label}`} variant="outline" className="max-w-full truncate">
                                                            {label}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <UserRoleDialog
                                                            userId={user.id}
                                                            currentRole={user.role || ""}
                                                            roles={roles}
                                                            trigger={
                                                                <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
                                                                    <Shield className="mr-2 h-4 w-4" />
                                                                    Change Role
                                                                </DropdownMenuItem>
                                                            }
                                                        />
                                                        <DropdownMenuItem onSelect={() => setResetTarget(user)}>
                                                            Reset Password
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            className="text-destructive focus:text-destructive"
                                                            onSelect={() => setDeleteTarget(user)}
                                                        >
                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                            Delete User
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <ResetPasswordDialog
                user={resetTarget ? { id: resetTarget.id, name: resetTarget.name || resetTarget.email, email: resetTarget.email } : null}
                open={Boolean(resetTarget)}
                onOpenChange={(open) => {
                    if (!open) setResetTarget(null)
                }}
            />

            <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => {
                if (!open) setDeleteTarget(null)
            }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete User</AlertDialogTitle>
                        <AlertDialogDescription>
                            {`Are you sure you want to delete ${deleteTarget?.name || deleteTarget?.email || "this user"}?`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
