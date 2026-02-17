"use client"

import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import { syncPermissions } from "@/app/actions/permissions"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useState } from "react"

export function SyncPermissionsButton() {
    const [isSyncing, setIsSyncing] = useState(false)
    const router = useRouter()

    const handleSync = async () => {
        setIsSyncing(true)
        try {
            const result = await syncPermissions()
            if (result.success) {
                toast.success(`Permissions synced: ${result.added} added`)
                router.refresh()
            } else {
                toast.error("Failed to sync permissions")
            }
        } catch {
            toast.error("An error occurred")
        } finally {
            setIsSyncing(false)
        }
    }

    return (
        <Button variant="outline" size="sm" onClick={handleSync} disabled={isSyncing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
            Sync Permissions
        </Button>
    )
}
