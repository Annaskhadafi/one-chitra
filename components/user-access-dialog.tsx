"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    WarehouseAccessFieldset,
    type WarehouseAccessSelection,
    type WarehouseOption,
} from "@/components/warehouse-access-fieldset"

type UserAccessDialogProps = {
    userId: string
    currentRole: string
    currentWarehouseAccesses: WarehouseAccessSelection[]
    roles: { id: number; name: string }[]
    warehouses: WarehouseOption[]
    trigger: React.ReactNode
    queryKey?: string[]
    onSave: (payload: {
        userId: string
        role: string
        warehouseAccesses: WarehouseAccessSelection[]
    }) => Promise<{ success: boolean; error?: string }>
}

/**
 * Wrapper component to avoid "No QueryClient set" error during SSR.
 * useQueryClient and other context-dependent hooks are only called after mounting.
 */
export function UserAccessDialog(props: UserAccessDialogProps) {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) {
        return <>{props.trigger}</>
    }

    return <UserAccessDialogInner {...props} />
}

function UserAccessDialogInner({
    userId,
    currentRole,
    currentWarehouseAccesses,
    roles,
    warehouses,
    trigger,
    queryKey = ["users"],
    onSave,
}: UserAccessDialogProps) {
    const [open, setOpen] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [role, setRole] = useState(currentRole)
    const [warehouseAccesses, setWarehouseAccesses] = useState<WarehouseAccessSelection[]>(currentWarehouseAccesses)

    const router = useRouter()
    const queryClient = useQueryClient()

    function syncFromProps(nextOpen: boolean) {
        setOpen(nextOpen)

        if (nextOpen) {
            setRole(currentRole)
            setWarehouseAccesses(currentWarehouseAccesses)
        }
    }

    async function handleSave() {
        setIsSaving(true)

        try {
            const result = await onSave({
                userId,
                role,
                warehouseAccesses,
            })

            if (!result.success) {
                toast.error(result.error || "Failed to update user access")
                return
            }

            toast.success("User access updated")
            setOpen(false)
            queryClient.invalidateQueries({ queryKey })
            router.refresh()
        } catch (_error) {
            toast.error("An unexpected error occurred")
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={syncFromProps}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Edit User Access</DialogTitle>
                    <DialogDescription>
                        Atur role dan warehouse yang boleh dilihat atau diedit oleh user ini.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="space-y-1">
                        <Label>Role</Label>
                        <Select value={role} onValueChange={setRole} disabled={isSaving}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                                {roles.map((item) => (
                                    <SelectItem key={item.id} value={item.name}>
                                        {item.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <WarehouseAccessFieldset
                        warehouses={warehouses}
                        value={warehouseAccesses}
                        onChange={setWarehouseAccesses}
                        disabled={isSaving}
                    />
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={isSaving}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
