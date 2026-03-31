"use client"

import { useEffect, useState } from "react"

import { RolesMatrix } from "./roles-matrix"
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

type RolesMatrixShellProps = {
    roles: Role[]
    allPermissions: Permission[]
    menuEntries: PermissionMenuEntry[]
}

export function RolesMatrixShell({ roles, allPermissions, menuEntries }: RolesMatrixShellProps) {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) {
        return <div className="text-muted-foreground text-sm">Loading roles...</div>
    }

    return <RolesMatrix roles={roles} allPermissions={allPermissions} menuEntries={menuEntries} />
}
