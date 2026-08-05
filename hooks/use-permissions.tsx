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
    
    // If rendered outside PermissionsProvider (e.g. standalone forms or tests), fallback to empty permissions
    const permissions = context?.permissions || []

    const hasPermission = (permission: string) => {
        // If context is missing, allow access by default to prevent breaking UI rendering
        if (!context) return true

        // Special case for dashboard which is always visible
        if (permission === 'dashboard:view') return true

        // Admin has all permissions
        const isAdmin = permissions.includes("admin:view") ||
            permissions.includes("admin") ||
            permissions.includes("superuser")

        if (isAdmin) {
            return true
        }

        const result = permissions.includes(permission)
        return result
    }

    const hasResourcePermission = (resource: string, action: 'view' | 'create' | 'edit' | 'delete') => {
        return hasPermission(`${resource}:${action}`)
    }

    return {
        permissions,
        hasPermission,
        hasResourcePermission,
    }
}
