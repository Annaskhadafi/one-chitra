"use client"

import { ReactNode } from "react"
import { usePermissions } from "@/hooks/use-permissions"

interface PermissionGuardProps {
    resource: string
    action: 'view' | 'create' | 'edit' | 'delete'
    children: ReactNode
    fallback?: ReactNode
}

export function PermissionGuard({
    resource,
    action,
    children,
    fallback = null
}: PermissionGuardProps) {
    const { hasResourcePermission } = usePermissions()

    if (hasResourcePermission(resource, action)) {
        return <>{children}</>
    }

    return <>{fallback}</>
}
