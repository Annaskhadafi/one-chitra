"use client"

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export type ActionBlockedDetails = {
    title: string
    description: string
    reasons?: string[]
}

interface ActionBlockedDialogProps extends ActionBlockedDetails {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function ActionBlockedDialog({
    open,
    onOpenChange,
    title,
    description,
    reasons = [],
}: ActionBlockedDialogProps) {
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                        <div className="space-y-3 text-sm text-muted-foreground">
                            <p>{description}</p>
                            {reasons.length > 0 && (
                                <ul className="list-disc space-y-1 pl-5 text-foreground">
                                    {reasons.map((reason, index) => (
                                        <li key={`${reason}-${index}`}>{reason}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogAction>OK</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
