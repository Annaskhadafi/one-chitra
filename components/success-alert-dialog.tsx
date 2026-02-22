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
import { CheckCircle2 } from "lucide-react"

interface SuccessAlertDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    title?: string
    description?: string
}

export function SuccessAlertDialog({
    open,
    onOpenChange,
    title = "Selesai",
    description = "Aksi berhasil dilakukan.",
}: SuccessAlertDialogProps) {
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent className="sm:max-w-[425px]">
                <AlertDialogHeader className="flex flex-col items-center justify-center pt-6 text-center">
                    <div className="flex aspect-square size-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                        <CheckCircle2 className="size-10 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <AlertDialogTitle className="mt-6 text-xl text-emerald-900 dark:text-emerald-100">
                        {title}
                    </AlertDialogTitle>
                    <AlertDialogDescription className="mt-2 text-center text-slate-600 dark:text-slate-400">
                        {description}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="sm:justify-center">
                    <AlertDialogAction
                        className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[120px]"
                    >
                        Tutup
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
