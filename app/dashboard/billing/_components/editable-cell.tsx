"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { updateBillingRecord, trackJneResi } from "@/app/actions/billing"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { normalizeCodeValue } from "@/lib/formatters"
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ClipboardPaste } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { BillingRecordDisplay } from "@/lib/types"

interface EditableCellProps {
    row: {
        getValue: (column: string) => unknown;
        original: BillingRecordDisplay;
    }
    column: string
    type?: "text" | "number" | "date" | "select"
    options?: string[]
    tableMeta?: any
    rowIndex?: number
}

export function EditableCell({ row, column, type = "text", options, tableMeta, rowIndex }: EditableCellProps) {
    const initialValue = row.getValue(column)
    const [value, setValue] = useState(initialValue)
    const [isEditing, setIsEditing] = useState(false)

    useEffect(() => {
        setValue(initialValue)
    }, [initialValue])

    const onBlur = async () => {
        setIsEditing(false)
        if (value === initialValue) return

        const poNo = row.original.poNo
        if (!poNo) {
            toast.error("Error: Missing PO No")
            return
        }

        const finalValue = type === "number" ? parseFloat(value as string) : value
        const normalizedValue =
            (column === "noInvSap" || column === "nomorDoSap" || column === "plant")
                ? normalizeCodeValue(finalValue as string | number | null | undefined)
                : finalValue

        // Optimistic UI Update immediately
        if (tableMeta?.updateData) {
            tableMeta.updateData(poNo, column, normalizedValue)
        }

        // Auto-track JNE: jika kolom noResi & modeDelivery row ini JNE
        if (column === "noResi" && row.original.modeDelivery === "JNE" && finalValue && String(finalValue).trim().length >= 10) {
            const noResi = String(finalValue).trim()
            toast.promise(
                (async () => {
                    // Simpan noResi dulu
                    await updateBillingRecord({ poNo, noResi: finalValue as string })
                    // Lalu track
                    const result = await trackJneResi(noResi)
                    if (result.success && result.data) {
                        const updates = {
                            poNo,
                            statusDelivery: result.data.statusAction,
                            ...(result.data.receiverDate ? { receiverDate: result.data.receiverDate } : {})
                        }
                        // Update optimistic UI
                        if (tableMeta?.updateData) {
                            tableMeta.updateData(poNo, "statusDelivery", result.data.statusAction)
                            if (result.data.receiverDate) {
                                tableMeta.updateData(poNo, "receiverDate", result.data.receiverDate)
                            }
                        }
                        // Simpan ke DB
                        await updateBillingRecord(updates)
                        return result.data.statusAction
                    } else {
                        throw new Error(result.error || "Tracking gagal")
                    }
                })(),
                {
                    loading: "Tracking resi JNE...",
                    success: (status) => `JNE: ${status}`,
                    error: (err) => err.message || "Gagal tracking resi"
                }
            )
            return // Sudah di-handle di atas termasuk save noResi
        }

        const promise = updateBillingRecord({
            poNo,
            [column]: normalizedValue
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
                ; (e.currentTarget as HTMLElement).blur()
        }
    }

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement | HTMLSelectElement>) => {
        const pastedText = e.clipboardData.getData("text")
        if (!pastedText) return

        // Cek jika teks mengandung newline, berarti user mem-paste banyak baris dari Excel/sejenisnya
        if (pastedText.includes("\n") || pastedText.includes("\r")) {
            e.preventDefault()
            const values = pastedText.split(/\r?\n/).map(v => v.trim()).filter(v => v !== "")

            // Panggil method mass-update di level tableMeta jika tersedia
            if (row.original.poNo && tableMeta?.onMassUpdate && rowIndex !== undefined) {
                tableMeta.onMassUpdate(rowIndex, column, values)
                setIsEditing(false) // tutup input saat paste tereksekusi
            } else {
                // Fallback, hanya set input pertama jika tabel tidak mem-support massUpdate
                setValue(values[0])
            }
        }
    }

    const handleDirectPaste = async (e: React.MouseEvent) => {
        e.stopPropagation() // Cegah trigger onClick edit mode
        try {
            const pastedText = await navigator.clipboard.readText()
            if (!pastedText) return

            const values = pastedText.split(/\r?\n/).map(v => v.trim()).filter(v => v !== "")

            if (row.original.poNo && tableMeta?.onMassUpdate && rowIndex !== undefined) {
                tableMeta.onMassUpdate(rowIndex, column, values)
            } else {
                // Fallback update individual jika onMassUpdate tidak aktif
                const finalValue = type === "number" ? parseFloat(values[0]) : values[0]
                const normalizedValue =
                    (column === "noInvSap" || column === "nomorDoSap" || column === "plant")
                        ? normalizeCodeValue(finalValue as string | number | null | undefined)
                        : finalValue

                if (tableMeta?.updateData) tableMeta.updateData(row.original.poNo!, column, normalizedValue)
                updateBillingRecord({ poNo: row.original.poNo!, [column]: normalizedValue })
                setValue(values[0])
            }
        } catch (_err) {
            toast.error("Gagal membaca dari Clipboard. Pastikan telah memberi Izin Akses Clipboard Browser.")
        }
    }

    if (isEditing) {
        if (type === "select" && options) {
            const listId = `dl-${column}-${row.original.poNo}`
            return (
                <>
                    <input
                        list={listId}
                        value={value as string || ""}
                        onChange={e => setValue(e.target.value)}
                        onBlur={onBlur}
                        onKeyDown={onKeyDown}
                        autoFocus
                        placeholder="Pilih atau ketik baru..."
                        className="h-8 w-full rounded border border-input bg-transparent px-2 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                    <datalist id={listId}>
                        {options.map(opt => (
                            <option key={opt} value={opt} />
                        ))}
                    </datalist>
                </>
            )
        }

        return (
            <Input
                value={value as string || ""}
                onChange={e => setValue(e.target.value)}
                onBlur={onBlur}
                onKeyDown={onKeyDown}
                onPaste={handlePaste}
                type={type}
                autoFocus
                className="h-8 w-full"
            />
        )
    }

    return (
        <div
            className={cn(
                "group relative flex h-8 min-h-[2rem] w-full cursor-pointer items-center justify-between truncate rounded px-2 hover:bg-muted",
                !value && "text-muted-foreground italic"
            )}
            onClick={() => setIsEditing(true)}
        >
            <span className="truncate pr-6">
                {type === "date" && value
                    ? new Date(value as string).toLocaleDateString()
                    : value == null || value === ""
                        ? "-"
                        : String(value)}
            </span>
            <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 h-6 w-6 opacity-0 transition-opacity bg-background/80 hover:bg-background group-hover:opacity-100 shadow-sm"
                onClick={handleDirectPaste}
                title="Paste isi Clipboard ke sel ini"
            >
                <ClipboardPaste className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
        </div>
    )
}
