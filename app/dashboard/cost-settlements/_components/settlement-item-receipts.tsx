"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Paperclip } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { uploadSettlementReceipt } from "@/app/actions/cost-settlement"

type SettlementItemReceipt = {
    id: number
    fileUrl: string
    originalFileName: string
    fileSize: number
}

type SettlementItem = {
    id: number
    description: string
    costCategory: "gasoline" | "toll" | "parking" | "meals" | "maintenance" | "others"
    amount: string
    receipts: SettlementItemReceipt[]
}


const formatCurrency = (value: string | number) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(Number(value ?? 0))

const formatBytes = (size: number) => {
    if (!size || size < 1024) return `${size || 0} B`
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function SettlementItemReceipts({
    items,
    canUpload,
}: {
    items: SettlementItem[]
    canUpload: boolean
}) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [uploadingItemId, setUploadingItemId] = useState<number | null>(null)
    const inputRefs = useRef<Record<number, HTMLInputElement | null>>({})

    const triggerUpload = (itemId: number) => {
        inputRefs.current[itemId]?.click()
    }

    const onFilesSelected = (itemId: number, files: FileList | null) => {
        if (!files || files.length === 0) {
            return
        }

        startTransition(async () => {
            setUploadingItemId(itemId)

            let successCount = 0
            for (const file of Array.from(files)) {
                const formData = new FormData()
                formData.set("settlementItemId", String(itemId))
                formData.set("file", file)

                const result = await uploadSettlementReceipt(formData)
                if (result.success) {
                    successCount += 1
                } else {
                    toast.error(result.error || `Upload gagal: ${file.name}`)
                }
            }

            if (successCount > 0) {
                toast.success(`${successCount} nota berhasil diupload`)
                router.refresh()
            }

            setUploadingItemId(null)
            const input = inputRefs.current[itemId]
            if (input) {
                input.value = ""
            }
        })
    }

    if (items.length === 0) {
        return <p className="text-muted-foreground">Belum ada item settlement.</p>
    }

    return (
        <div className="space-y-3 text-sm">
            {items.map((item) => (
                <div key={item.id} className="rounded-md border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                            <p className="font-medium">{item.description}</p>
                            <p className="text-muted-foreground">
                                {item.costCategory} - {formatCurrency(item.amount)}
                            </p>
                        </div>
                        {canUpload ? (
                            <>
                                <input
                                    ref={(el) => {
                                        inputRefs.current[item.id] = el
                                    }}
                                    type="file"
                                    accept="image/*,.pdf"
                                    multiple
                                    className="hidden"
                                    onChange={(event) => onFilesSelected(item.id, event.target.files)}
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={isPending && uploadingItemId === item.id}
                                    onClick={() => triggerUpload(item.id)}
                                >
                                    <Paperclip className="mr-2 size-4" />
                                    {isPending && uploadingItemId === item.id ? "Uploading..." : "Upload Nota"}
                                </Button>
                            </>
                        ) : null}
                    </div>

                    <div className="mt-3 space-y-1">
                        {item.receipts.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Belum ada nota.</p>
                        ) : (
                            item.receipts.map((receipt) => (
                                <a
                                    key={receipt.id}
                                    href={receipt.fileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block text-xs text-primary hover:underline"
                                >
                                    {receipt.originalFileName} ({formatBytes(receipt.fileSize)})
                                </a>
                            ))
                        )}
                    </div>
                </div>
            ))}
        </div>
    )
}
