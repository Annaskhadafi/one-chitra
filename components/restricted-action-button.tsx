"use client"

import { useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { ActionBlockedDialog, type ActionBlockedDetails } from "@/components/action-blocked-dialog"

interface RestrictedActionButtonProps extends ActionBlockedDetails {
    children: ReactNode
    className?: string
    size?: React.ComponentProps<typeof Button>["size"]
    variant?: React.ComponentProps<typeof Button>["variant"]
}

export function RestrictedActionButton({
    children,
    className,
    size = "default",
    variant = "default",
    title,
    description,
    reasons,
}: RestrictedActionButtonProps) {
    const [open, setOpen] = useState(false)

    return (
        <>
            <Button
                type="button"
                variant={variant}
                size={size}
                className={className}
                onClick={() => setOpen(true)}
            >
                {children}
            </Button>
            <ActionBlockedDialog
                open={open}
                onOpenChange={setOpen}
                title={title}
                description={description}
                reasons={reasons}
            />
        </>
    )
}
