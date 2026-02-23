"use client"

import { useState, useTransition } from "react"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { UserPlus, Ban, CheckCircle, Trash2, Shield, Search, RefreshCw, KeyRound, Users, UserCheck, Upload } from "lucide-react"
import {
    createSecurityUser,
    updateSecurityUserRole,
    banSecurityUser,
    unbanSecurityUser,
    deleteSecurityUser,
} from "@/app/actions/security"
import { adminResetPassword } from "@/app/actions/users"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ImportUsersDialog } from "./import-users-dialog"
import { useRouter } from "next/navigation"
import { format } from "date-fns"

type UserRow = {
    id: string
    name: string
    email: string
    role: string
    banned: boolean | null
    banReason: string | null
    createdAt: Date
    updatedAt: Date
    emailVerified: boolean
    image: string | null
}

type RoleRow = { id: number; name: string; description: string | null }

interface SecurityUserTableProps {
    users: UserRow[]
    roles: RoleRow[]
}

export function SecurityUserTable({ users: initialUsers, roles }: SecurityUserTableProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [search, setSearch] = useState("")
    const [roleFilter, setRoleFilter] = useState("all")

    // Dialog states
    const [createOpen, setCreateOpen] = useState(false)
    const [importOpen, setImportOpen] = useState(false)
    const [banOpen, setBanOpen] = useState<{ user: UserRow } | null>(null)
    const [roleOpen, setRoleOpen] = useState<{ user: UserRow } | null>(null)
    const [deleteOpen, setDeleteOpen] = useState<{ user: UserRow } | null>(null)
    const [changePasswordOpen, setChangePasswordOpen] = useState<{ user: UserRow } | null>(null)

    // Form states
    const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: roles[0]?.name ?? "staff" })
    const [banReason, setBanReason] = useState("")
    const [selectedRole, setSelectedRole] = useState("")
    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")

    const filtered = initialUsers.filter((u) => {
        const matchesSearch =
            u.name.toLowerCase().includes(search.toLowerCase()) ||
            u.email.toLowerCase().includes(search.toLowerCase())
        const matchesRole = roleFilter === "all" || u.role === roleFilter
        return matchesSearch && matchesRole
    })

    function refresh() {
        startTransition(() => { router.refresh() })
    }

    // ── Create User ────────────────────────────────────────────────────────────
    async function handleCreate() {
        const result = await createSecurityUser(newUser)
        if (result.success) {
            toast.success("User created successfully")
            setCreateOpen(false)
            setNewUser({ name: "", email: "", password: "", role: roles[0]?.name ?? "staff" })
            refresh()
        } else {
            toast.error(result.error ?? "Failed to create user")
        }
    }

    // ── Change Role ────────────────────────────────────────────────────────────
    async function handleRoleChange() {
        if (!roleOpen) return
        const result = await updateSecurityUserRole(roleOpen.user.id, selectedRole)
        if (result.success) {
            toast.success("Role updated")
            setRoleOpen(null)
            refresh()
        } else {
            toast.error(result.error ?? "Failed to update role")
        }
    }

    // ── Ban / Unban ────────────────────────────────────────────────────────────
    async function handleBan() {
        if (!banOpen) return
        const result = await banSecurityUser(banOpen.user.id, banReason)
        if (result.success) {
            toast.success("User banned")
            setBanOpen(null)
            setBanReason("")
            refresh()
        } else {
            toast.error(result.error ?? "Failed to ban user")
        }
    }

    async function handleUnban(userId: string) {
        const result = await unbanSecurityUser(userId)
        if (result.success) {
            toast.success("User unbanned")
            refresh()
        } else {
            toast.error(result.error ?? "Failed to unban user")
        }
    }

    // ── Change Password ────────────────────────────────────────────────────────
    async function handleChangePassword() {
        if (!changePasswordOpen) return
        if (newPassword.length < 8) {
            toast.error("Password must be at least 8 characters")
            return
        }
        if (newPassword !== confirmPassword) {
            toast.error("Passwords do not match")
            return
        }
        const result = await adminResetPassword(changePasswordOpen.user.id, newPassword)
        if (result.success) {
            toast.success(`Password updated for ${changePasswordOpen.user.email}`)
            setChangePasswordOpen(null)
            setNewPassword("")
            setConfirmPassword("")
        } else {
            toast.error(result.error ?? "Failed to update password")
        }
    }

    // ── Delete ─────────────────────────────────────────────────────────────────
    async function handleDelete() {
        if (!deleteOpen) return
        const result = await deleteSecurityUser(deleteOpen.user.id)
        if (result.success) {
            toast.success("User deleted")
            setDeleteOpen(null)
            refresh()
        } else {
            toast.error(result.error ?? "Failed to delete user")
        }
    }

    const uniqueRoles = Array.from(new Set(initialUsers.map((u) => u.role)))

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <div className="flex gap-2 flex-wrap">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search users…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-8 w-64"
                        />
                    </div>
                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                        <SelectTrigger className="w-40">
                            <SelectValue placeholder="All roles" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All roles</SelectItem>
                            {uniqueRoles.map((r) => (
                                <SelectItem key={r} value={r}>{r}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={refresh} disabled={isPending}>
                        <RefreshCw className={`h-4 w-4 mr-1 ${isPending ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                        <Upload className="h-4 w-4 mr-1" />
                        Import CSV
                    </Button>
                    <Button size="sm" onClick={() => setCreateOpen(true)}>
                        <UserPlus className="h-4 w-4 mr-1" />
                        Add User
                    </Button>
                </div>
            </div>

            {/* Score Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{initialUsers.length}</div>
                        <p className="text-xs text-muted-foreground">Registered accounts</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                        <UserCheck className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {initialUsers.filter((u) => !u.banned).length}
                        </div>
                        <p className="text-xs text-muted-foreground">Not banned</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">Banned Users</CardTitle>
                        <Ban className="h-4 w-4 text-destructive" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-destructive">
                            {initialUsers.filter((u) => u.banned).length}
                        </div>
                        <p className="text-xs text-muted-foreground">Access restricted</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">Showing</CardTitle>
                        <Search className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{filtered.length}</div>
                        <p className="text-xs text-muted-foreground">Matching filters</p>
                    </CardContent>
                </Card>
            </div>

            {/* Table */}
            <div className="rounded-lg border overflow-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filtered.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                    No users found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filtered.map((u) => (
                                <TableRow key={u.id}>
                                    <TableCell>
                                        <div>
                                            <p className="font-medium">{u.name}</p>
                                            <p className="text-xs text-muted-foreground">{u.email}</p>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="capitalize">
                                            {u.role}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {u.banned ? (
                                            <Badge variant="destructive" title={u.banReason ?? ""}>Banned</Badge>
                                        ) : (
                                            <Badge variant="secondary" className="text-green-700 bg-green-100">Active</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {format(new Date(u.createdAt), "dd MMM yyyy")}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                title="Change role"
                                                onClick={() => {
                                                    setSelectedRole(u.role)
                                                    setRoleOpen({ user: u })
                                                }}
                                            >
                                                <Shield className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                title="Change password"
                                                onClick={() => {
                                                    setNewPassword("")
                                                    setConfirmPassword("")
                                                    setChangePasswordOpen({ user: u })
                                                }}
                                            >
                                                <KeyRound className="h-4 w-4 text-muted-foreground" />
                                            </Button>
                                            {u.banned ? (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    title="Unban user"
                                                    onClick={() => handleUnban(u.id)}
                                                >
                                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                                </Button>
                                            ) : (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    title="Ban user"
                                                    onClick={() => setBanOpen({ user: u })}
                                                >
                                                    <Ban className="h-4 w-4 text-red-600" />
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                title="Delete user"
                                                onClick={() => setDeleteOpen({ user: u })}
                                            >
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* ── Import Users Dialog ─────────────────────────────────────────────── */}
            <ImportUsersDialog
                open={importOpen}
                onOpenChange={setImportOpen}
                roles={roles}
                onSuccess={refresh}
            />

            {/* ── Create User Dialog ──────────────────────────────────────────────── */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create New User</DialogTitle>
                        <DialogDescription>Add a new user to the system. They will receive credentials to log in.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1">
                            <Label>Full Name</Label>
                            <Input value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} placeholder="John Doe" />
                        </div>
                        <div className="space-y-1">
                            <Label>Email</Label>
                            <Input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder="john@example.com" />
                        </div>
                        <div className="space-y-1">
                            <Label>Password</Label>
                            <Input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} placeholder="Min. 8 characters" />
                        </div>
                        <div className="space-y-1">
                            <Label>Role</Label>
                            <Select value={newUser.role} onValueChange={(v) => setNewUser({ ...newUser, role: v })}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {roles.map((r) => (
                                        <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreate} disabled={!newUser.name || !newUser.email || !newUser.password}>
                            Create User
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Change Role Dialog ──────────────────────────────────────────────── */}
            <Dialog open={!!roleOpen} onOpenChange={(o) => !o && setRoleOpen(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Change Role</DialogTitle>
                        <DialogDescription>Update role for <strong>{roleOpen?.user.email}</strong></DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Select value={selectedRole} onValueChange={setSelectedRole}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                                {roles.map((r) => (
                                    <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRoleOpen(null)}>Cancel</Button>
                        <Button onClick={handleRoleChange} disabled={!selectedRole}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Ban User Dialog ─────────────────────────────────────────────────── */}
            <Dialog open={!!banOpen} onOpenChange={(o) => !o && setBanOpen(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Ban User</DialogTitle>
                        <DialogDescription>
                            Ban <strong>{banOpen?.user.email}</strong> from accessing the system.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-1">
                        <Label>Reason (optional)</Label>
                        <Input
                            placeholder="Reason for ban…"
                            value={banReason}
                            onChange={(e) => setBanReason(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setBanOpen(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleBan}>Ban User</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Change Password Dialog ──────────────────────────────────────────── */}
            <Dialog open={!!changePasswordOpen} onOpenChange={(o) => { if (!o) { setChangePasswordOpen(null); setNewPassword(""); setConfirmPassword("") } }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Change Password</DialogTitle>
                        <DialogDescription>
                            Set a new password for <strong>{changePasswordOpen?.user.email}</strong>.
                            The user should be notified to change it on next login.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1">
                            <Label>New Password</Label>
                            <Input
                                type="password"
                                placeholder="Min. 8 characters"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>Confirm Password</Label>
                            <Input
                                type="password"
                                placeholder="Repeat new password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                        </div>
                        {newPassword && confirmPassword && newPassword !== confirmPassword && (
                            <p className="text-sm text-destructive">Passwords do not match.</p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setChangePasswordOpen(null); setNewPassword(""); setConfirmPassword("") }}>Cancel</Button>
                        <Button
                            onClick={handleChangePassword}
                            disabled={!newPassword || !confirmPassword || newPassword !== confirmPassword || newPassword.length < 8}
                        >
                            Update Password
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Delete User Dialog ──────────────────────────────────────────────── */}
            <Dialog open={!!deleteOpen} onOpenChange={(o) => !o && setDeleteOpen(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete User</DialogTitle>
                        <DialogDescription>
                            Permanently delete <strong>{deleteOpen?.user.email}</strong>? This cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteOpen(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDelete}>Delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
