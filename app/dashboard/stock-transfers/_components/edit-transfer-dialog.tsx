"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { updateStockTransfer } from "@/app/actions/stock-transfer"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

interface Transfer {
    id: number
    referenceNumber: string | null
    postingDocumentNo: string | null
    batchNo: string | null
    notes: string | null
    receivedStatus: "Scheduled" | "Received" | "Rejected"
}

interface EditTransferDialogProps {
    transfer: Transfer | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function EditTransferDialog({ transfer, open, onOpenChange }: EditTransferDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [formData, setFormData] = useState({
        postingDocumentNo: "",
        batchNo: "",
        notes: "",
        receivedStatus: "Scheduled" as "Scheduled" | "Received" | "Rejected",
    })

    // Update form when transfer changes
    useEffect(() => {
        if (transfer) {
            setFormData({
                postingDocumentNo: transfer.postingDocumentNo || "",
                batchNo: transfer.batchNo || "",
                notes: transfer.notes || "",
                receivedStatus: transfer.receivedStatus,
            })
        }
    }, [transfer])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!transfer) return

        setIsSubmitting(true)
        try {
            const result = await updateStockTransfer(transfer.id, formData)
            
            if (result.success) {
                toast.success("Transfer updated successfully")
                onOpenChange(false)
            } else {
                toast.error(result.error || "Failed to update transfer")
            }
        } catch (error) {
            toast.error("An error occurred")
        } finally {
            setIsSubmitting(false)
        }
    }

    if (!transfer) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Edit Stock Transfer</DialogTitle>
                    <DialogDescription>
                        Update transfer details for {transfer.referenceNumber}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="postingDocumentNo">Posting Document No</Label>
                        <Input
                            id="postingDocumentNo"
                            value={formData.postingDocumentNo}
                            onChange={(e) => setFormData({ ...formData, postingDocumentNo: e.target.value })}
                            placeholder="Enter posting document number"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="batchNo">Batch No</Label>
                        <Input
                            id="batchNo"
                            value={formData.batchNo}
                            onChange={(e) => setFormData({ ...formData, batchNo: e.target.value })}
                            placeholder="Enter batch number"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="receivedStatus">Received Status</Label>
                        <Select
                            value={formData.receivedStatus}
                            onValueChange={(value: any) => setFormData({ ...formData, receivedStatus: value })}
                            disabled={transfer.receivedStatus === "Received"}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Scheduled">Scheduled</SelectItem>
                                <SelectItem value="Received">Received</SelectItem>
                                <SelectItem value="Rejected">Rejected</SelectItem>
                            </SelectContent>
                        </Select>
                        {transfer.receivedStatus === "Received" && (
                            <p className="text-xs text-muted-foreground">
                                Cannot change status of received transfer
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                            id="notes"
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Enter notes"
                            rows={3}
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Changes
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
