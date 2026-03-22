"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { FileDown, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { postSettlement, submitSettlement } from "@/app/actions/cost-settlement"

export function SettlementActions({
    settlementId,
    status,
}: {
    settlementId: number
    status: "draft" | "submitted" | "approved" | "rejected" | "posted"
}) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()

    const onSubmitApproval = () => {
        startTransition(async () => {
            try {
                const result = await submitSettlement(settlementId)
                if (!result.success) {
                    toast.error(result.error || "Gagal submit settlement")
                    return
                }
                toast.success(result.approvalSkipped ? "Settlement disubmit tanpa workflow approval aktif" : "Settlement berhasil disubmit ke approval")
                router.refresh()
            } catch (_error) {
                toast.error("Gagal submit settlement")
            }
        })
    }

    const onPost = () => {
        startTransition(async () => {
            try {
                const result = await postSettlement(settlementId)
                if (!result.success) {
                    toast.error(result.error || "Gagal post settlement")
                    return
                }
                toast.success("Settlement berhasil di-post")
                router.refresh()
            } catch (_error) {
                toast.error("Gagal post settlement")
            }
        })
    }

    return (
        <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="outline" asChild>
                <a href={`/api/settlements/${settlementId}/export`}>
                    <FileDown className="mr-2 h-4 w-4" />
                    Export RPA (ZIP)
                </a>
            </Button>

            {status === "draft" ? (
                <Button type="button" onClick={onSubmitApproval} disabled={isPending}>
                    {isPending ? "Memproses..." : "Submit Approval"}
                </Button>
            ) : null}

            {(status === "submitted" || status === "approved") ? (
                <Button type="button" variant="outline" onClick={onPost} disabled={isPending}>
                    {isPending ? "Memproses..." : "Mark as Posted"}
                </Button>
            ) : null}
        </div>
    )
}
