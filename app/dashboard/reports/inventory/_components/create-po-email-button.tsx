"use client"

import { useTransition } from "react"
import { ShoppingCart } from "lucide-react"
import { toast } from "sonner"
import { sendInventoryProcurementRequest } from "@/app/actions/inventory-procurement"

export function CreatePoEmailButton({ stockLevelId }: { stockLevelId: number }) {
    const [isPending, startTransition] = useTransition()

    return (
        <button
            type="button"
            onClick={() => {
                startTransition(async () => {
                    const result = await sendInventoryProcurementRequest({ stockLevelId })
                    if (result.success) {
                        toast.success(result.message || "Email procurement berhasil dikirim.")
                        return
                    }

                    toast.error(result.error || "Email procurement gagal dikirim.")
                })
            }}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
            <ShoppingCart className="h-3.5 w-3.5" />
            {isPending ? "Sending..." : "Create PO"}
        </button>
    )
}
