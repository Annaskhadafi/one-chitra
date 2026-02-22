"use client"

import React, { createContext, useContext, ReactNode } from "react"

interface PermissionsContextType {
    permissions: string[]
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined)

export function PermissionsProvider({
    children,
    permissions
}: {
    children: ReactNode,
    permissions: string[]
}) {
    return (
        <PermissionsContext.Provider value={{ permissions }}>
            {children}
        </PermissionsContext.Provider>
    )
}

export function usePermissions() {
    const context = useContext(PermissionsContext)
    if (context === undefined) {
        throw new Error("usePermissions must be used within a PermissionsProvider")
    }

    const hasPermission = (permission: string) => {
        // Special case for dashboard which is always visible
        if (permission === 'dashboard:view') return true

        // Admin has all permissions
        const isAdmin = context.permissions.includes("admin:view") ||
            context.permissions.includes("admin") ||
            context.permissions.includes("superuser")

        if (isAdmin) {
            return true
        }

        const result = context.permissions.includes(permission)
        // Log roles related permissions to help debug visibility
        if (permission.startsWith("roles:")) {
            console.log(`Checking permission: ${permission}, Result: ${result}, IsAdmin: ${isAdmin}`)
        }
        return result
    }

    const hasResourcePermission = (resource: string, action: 'view' | 'create' | 'edit' | 'delete') => {
        return hasPermission(`${resource}:${action}`)
    }

    return {
        permissions: context.permissions,
        hasPermission,
        hasResourcePermission,
    }
}
