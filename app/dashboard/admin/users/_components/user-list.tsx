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
import { ResetPasswordDialog } from "./reset-password-dialog"

import { User } from "@/lib/types"
import { useState, useMemo, useCallback, useEffect } from "react"
// ... (rest of the imports)

// ... (types)

/**
 * Wrapper component to avoid "No QueryClient set" error during SSR.
 */
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

function UserListInner({ users: initialUsers, roles, warehouses }: UserListProps) {
    const queryClient = useQueryClient()
    // ... rest of the original UserList code
}
