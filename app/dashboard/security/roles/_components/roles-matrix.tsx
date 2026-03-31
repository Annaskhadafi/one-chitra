"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
    Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion"
import { toast } from "sonner"
import { Plus, Trash2, RefreshCw, Lock } from "lucide-react"
import {
    createSecurityRole,
    updateSecurityRole,
    deleteSecurityRole,
} from "@/app/actions/security"
import { useRouter } from "next/navigation"
import type { PermissionMenuEntry } from "@/lib/navigation-menu"

type Permission = { id: number; resource: string; action: string; description: string | null }
type RolePermission = { permissionId: number; resource: string; action: string }
type Role = {
    id: number
    name: string
    description: string | null
    permissions: RolePermission[]
    userCount: number
    isProtected: boolean
}

interface RolesMatrixProps {
    roles: Role[]
    allPermissions: Permission[]
    menuEntries: PermissionMenuEntry[]
}

const ACTIONS = ["view", "create", "edit", "delete"] as const

type PermissionRow = {
    key: string
    label: string
    resource: string
    description: string
}

export function RolesMatrix({ roles: initialRoles, allPermissions, menuEntries }: RolesMatrixProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [createOpen, setCreateOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState<{ role: Role } | null>(null)

    // New role form
    const [newRoleName, setNewRoleName] = useState("")
    const [newRoleDesc, setNewRoleDesc] = useState("")
    const [newRolePermIds, setNewRolePermIds] = useState<number[]>([])

    // Per-role editing state
    const [editingRole, setEditingRole] = useState<number | null>(null)
    const [editPermIds, setEditPermIds] = useState<number[]>([])

    const resources = Array.from(new Set(allPermissions.map((p) => p.resource))).sort()
    const menuResourceSet = new Set(menuEntries.map((entry) => entry.resource))
    const permissionRows: PermissionRow[] = [
        ...menuEntries.map((entry) => ({
            key: entry.key,
            label: entry.title,
            resource: entry.resource,
            description: entry.parentTitle
                ? `${entry.sectionTitle} / ${entry.parentTitle} / ${entry.url}`
                : `${entry.sectionTitle} / ${entry.url}`,
        })),
        ...resources
            .filter((resource) => !menuResourceSet.has(resource))
            .map((resource) => ({
                key: `resource-${resource}`,
                label: resource,
                resource,
                description: "Additional permission resource",
            })),
    ]

    function getPermId(resource: string, action: string) {
        return allPermissions.find((p) => p.resource === resource && p.action === action)?.id
    }

    function refresh() {
        startTransition(() => { router.refresh() })
    }

    // ── Toggle in a set ────────────────────────────────────────────────────────
    function toggle(ids: number[], id: number): number[] {
        return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
    }

    // ── Toggle all actions for a resource ──────────────────────────────────────
    function toggleResource(ids: number[], resource: string, checked: boolean): number[] {
        const resourcePerms = allPermissions.filter((p) => p.resource === resource).map((p) => p.id)
        if (checked) return Array.from(new Set([...ids, ...resourcePerms]))
        return ids.filter((id) => !resourcePerms.includes(id))
    }

    // ── Create Role ────────────────────────────────────────────────────────────
    async function handleCreate() {
        const result = await createSecurityRole({
            name: newRoleName,
            description: newRoleDesc,
            permissionIds: newRolePermIds,
        })
        if (result.success) {
            toast.success("Role created")
            setCreateOpen(false)
            setNewRoleName("")
            setNewRoleDesc("")
            setNewRolePermIds([])
            refresh()
        } else {
            toast.error(result.error ?? "Failed to create role")
        }
    }

    // ── Save Permission Changes ────────────────────────────────────────────────
    async function handleSavePermissions(roleId: number) {
        const result = await updateSecurityRole(roleId, { permissionIds: editPermIds })
        if (result.success) {
            toast.success("Permissions updated")
            setEditingRole(null)
            refresh()
        } else {
            toast.error(result.error ?? "Failed to update permissions")
        }
    }

    // ── Delete Role ────────────────────────────────────────────────────────────
    async function handleDelete() {
        if (!deleteOpen) return
        const result = await deleteSecurityRole(deleteOpen.role.id)
        if (result.success) {
            toast.success("Role deleted")
            setDeleteOpen(null)
            refresh()
        } else {
            toast.error(result.error ?? "Failed to delete role")
        }
    }

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                    {initialRoles.length} roles · {allPermissions.length} permissions
                </p>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={refresh} disabled={isPending}>
                        <RefreshCw className={`h-4 w-4 mr-1 ${isPending ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                    <Button size="sm" onClick={() => setCreateOpen(true)}>
                        <Plus className="h-4 w-4 mr-1" />
                        New Role
                    </Button>
                </div>
            </div>

            {/* Roles List */}
            <Accordion type="single" collapsible className="space-y-2">
                {initialRoles.map((role) => {
                    const isEditing = editingRole === role.id
                    const currentPermIds = isEditing
                        ? editPermIds
                        : role.permissions.map((p) => p.permissionId)

                    return (
                        <AccordionItem key={role.id} value={String(role.id)} className="border rounded-lg px-4">
                            <AccordionTrigger className="hover:no-underline">
                                <div className="flex items-center gap-3">
                                    <span className="font-semibold capitalize">{role.name}</span>
                                    {role.isProtected && (
                                        <span title="Protected role">
                                            <Lock className="h-3 w-3 text-muted-foreground" />
                                        </span>
                                    )}
                                    <Badge variant="outline" className="text-xs">
                                        {role.userCount} user{role.userCount !== 1 ? "s" : ""}
                                    </Badge>
                                    <Badge variant="secondary" className="text-xs">
                                        {role.permissions.length} permissions
                                    </Badge>
                                    {role.description && (
                                        <span className="text-xs text-muted-foreground hidden md:inline">{role.description}</span>
                                    )}
                                </div>
                            </AccordionTrigger>
                            <AccordionContent>
                                <div className="space-y-4 pt-2 pb-4">
                                    {/* Permission Matrix */}
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="text-left text-muted-foreground">
                                                    <th className="py-2 pr-4 font-medium w-40">Resource</th>
                                                    {ACTIONS.map((a) => (
                                                        <th key={a} className="py-2 px-3 font-medium capitalize text-center w-20">{a}</th>
                                                    ))}
                                                    {isEditing && <th className="py-2 px-3 font-medium text-center w-20">All</th>}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {permissionRows.map((row) => {
                                                    const allResourcePermIds = allPermissions
                                                        .filter((p) => p.resource === row.resource)
                                                        .map((p) => p.id)
                                                    const allChecked = allResourcePermIds.every((id) => currentPermIds.includes(id))

                                                    return (
                                                        <tr key={row.key} className="border-t">
                                                            <td className="py-2 pr-4 align-top">
                                                                <div className="space-y-1">
                                                                    <div className="font-medium text-sm">{row.label}</div>
                                                                    <div className="text-[11px] text-muted-foreground">{row.description}</div>
                                                                    <div className="font-mono text-[11px] text-muted-foreground">{row.resource}</div>
                                                                </div>
                                                            </td>
                                                            {ACTIONS.map((action) => {
                                                                const permId = getPermId(row.resource, action)
                                                                const checked = permId ? currentPermIds.includes(permId) : false
                                                                return (
                                                                    <td key={action} className="py-2 px-3 text-center">
                                                                        <Checkbox
                                                                            checked={checked}
                                                                            disabled={!isEditing || !permId}
                                                                            onCheckedChange={() => {
                                                                                if (permId) setEditPermIds(toggle(editPermIds, permId))
                                                                            }}
                                                                        />
                                                                    </td>
                                                                )
                                                            })}
                                                            {isEditing && (
                                                                <td className="py-2 px-3 text-center">
                                                                    <Checkbox
                                                                        checked={allChecked}
                                                                        onCheckedChange={(c) =>
                                                                            setEditPermIds(toggleResource(editPermIds, row.resource, !!c))
                                                                        }
                                                                    />
                                                                </td>
                                                            )}
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2 justify-end">
                                        {isEditing ? (
                                            <>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setEditingRole(null)}
                                                >
                                                    Cancel
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleSavePermissions(role.id)}
                                                >
                                                    Save Permissions
                                                </Button>
                                            </>
                                        ) : (
                                            <>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        setEditingRole(role.id)
                                                        setEditPermIds(role.permissions.map((p) => p.permissionId))
                                                    }}
                                                >
                                                    Edit Permissions
                                                </Button>
                                                {!role.isProtected && (
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={() => setDeleteOpen({ role })}
                                                    >
                                                        <Trash2 className="h-4 w-4 mr-1" />
                                                        Delete Role
                                                    </Button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    )
                })}
            </Accordion>

            {/* ── Create Role Dialog ──────────────────────────────────────────────── */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Create New Role</DialogTitle>
                        <DialogDescription>Define a new role and set its initial permissions.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label>Role Name</Label>
                                <Input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} placeholder="e.g. supervisor" />
                            </div>
                            <div className="space-y-1">
                                <Label>Description</Label>
                                <Input value={newRoleDesc} onChange={(e) => setNewRoleDesc(e.target.value)} placeholder="Brief description…" />
                            </div>
                        </div>

                        <div>
                            <Label className="text-sm font-medium mb-2 block">Permissions</Label>
                            <div className="overflow-x-auto border rounded-lg p-3">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-muted-foreground">
                                            <th className="py-1 pr-4 font-medium w-40">Resource</th>
                                            {ACTIONS.map((a) => (
                                                <th key={a} className="py-1 px-3 font-medium capitalize text-center w-20">{a}</th>
                                            ))}
                                            <th className="py-1 px-3 font-medium text-center w-20">All</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {permissionRows.map((row) => {
                                            const resPerms = allPermissions.filter((p) => p.resource === row.resource)
                                            const allChecked = resPerms.every((p) => newRolePermIds.includes(p.id))
                                            return (
                                                <tr key={row.key} className="border-t">
                                                    <td className="py-2 pr-4 align-top">
                                                        <div className="space-y-1">
                                                            <div className="font-medium text-sm">{row.label}</div>
                                                            <div className="text-[11px] text-muted-foreground">{row.description}</div>
                                                            <div className="font-mono text-[11px] text-muted-foreground">{row.resource}</div>
                                                        </div>
                                                    </td>
                                                    {ACTIONS.map((action) => {
                                                        const perm = resPerms.find((p) => p.action === action)
                                                        return (
                                                            <td key={action} className="py-1 px-3 text-center">
                                                                {perm ? (
                                                                    <Checkbox
                                                                        checked={newRolePermIds.includes(perm.id)}
                                                                        onCheckedChange={() =>
                                                                            setNewRolePermIds(toggle(newRolePermIds, perm.id))
                                                                        }
                                                                    />
                                                                ) : (
                                                                    <span className="text-muted-foreground/30">—</span>
                                                                )}
                                                            </td>
                                                        )
                                                    })}
                                                    <td className="py-1 px-3 text-center">
                                                        <Checkbox
                                                            checked={allChecked}
                                                            onCheckedChange={(c) =>
                                                                setNewRolePermIds(toggleResource(newRolePermIds, row.resource, !!c))
                                                            }
                                                        />
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreate} disabled={!newRoleName.trim()}>Create Role</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Delete Role Dialog ──────────────────────────────────────────────── */}
            <Dialog open={!!deleteOpen} onOpenChange={(o) => !o && setDeleteOpen(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Role</DialogTitle>
                        <DialogDescription>
                            Delete role <strong>{deleteOpen?.role.name}</strong>? Users with this role will not have a valid role assignment.
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
