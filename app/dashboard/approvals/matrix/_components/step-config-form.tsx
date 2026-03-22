"use client"

import { useState, useTransition } from "react"
import { Plus, Trash2 } from "lucide-react"

import { addWorkflowStep, updateWorkflowStep } from "@/app/actions/approval"
import type { UIStepType } from "@/app/dashboard/approvals/_lib/types"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

// ─── Types ────────────────────────────────────────────────────────────────────

type InputField = {
  key: string
  label: string
  type: "text" | "number" | "date" | "select"
  required: boolean
}

type StepConfigFormProps =
  | {
      open: boolean
      onOpenChange: (open: boolean) => void
      onSuccess: () => void
      mode: "add"
      definitionId: string
      stepType: UIStepType
      stepId?: never
      initialConfig?: never
    }
  | {
      open: boolean
      onOpenChange: (open: boolean) => void
      onSuccess: () => void
      mode: "edit"
      stepId: number
      stepType: UIStepType
      definitionId?: never
      initialConfig?: Record<string, unknown>
    }

// ─── Field error display ──────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-sm text-destructive">{message}</p>
}

// ─── StepConfigForm ───────────────────────────────────────────────────────────

export function StepConfigForm(props: StepConfigFormProps) {
  const { open, onOpenChange, onSuccess, stepType } = props

  const init = props.mode === "edit" ? (props.initialConfig ?? {}) : {}

  // ── Common field ──────────────────────────────────────────────────────────
  const [stepName, setStepName] = useState<string>((init.stepName as string) ?? "")

  // ── Approval fields ───────────────────────────────────────────────────────
  const [approverType, setApproverType] = useState<"role" | "user">(
    (init.approverType as "role" | "user") ?? "role"
  )
  const [approverRole, setApproverRole] = useState<string>((init.approverRole as string) ?? "")
  const [approverUserId, setApproverUserId] = useState<string>(
    (init.approverUserId as string) ?? ""
  )
  const [minApprovals, setMinApprovals] = useState<number>(
    typeof init.minApprovals === "number" ? init.minApprovals : 1
  )
  const [workflowNotePolicy, setWorkflowNotePolicy] = useState<
    "optional" | "required_on_approve" | "required_on_reject" | "required_always"
  >(
    (init.workflowNotePolicy as
      | "optional"
      | "required_on_approve"
      | "required_on_reject"
      | "required_always") ?? "optional"
  )

  // ── Notification fields ───────────────────────────────────────────────────
  const [recipients, setRecipients] = useState<string>(
    Array.isArray(init.recipients) ? (init.recipients as string[]).join(", ") : ""
  )
  const [messageTemplate, setMessageTemplate] = useState<string>(
    (init.messageTemplate as string) ?? ""
  )

  // ── Update User fields ────────────────────────────────────────────────────
  const [targetField, setTargetField] = useState<string>((init.targetField as string) ?? "")
  const [newValue, setNewValue] = useState<string>((init.newValue as string) ?? "")

  // ── User Input fields ─────────────────────────────────────────────────────
  const [inputFields, setInputFields] = useState<InputField[]>(() => {
    if (Array.isArray(init.inputFields) && init.inputFields.length > 0) {
      return init.inputFields as InputField[]
    }
    return [{ key: "", label: "", type: "text", required: false }]
  })

  // ── Errors ────────────────────────────────────────────────────────────────
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)

  const [isPending, startTransition] = useTransition()

  // ── Validation ────────────────────────────────────────────────────────────

  function validate(): boolean {
    const next: Record<string, string> = {}

    if (!stepName.trim()) next.stepName = "Nama step wajib diisi."

    if (stepType === "approval") {
      if (approverType === "role" && !approverRole.trim()) {
        next.approverRole = "Approver role wajib diisi."
      }
      if (approverType === "user" && !approverUserId.trim()) {
        next.approverUserId = "Approver user ID wajib diisi."
      }
      if (!minApprovals || minApprovals < 1) {
        next.minApprovals = "Minimum approval harus minimal 1."
      }
    }

    if (stepType === "notification") {
      if (!recipients.trim()) next.recipients = "Penerima wajib diisi."
      if (!messageTemplate.trim()) next.messageTemplate = "Template pesan wajib diisi."
    }

    if (stepType === "update_user") {
      if (!targetField.trim()) next.targetField = "Target field wajib diisi."
      if (!newValue.trim()) next.newValue = "Nilai baru wajib diisi."
    }

    if (stepType === "user_input") {
      if (inputFields.length === 0) {
        next.inputFields = "Minimal satu input field diperlukan."
      } else {
        inputFields.forEach((f, i) => {
          if (!f.key.trim()) next[`inputFields.${i}.key`] = "Key wajib diisi."
          if (!f.label.trim()) next[`inputFields.${i}.label`] = "Label wajib diisi."
        })
      }
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  // ── Build config ──────────────────────────────────────────────────────────

  function buildConfig(): Record<string, unknown> {
    const base = { stepName: stepName.trim() }

    if (stepType === "approval") {
      return {
        ...base,
        nodeKind: "approvalStep",
        approverType,
        approverRole: approverType === "role" ? approverRole.trim() : undefined,
        approverUserId: approverType === "user" ? approverUserId.trim() : undefined,
        minApprovals,
        workflowNotePolicy,
      }
    }

    if (stepType === "notification") {
      return {
        ...base,
        nodeKind: "notifyNode",
        recipients: recipients
          .split(",")
          .map((r) => r.trim())
          .filter(Boolean),
        messageTemplate: messageTemplate.trim(),
      }
    }

    if (stepType === "update_user") {
      return {
        ...base,
        nodeKind: "updateUserNode",
        targetField: targetField.trim(),
        newValue: newValue.trim(),
      }
    }

    // user_input
    return {
      ...base,
      nodeKind: "userInputNode",
      inputFields: inputFields.map((f) => ({
        key: f.key.trim(),
        label: f.label.trim(),
        type: f.type,
        required: f.required,
      })),
    }
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  function handleSubmit() {
    if (!validate()) return

    setServerError(null)
    const config = buildConfig()

    startTransition(async () => {
      let result
      if (props.mode === "add") {
        result = await addWorkflowStep(props.definitionId, stepType, config)
      } else {
        result = await updateWorkflowStep(props.stepId, config)
      }

      if (!result.success) {
        setServerError(result.error ?? "Terjadi kesalahan. Silakan coba lagi.")
        return
      }

      onSuccess()
      onOpenChange(false)
    })
  }

  // ── Input field helpers ───────────────────────────────────────────────────

  function updateInputField<K extends keyof InputField>(
    index: number,
    key: K,
    value: InputField[K]
  ) {
    setInputFields((prev) => prev.map((f, i) => (i === index ? { ...f, [key]: value } : f)))
  }

  function addInputField() {
    setInputFields((prev) => [
      ...prev,
      { key: "", label: "", type: "text", required: false },
    ])
  }

  function removeInputField(index: number) {
    setInputFields((prev) => prev.filter((_, i) => i !== index))
  }

  // ── Title per step type ───────────────────────────────────────────────────

  const titleMap: Record<UIStepType, string> = {
    approval: "Konfigurasi Step Approval",
    notification: "Konfigurasi Step Notification",
    update_user: "Konfigurasi Step Update User",
    user_input: "Konfigurasi Step User Input",
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{titleMap[stepType]}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* ── Common: Step Name ── */}
          <div className="space-y-1">
            <Label htmlFor="stepName">Nama Step *</Label>
            <Input
              id="stepName"
              value={stepName}
              onChange={(e) => setStepName(e.target.value)}
              placeholder="Contoh: Review Manager"
              disabled={isPending}
            />
            <FieldError message={errors.stepName} />
          </div>

          {/* ── Approval fields ── */}
          {stepType === "approval" && (
            <>
              <div className="space-y-2">
                <Label>Tipe Approver *</Label>
                <RadioGroup
                  value={approverType}
                  onValueChange={(v) => setApproverType(v as "role" | "user")}
                  className="flex gap-4"
                  disabled={isPending}
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="role" id="approverType-role" />
                    <Label htmlFor="approverType-role" className="font-normal cursor-pointer">
                      Role
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="user" id="approverType-user" />
                    <Label htmlFor="approverType-user" className="font-normal cursor-pointer">
                      User Spesifik
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {approverType === "role" && (
                <div className="space-y-1">
                  <Label htmlFor="approverRole">Approver Role *</Label>
                  <Input
                    id="approverRole"
                    value={approverRole}
                    onChange={(e) => setApproverRole(e.target.value)}
                    placeholder="Contoh: manager"
                    disabled={isPending}
                  />
                  <FieldError message={errors.approverRole} />
                </div>
              )}

              {approverType === "user" && (
                <div className="space-y-1">
                  <Label htmlFor="approverUserId">Approver User ID *</Label>
                  <Input
                    id="approverUserId"
                    value={approverUserId}
                    onChange={(e) => setApproverUserId(e.target.value)}
                    placeholder="Contoh: user-123"
                    disabled={isPending}
                  />
                  <FieldError message={errors.approverUserId} />
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor="minApprovals">Minimum Approval *</Label>
                <Input
                  id="minApprovals"
                  type="number"
                  min={1}
                  value={minApprovals}
                  onChange={(e) => setMinApprovals(Number(e.target.value))}
                  disabled={isPending}
                />
                <FieldError message={errors.minApprovals} />
              </div>

              <div className="space-y-1">
                <Label htmlFor="workflowNotePolicy">Kebijakan Komentar</Label>
                <Select
                  value={workflowNotePolicy}
                  onValueChange={(v) =>
                    setWorkflowNotePolicy(
                      v as
                        | "optional"
                        | "required_on_approve"
                        | "required_on_reject"
                        | "required_always"
                    )
                  }
                  disabled={isPending}
                >
                  <SelectTrigger id="workflowNotePolicy">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="optional">Opsional</SelectItem>
                    <SelectItem value="required_on_approve">Wajib saat Approve</SelectItem>
                    <SelectItem value="required_on_reject">Wajib saat Reject</SelectItem>
                    <SelectItem value="required_always">Selalu Wajib</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* ── Notification fields ── */}
          {stepType === "notification" && (
            <>
              <div className="space-y-1">
                <Label htmlFor="recipients">Penerima * (pisahkan dengan koma)</Label>
                <Textarea
                  id="recipients"
                  value={recipients}
                  onChange={(e) => setRecipients(e.target.value)}
                  placeholder="Contoh: admin@example.com, manager"
                  rows={2}
                  disabled={isPending}
                />
                <FieldError message={errors.recipients} />
              </div>

              <div className="space-y-1">
                <Label htmlFor="messageTemplate">Template Pesan *</Label>
                <Textarea
                  id="messageTemplate"
                  value={messageTemplate}
                  onChange={(e) => setMessageTemplate(e.target.value)}
                  placeholder="Contoh: Request {{requestId}} telah disetujui."
                  rows={4}
                  disabled={isPending}
                />
                <FieldError message={errors.messageTemplate} />
              </div>
            </>
          )}

          {/* ── Update User fields ── */}
          {stepType === "update_user" && (
            <>
              <div className="space-y-1">
                <Label htmlFor="targetField">Target Field *</Label>
                <Input
                  id="targetField"
                  value={targetField}
                  onChange={(e) => setTargetField(e.target.value)}
                  placeholder="Contoh: status atau {{snapshot.fieldKey}}"
                  disabled={isPending}
                />
                <FieldError message={errors.targetField} />
              </div>

              <div className="space-y-1">
                <Label htmlFor="newValue">Nilai Baru *</Label>
                <Input
                  id="newValue"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="Contoh: approved atau {{snapshot.value}}"
                  disabled={isPending}
                />
                <FieldError message={errors.newValue} />
              </div>
            </>
          )}

          {/* ── User Input fields ── */}
          {stepType === "user_input" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Input Fields * (minimal 1)</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addInputField}
                  disabled={isPending}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Tambah Field
                </Button>
              </div>

              <FieldError message={errors.inputFields} />

              {inputFields.map((field, index) => (
                <div
                  key={index}
                  className="rounded-md border border-border p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                      Field {index + 1}
                    </span>
                    {inputFields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeInputField(index)}
                        disabled={isPending}
                        aria-label={`Hapus field ${index + 1}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor={`field-key-${index}`} className="text-xs">
                        Key *
                      </Label>
                      <Input
                        id={`field-key-${index}`}
                        value={field.key}
                        onChange={(e) => updateInputField(index, "key", e.target.value)}
                        placeholder="field_key"
                        disabled={isPending}
                        className="h-8 text-sm"
                      />
                      <FieldError message={errors[`inputFields.${index}.key`]} />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor={`field-label-${index}`} className="text-xs">
                        Label *
                      </Label>
                      <Input
                        id={`field-label-${index}`}
                        value={field.label}
                        onChange={(e) => updateInputField(index, "label", e.target.value)}
                        placeholder="Nama Field"
                        disabled={isPending}
                        className="h-8 text-sm"
                      />
                      <FieldError message={errors[`inputFields.${index}.label`]} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 items-end">
                    <div className="space-y-1">
                      <Label htmlFor={`field-type-${index}`} className="text-xs">
                        Tipe
                      </Label>
                      <Select
                        value={field.type}
                        onValueChange={(v) =>
                          updateInputField(index, "type", v as InputField["type"])
                        }
                        disabled={isPending}
                      >
                        <SelectTrigger id={`field-type-${index}`} className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="number">Number</SelectItem>
                          <SelectItem value="date">Date</SelectItem>
                          <SelectItem value="select">Select</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center gap-2 pb-1">
                      <Checkbox
                        id={`field-required-${index}`}
                        checked={field.required}
                        onCheckedChange={(checked) =>
                          updateInputField(index, "required", checked === true)
                        }
                        disabled={isPending}
                      />
                      <Label
                        htmlFor={`field-required-${index}`}
                        className="text-xs font-normal cursor-pointer"
                      >
                        Wajib diisi
                      </Label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Server error ── */}
          {serverError && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {serverError}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Menyimpan..." : props.mode === "add" ? "Tambah Step" : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
