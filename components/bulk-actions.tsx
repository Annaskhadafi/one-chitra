"use client"

import { Button } from "@/components/ui/button"
import { Trash2, Edit } from "lucide-react"

interface BulkActionsProps {
    selectedCount: number
    onDelete: () => void
    onEdit?: () => void
    entityName: string
    showEdit?: boolean
}

export function BulkActions({
    selectedCount,
    onDelete,
    onEdit,
    entityName,
    showEdit = true
}: BulkActionsProps) {
    if (selectedCount === 0) return null

    return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-background border rounded-lg shadow-lg p-2 flex items-center gap-4 z-50 animate-in slide-in-from-bottom-5">
            <div className="flex items-center gap-2 px-2">
                <span className="font-medium">{selectedCount}</span>
                <span className="text-muted-foreground text-sm">{entityName}(s) selected</span>
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
                {showEdit && onEdit && (
                    <Button variant="outline" size="sm" onClick={onEdit}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                    </Button>
                )}
                <Button variant="destructive" size="sm" onClick={onDelete}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                </Button>
            </div>
        </div>
    )
}
