"use client"

import { useTransition, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { submitApprovalDecision, revertApprovalRequest } from "@/app/actions/approval"
import { validateNotePolicy } from "@/app/dashboard/approvals/_lib/utils"

type ActionPanelProps = {
  requestId: string
  requestStatus: "pending" | "approved" | "rejected" | "cancelled"
  requesterId: string
  currentUserId: string
  isAssignedApprover: boolean
  assignmentId: string | null
  workflowNotePolicy: "optional" | "required_on_approve" | "required_on_reject" | "required_always"
  hasAnyApproverDecision: boolean
}

export function ActionPanel({
  requestId,
  requestStatus,
  requesterId,
  currentUserId,
  isAssignedApprover,
  assignmentId,
  workflowNotePolicy,
  hasAnyApproverDecision,
}: ActionPanelProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [comment, setComment] = useState("")
  const [commentError, setCommentError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  const showApproveReject = isAssignedApprover && requestStatus === "pending"
  const showRevert =
    currentUserId === requesterId &&
    requestStatus === "pending" &&
    !hasAnyApproverDecision

  function validateComment(action: "approve" | "reject"): boolean {
    const valid = validateNotePolicy(workflowNotePolicy, comment, action)
    if (!valid) {
      setCommentError("Komentar wajib diisi untuk aksi ini.")
      return false
    }
    setCommentError(null)
    return true
  }

  function handleDecision(decision: "approve" | "reject") {
    if (!validateComment(decision)) return
    if (!assignmentId) return

    setServerError(null)
    startTransition(async () => {
      const formData = new FormData()
      formData.set("assignmentId", assignmentId)
      formData.set("decision", decision)
      formData.set("comment", comment)

      const result = await submitApprovalDecision(formData)
      if (result && !result.success) {
        setServerError(result.error ?? "Terjadi kesalahan.")
        return
      }
      router.refresh()
    })
  }

  function handleRevert() {
    const confirmed = window.confirm(
      "Apakah Anda yakin ingin menarik kembali (revert) request ini? Tindakan ini tidak dapat dibatalkan."
    )
    if (!confirmed) return

    setServerError(null)
    startTransition(async () => {
      const result = await revertApprovalRequest(requestId)
      if (!result.success) {
        setServerError(result.error ?? "Terjadi kesalahan.")
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {/* Comment textarea — always visible */}
      <div className="space-y-1">
        <label htmlFor="action-comment" className="text-sm font-medium">
          Komentar
        </label>
        <Textarea
          id="action-comment"
          placeholder="Tambahkan komentar (opsional atau wajib sesuai kebijakan workflow)..."
          value={comment}
          onChange={(e) => {
            setComment(e.target.value)
            if (commentError) setCommentError(null)
          }}
          disabled={isPending}
          rows={3}
          aria-describedby={commentError ? "comment-error" : undefined}
        />
        {commentError && (
          <p id="comment-error" className="text-sm text-destructive">
            {commentError}
          </p>
        )}
      </div>

      {/* Server error */}
      {serverError && (
        <p className="text-sm text-destructive rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
          {serverError}
        </p>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {showApproveReject && (
          <>
            <Button
              onClick={() => handleDecision("approve")}
              disabled={isPending}
              className="flex-1"
              aria-label="Setujui request ini"
            >
              {isPending ? "Memproses..." : "Approve"}
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleDecision("reject")}
              disabled={isPending}
              className="flex-1"
              aria-label="Tolak request ini"
            >
              {isPending ? "Memproses..." : "Reject"}
            </Button>
          </>
        )}

        {showRevert && (
          <Button
            variant="outline"
            onClick={handleRevert}
            disabled={isPending}
            className="w-full"
            aria-label="Tarik kembali request ini"
          >
            {isPending ? "Memproses..." : "Revert"}
          </Button>
        )}

        {!showApproveReject && !showRevert && (
          <p className="text-sm text-muted-foreground">
            Tidak ada aksi yang tersedia untuk request ini.
          </p>
        )}
      </div>
    </div>
  )
}
