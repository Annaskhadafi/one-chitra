"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { updateBillingRecord } from "@/app/actions/billing"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface EditableCellProps {
    row: any
    column: string
    type?: "text" | "number" | "date"
}

export function EditableCell({ row, column, type = "text" }: EditableCellProps) {
    const initialValue = row.getValue(column)
    const [value, setValue] = useState(initialValue)
    const [isEditing, setIsEditing] = useState(false)

    useEffect(() => {
        setValue(initialValue)
    }, [initialValue])

    const onBlur = async () => {
        setIsEditing(false)
        if (value === initialValue) return

        const deliveryItemId = row.original.deliveryItemId
        if (!deliveryItemId) {
            toast.error("Error: Missing Delivery Item ID")
            return
        }

        const promise = updateBillingRecord({
            deliveryItemId,
            [column]: type === "number" ? parseFloat(value as string) : value
        })

        toast.promise(promise, {
            loading: "Updating...",
            success: "Record updated",
            error: "Failed to update record"
        })
    }

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault()
            e.currentTarget.blur()
        }
    }

    if (isEditing) {
        return (
            <Input
                value={value as string || ""}
                onChange={e => setValue(e.target.value)}
                onBlur={onBlur}
                onKeyDown={onKeyDown}
                type={type}
                autoFocus
                className="h-8 w-full"
            />
        )
    }

    return (
        <div
            className={cn(
                "h-8 flex items-center px-2 rounded hover:bg-muted cursor-pointer truncate min-h-[2rem]",
                !value && "text-muted-foreground italic"
            )}
            onClick={() => setIsEditing(true)}
        >
            {type === "date" && value ? new Date(value as string).toLocaleDateString() : (value || "-")}
        </div>
    )
}
