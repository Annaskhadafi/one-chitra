"use client"

import { useEffect, useRef, useState } from "react"
import { X, Bell, Mail, Clock, Users, UserCheck, GitBranch, Zap, Timer, CheckCheck, Funnel, Workflow, AlarmClockCheck, PauseCircle, Ban, SplitSquareVertical, CalendarClock, Paperclip, UserRoundCog } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

type User = {
    id: string
    name: string | null
    email: string
    role: string | null
}

type StepConfigPanelProps = {
    nodeId: string
    nodeType: string
    data: { stepName?: string }
    rawData: Record<string, unknown>
    formFieldOptions?: string[]
    formFieldMetaOptions?: ApprovalFormFieldOption[]
    subWorkflowOptions?: SubWorkflowOption[]
    users: User[]
    onUpdate: (nodeId: string, data: Record<string, unknown>) => void
    onDelete: (nodeId: string) => void
    onClose: () => void
}

type ApprovalFieldDataType = "string" | "number" | "date" | "boolean" | "array"
type ApprovalFormFieldOption = { key: string; dataType: ApprovalFieldDataType }
type SubWorkflowOption = {
    id: string
    name: string
    formKey: string
    status: "draft" | "active" | "archived"
    version: number
}

const NODE_TYPE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
    approvalStep: { label: "Approval Step", icon: UserCheck, color: "text-primary" },
    parallelApprovalNode: { label: "Parallel Approval", icon: Users, color: "text-indigo-500" },
    conditionNode: { label: "Condition", icon: GitBranch, color: "text-amber-500" },
    conditionByFieldNode: { label: "Condition By Field", icon: Funnel, color: "text-cyan-500" },
    notifyNode: { label: "Notify Only", icon: Bell, color: "text-blue-500" },
    autoApproveNode: { label: "Auto Approve", icon: Zap, color: "text-violet-500" },
    delayNode: { label: "Delay / Timer", icon: Timer, color: "text-orange-500" },
    subWorkflowNode: { label: "Sub Workflow", icon: Workflow, color: "text-fuchsia-500" },
    deadlineBranchNode: { label: "Deadline Branch", icon: AlarmClockCheck, color: "text-red-500" },
    waitEventNode: { label: "Wait For Event", icon: PauseCircle, color: "text-sky-500" },
    cancelNode: { label: "Cancel / Terminate", icon: Ban, color: "text-zinc-500" },
    switchNode: { label: "Switch / Case", icon: SplitSquareVertical, color: "text-teal-500" },
    businessDelayNode: { label: "Business Delay", icon: CalendarClock, color: "text-lime-600" },
    requiredAttachmentNode: { label: "Required Attachment", icon: Paperclip, color: "text-cyan-700" },
    dynamicRoleResolverNode: { label: "Dynamic Role Resolver", icon: UserRoundCog, color: "text-amber-700" },
}

type ComparisonOption = {
    value: string
    label: string
    needsValue: boolean
}

const COMPARISON_OPTIONS: Record<ApprovalFieldDataType, ComparisonOption[]> = {
    string: [
        { value: "exists", label: "exists", needsValue: false },
        { value: "not_exists", label: "does not exist", needsValue: false },
        { value: "is_empty", label: "is empty", needsValue: false },
        { value: "is_not_empty", label: "is not empty", needsValue: false },
        { value: "eq", label: "is equal to", needsValue: true },
        { value: "neq", label: "is not equal to", needsValue: true },
        { value: "contains", label: "contains", needsValue: true },
        { value: "not_contains", label: "does not contain", needsValue: true },
        { value: "starts_with", label: "starts with", needsValue: true },
        { value: "not_starts_with", label: "does not start with", needsValue: true },
        { value: "ends_with", label: "ends with", needsValue: true },
        { value: "not_ends_with", label: "does not end with", needsValue: true },
        { value: "regex", label: "matches regex", needsValue: true },
        { value: "not_regex", label: "does not match regex", needsValue: true },
    ],
    number: [
        { value: "exists", label: "exists", needsValue: false },
        { value: "not_exists", label: "does not exist", needsValue: false },
        { value: "is_empty", label: "is empty", needsValue: false },
        { value: "is_not_empty", label: "is not empty", needsValue: false },
        { value: "eq", label: "is equal to", needsValue: true },
        { value: "neq", label: "is not equal to", needsValue: true },
        { value: "gt", label: "is greater than", needsValue: true },
        { value: "lt", label: "is less than", needsValue: true },
        { value: "gte", label: "is greater than or equal to", needsValue: true },
        { value: "lte", label: "is less than or equal to", needsValue: true },
    ],
    date: [
        { value: "exists", label: "exists", needsValue: false },
        { value: "not_exists", label: "does not exist", needsValue: false },
        { value: "is_empty", label: "is empty", needsValue: false },
        { value: "is_not_empty", label: "is not empty", needsValue: false },
        { value: "eq", label: "is equal to", needsValue: true },
        { value: "neq", label: "is not equal to", needsValue: true },
        { value: "after", label: "is after", needsValue: true },
        { value: "before", label: "is before", needsValue: true },
        { value: "on_or_after", label: "is after or equal to", needsValue: true },
        { value: "on_or_before", label: "is before or equal to", needsValue: true },
    ],
    boolean: [
        { value: "exists", label: "exists", needsValue: false },
        { value: "not_exists", label: "does not exist", needsValue: false },
        { value: "is_empty", label: "is empty", needsValue: false },
        { value: "is_not_empty", label: "is not empty", needsValue: false },
        { value: "is_true", label: "is true", needsValue: false },
        { value: "is_false", label: "is false", needsValue: false },
        { value: "eq", label: "is equal to", needsValue: true },
        { value: "neq", label: "is not equal to", needsValue: true },
    ],
    array: [
        { value: "exists", label: "exists", needsValue: false },
        { value: "not_exists", label: "does not exist", needsValue: false },
        { value: "is_empty", label: "is empty", needsValue: false },
        { value: "is_not_empty", label: "is not empty", needsValue: false },
        { value: "contains", label: "contains", needsValue: true },
        { value: "not_contains", label: "does not contain", needsValue: true },
        { value: "len_eq", label: "length equal to", needsValue: true },
        { value: "len_neq", label: "length not equal to", needsValue: true },
        { value: "len_gt", label: "length greater than", needsValue: true },
        { value: "len_lt", label: "length less than", needsValue: true },
        { value: "len_gte", label: "length greater than or equal to", needsValue: true },
        { value: "len_lte", label: "length less than or equal to", needsValue: true },
    ],
}

function getDataTypeFromField(fieldMetaOptions: ApprovalFormFieldOption[] | undefined, fieldKey: string | undefined): ApprovalFieldDataType {
    const key = (fieldKey ?? "").trim()
    if (!key) return "string"
    const found = (fieldMetaOptions ?? []).find((field) => field.key === key)
    return found?.dataType ?? "string"
}

function getDefaultOperatorForType(dataType: ApprovalFieldDataType): string {
    if (dataType === "array") return "contains"
    return "eq"
}

function escapeHtml(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;")
}

function normalizeHtmlForEditor(value: string) {
    const raw = value.trim()
    if (!raw) return ""
    if (/<[a-z][\s\S]*>/i.test(raw)) return value
    return escapeHtml(value).replace(/\n/g, "<br>")
}

type NotifyMessageEditorProps = {
    value: string
    onChange: (html: string) => void
}

function NotifyMessageEditor({ value, onChange }: NotifyMessageEditorProps) {
    const editorRef = useRef<HTMLDivElement | null>(null)
    const [html, setHtml] = useState(() => normalizeHtmlForEditor(value))

    useEffect(() => {
        const next = normalizeHtmlForEditor(value)
        setHtml(next)
        if (editorRef.current && editorRef.current.innerHTML !== next) {
            editorRef.current.innerHTML = next
        }
    }, [value])

    const runCommand = (command: string, commandValue?: string) => {
        editorRef.current?.focus()
        document.execCommand(command, false, commandValue)
        const nextHtml = editorRef.current?.innerHTML ?? ""
        setHtml(nextHtml)
        onChange(nextHtml)
    }

    const insertLink = () => {
        const url = window.prompt("Masukkan URL", "https://")
        if (!url) return
        runCommand("createLink", url)
    }

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/20 p-1">
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => runCommand("bold")}>B</Button>
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs italic" onClick={() => runCommand("italic")}>I</Button>
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs underline" onClick={() => runCommand("underline")}>U</Button>
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => runCommand("insertUnorderedList")}>• List</Button>
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => runCommand("insertOrderedList")}>1. List</Button>
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={insertLink}>Link</Button>
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => runCommand("removeFormat")}>Clear</Button>
            </div>
            <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={(e) => {
                    const nextHtml = e.currentTarget.innerHTML
                    setHtml(nextHtml)
                    onChange(nextHtml)
                }}
                className="min-h-[120px] rounded-md border bg-background px-3 py-2 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
                data-placeholder="Tulis pesan yang akan dikirim..."
                style={{ whiteSpace: "pre-wrap" }}
            />
            {!html.replace(/<[^>]+>/g, "").trim() && (
                <p className="text-[10px] text-muted-foreground">Tip: gunakan toolbar untuk format teks sebelum email dikirim.</p>
            )}
        </div>
    )
}

export function StepConfigPanel({ nodeId, nodeType, data: _data, rawData, formFieldOptions, formFieldMetaOptions, subWorkflowOptions, users, onUpdate, onDelete, onClose }: StepConfigPanelProps) {
    const update = (patch: Record<string, unknown>) => onUpdate(nodeId, patch)
    const meta = NODE_TYPE_META[nodeType] ?? NODE_TYPE_META.approvalStep
    const MetaIcon = meta.icon
    const parallelApproverUserIds = Array.isArray(rawData.approverUserIds)
        ? rawData.approverUserIds.filter((value): value is string => typeof value === "string")
        : []

    const expectedParallelApprovers = Math.max(1, Number(rawData.expectedApprovers ?? 2))
    const conditionDataType = (rawData.conditionDataType as ApprovalFieldDataType | undefined)
        ?? getDataTypeFromField(formFieldMetaOptions, rawData.conditionField as string | undefined)
    const conditionOperators = COMPARISON_OPTIONS[conditionDataType]
    const conditionOperator = (rawData.conditionOperator as string | undefined) ?? conditionOperators[0].value
    const conditionNeedsValue = conditionOperators.find((op) => op.value === conditionOperator)?.needsValue ?? true

    const conditionByFieldDataType = (rawData.fieldDataType as ApprovalFieldDataType | undefined)
        ?? getDataTypeFromField(formFieldMetaOptions, rawData.fieldKey as string | undefined)
    const conditionByFieldOperators = COMPARISON_OPTIONS[conditionByFieldDataType]
    const conditionByFieldOperator = (rawData.operator as string | undefined) ?? conditionByFieldOperators[0].value
    const conditionByFieldNeedsValue = conditionByFieldOperators.find((op) => op.value === conditionByFieldOperator)?.needsValue ?? true
    const subWorkflowFormKey = (rawData.subWorkflowFormKey as string) ?? ""
    const subWorkflowDefinitionId = (rawData.subWorkflowDefinitionId as string) ?? ""
    const subWorkflowFormOptions = Array.from(new Set((subWorkflowOptions ?? []).map((option) => option.formKey))).sort((a, b) => a.localeCompare(b))
    const filteredSubDefinitions = (subWorkflowOptions ?? []).filter((option) => {
        if (!subWorkflowFormKey) return true
        return option.formKey === subWorkflowFormKey
    })
    const dynamicSourceField = (rawData.sourceField as string) ?? "department"
    const dynamicFallbackRole = (rawData.fallbackRole as string) ?? "manager"
    const dynamicMetadataKey = (rawData.metadataKey as string) ?? "dynamicRole"
    const dynamicSourceFieldOptions = Array.from(new Set([
        ...(formFieldMetaOptions ?? []).map((field) => field.key),
        ...(formFieldOptions ?? []),
        "department",
    ])).sort((a, b) => a.localeCompare(b))
    const dynamicRoleOptions = Array.from(new Set(users
        .map((entry) => (entry.role ?? "").trim())
        .filter((value) => value.length > 0)))
        .sort((a, b) => a.localeCompare(b))
    const dynamicMetadataKeyOptions = ["dynamicRole", "resolvedRole", "nextApproverRole"]
    const approvalRole = ((rawData.approverRole as string) ?? "").trim()
    const approvalRoleOptions = Array.from(new Set(users
        .map((entry) => (entry.role ?? "").trim())
        .filter((value) => value.length > 0)))
        .sort((a, b) => a.localeCompare(b))
    const approvalPolicy = ((rawData.approvalPolicy as string) === "any" || (rawData.approvalPolicy as string) === "all" || (rawData.approvalPolicy as string) === "quorum")
        ? (rawData.approvalPolicy as "any" | "all" | "quorum")
        : "quorum"
    const workflowNotePolicy = ((rawData.workflowNotePolicy as string) === "optional"
        || (rawData.workflowNotePolicy as string) === "required_on_approve"
        || (rawData.workflowNotePolicy as string) === "required_on_reject"
        || (rawData.workflowNotePolicy as string) === "required_always")
        ? (rawData.workflowNotePolicy as "optional" | "required_on_approve" | "required_on_reject" | "required_always")
        : "required_on_approve"
    const estimatedRoleAssignees = approvalRole
        ? users.filter((entry) => (entry.role ?? "").trim().toLowerCase() === approvalRole.toLowerCase()).length
        : 0
    const estimatedApprovalAssignees = (rawData.approverType as string) === "user" ? 1 : Math.max(1, estimatedRoleAssignees || 1)

    const syncParallelApproverNames = (userIds: string[]) => {
        const names = userIds
            .map((id) => users.find((u) => u.id === id)?.name ?? users.find((u) => u.id === id)?.email ?? null)
            .filter((value): value is string => Boolean(value))

        update({
            approverUserIds: userIds,
            approverUserNames: names,
        })
    }

    return (
        <div className="absolute right-0 top-0 z-10 h-full w-80 border-l bg-card shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b px-4 py-3 bg-muted/30">
                <div className="flex items-center gap-2">
                    <MetaIcon className={`h-4 w-4 ${meta.color}`} />
                    <div>
                        <p className="font-semibold text-sm">{meta.label}</p>
                        <p className="text-[10px] text-muted-foreground">Konfigurasi node</p>
                    </div>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-4 space-y-5">
                    {/* Step Name — common to all */}
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nama Node</Label>
                        <Input
                            value={(rawData.stepName as string) ?? ""}
                            onChange={(e) => update({ stepName: e.target.value })}
                            placeholder="Nama step ini..."
                            className="h-9"
                        />
                    </div>

                    <Separator />

                    {/* ── APPROVAL STEP ── */}
                    {nodeType === "approvalStep" && (
                        <>
                            <div className="space-y-3">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                    <UserCheck className="h-3.5 w-3.5" />
                                    Approver
                                </Label>
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Type</Label>
                                    <Select
                                        value={(rawData.approverType as string) ?? "role"}
                                        onValueChange={(v) => update({ approverType: v })}
                                    >
                                        <SelectTrigger className="h-9">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="user">
                                                <span className="flex items-center gap-2"><Users className="h-3.5 w-3.5" />Specific User</span>
                                            </SelectItem>
                                            <SelectItem value="role">
                                                <span className="flex items-center gap-2"><Users className="h-3.5 w-3.5" />By Role</span>
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {rawData.approverType === "user" ? (
                                    <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">Pilih User</Label>
                                        <Select
                                            value={(rawData.approverUserId as string) ?? ""}
                                            onValueChange={(v) => {
                                                const selected = users.find((u) => u.id === v)
                                                update({ approverUserId: v, approverUserName: selected?.name ?? selected?.email ?? null })
                                            }}
                                        >
                                            <SelectTrigger className="h-9">
                                                <SelectValue placeholder="Pilih user..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {users.map((u) => (
                                                    <SelectItem key={u.id} value={u.id}>
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-medium">{u.name ?? u.email}</span>
                                                            {u.role && <span className="text-[10px] text-muted-foreground">{u.role}</span>}
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">Role Name</Label>
                                        <Select
                                            value={approvalRoleOptions.includes(approvalRole) ? approvalRole : "__custom"}
                                            onValueChange={(v) => {
                                                if (v === "__custom") return
                                                const nextPatch: Record<string, unknown> = { approverRole: v }
                                                if (approvalPolicy === "all") {
                                                    const roleCount = users.filter((entry) => (entry.role ?? "").trim().toLowerCase() === v.toLowerCase()).length
                                                    nextPatch.minApprovals = Math.max(1, roleCount || 1)
                                                }
                                                if ((rawData.approverType as string) === "user") {
                                                    nextPatch.minApprovals = 1
                                                }
                                                update(nextPatch)
                                            }}
                                        >
                                            <SelectTrigger className="h-9">
                                                <SelectValue placeholder="Pilih role approver" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {approvalRoleOptions.map((roleName) => (
                                                    <SelectItem key={roleName} value={roleName}>{roleName}</SelectItem>
                                                ))}
                                                <SelectItem value="__custom">Custom…</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        {!approvalRoleOptions.includes(approvalRole) && (
                                            <Input
                                                value={approvalRole}
                                                onChange={(e) => update({ approverRole: e.target.value })}
                                                placeholder="e.g. manager, director"
                                                className="h-9"
                                            />
                                        )}
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Assignee Policy</Label>
                                    <Select
                                        value={approvalPolicy}
                                        onValueChange={(v) => {
                                            const policy = v as "any" | "all" | "quorum"
                                            const patch: Record<string, unknown> = { approvalPolicy: policy }
                                            if (policy === "any") patch.minApprovals = 1
                                            if (policy === "all") patch.minApprovals = estimatedApprovalAssignees
                                            if ((rawData.approverType as string) === "user") patch.minApprovals = 1
                                            update(patch)
                                        }}
                                    >
                                        <SelectTrigger className="h-9">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="any">Any (1 approval cukup)</SelectItem>
                                            <SelectItem value="all">All (semua assignee wajib)</SelectItem>
                                            <SelectItem value="quorum">Quorum (minimum N)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {approvalPolicy === "quorum" ? (
                                    <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">Min Approvals</Label>
                                        <Input
                                            type="number" min={1}
                                            value={(rawData.minApprovals as number) ?? 1}
                                            onChange={(e) => update({ minApprovals: Math.max(1, Number(e.target.value)) })}
                                            className="h-9 w-24"
                                        />
                                        <p className="text-[10px] text-muted-foreground">Estimasi assignee: {estimatedApprovalAssignees}</p>
                                    </div>
                                ) : (
                                    <p className="text-[10px] text-muted-foreground bg-primary/5 rounded-md p-2 border border-primary/10">
                                        Policy <span className="font-medium">{approvalPolicy.toUpperCase()}</span> aktif. Min approvals akan disesuaikan otomatis.
                                    </p>
                                )}

                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Instructions (opsional)</Label>
                                    <Textarea
                                        value={(rawData.instructions as string) ?? ""}
                                        onChange={(e) => update({ instructions: e.target.value })}
                                        placeholder="Petunjuk untuk approver pada step ini..."
                                        className="text-xs min-h-[80px]"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Workflow Note Policy</Label>
                                    <Select
                                        value={workflowNotePolicy}
                                        onValueChange={(v) => update({ workflowNotePolicy: v })}
                                    >
                                        <SelectTrigger className="h-9">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="optional">Optional</SelectItem>
                                            <SelectItem value="required_on_approve">Required on Approve</SelectItem>
                                            <SelectItem value="required_on_reject">Required on Reject</SelectItem>
                                            <SelectItem value="required_always">Required Always</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <Separator />

                            {/* Notifications */}
                            <div className="space-y-3">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                    <Bell className="h-3.5 w-3.5" />
                                    Email Notifications
                                </Label>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs font-medium">Notify on Assigned</p>
                                            <p className="text-[10px] text-muted-foreground">Email saat step ini aktif</p>
                                        </div>
                                        <Switch
                                            checked={(rawData.notifyOnAssign as boolean) ?? true}
                                            onCheckedChange={(v) => update({ notifyOnAssign: v })}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs font-medium">Notify on Completed</p>
                                            <p className="text-[10px] text-muted-foreground">Email saat step selesai</p>
                                        </div>
                                        <Switch
                                            checked={(rawData.notifyOnComplete as boolean) ?? false}
                                            onCheckedChange={(v) => update({ notifyOnComplete: v })}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                                        <Mail className="h-3 w-3" />CC Emails
                                    </Label>
                                    <Input
                                        value={(rawData.ccEmails as string) ?? ""}
                                        onChange={(e) => update({ ccEmails: e.target.value || null })}
                                        placeholder="email1@co.id, email2@co.id"
                                        className="h-9 text-xs"
                                    />
                                </div>
                            </div>

                            <Separator />

                            <div className="space-y-2">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                    <Clock className="h-3.5 w-3.5" />SLA
                                </Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="number" min={0}
                                        value={(rawData.slaDays as number) ?? ""}
                                        onChange={(e) => update({ slaDays: e.target.value ? Number(e.target.value) : null })}
                                        placeholder="0"
                                        className="h-9 w-20"
                                    />
                                    <span className="text-xs text-muted-foreground">hari (0 = tidak ada batas)</span>
                                </div>
                            </div>
                        </>
                    )}

                    {/* ── PARALLEL APPROVAL NODE ── */}
                    {nodeType === "parallelApprovalNode" && (
                        <>
                            <div className="space-y-3">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
                                    <Users className="h-3.5 w-3.5" />
                                    Parallel Approval
                                </Label>

                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Role Approver</Label>
                                    <Input
                                        value={(rawData.approverRole as string) ?? ""}
                                        onChange={(e) => update({ approverRole: e.target.value })}
                                        placeholder="e.g. manager, finance-manager"
                                        className="h-9"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Siapa saja yang approve</Label>
                                    <div className="max-h-40 overflow-y-auto rounded-md border p-2 space-y-2">
                                        {users.map((user) => {
                                            const checked = parallelApproverUserIds.includes(user.id)
                                            return (
                                                <label key={user.id} className="flex items-start gap-2 cursor-pointer">
                                                    <Checkbox
                                                        checked={checked}
                                                        onCheckedChange={(isChecked) => {
                                                            if (isChecked) {
                                                                if (checked) return
                                                                const merged = [...parallelApproverUserIds, user.id].slice(0, expectedParallelApprovers)
                                                                syncParallelApproverNames(merged)
                                                                return
                                                            }

                                                            syncParallelApproverNames(parallelApproverUserIds.filter((id) => id !== user.id))
                                                        }}
                                                    />
                                                    <div className="leading-tight">
                                                        <p className="text-xs font-medium">{user.name ?? user.email}</p>
                                                        <p className="text-[10px] text-muted-foreground">{user.role ?? user.email}</p>
                                                    </div>
                                                </label>
                                            )
                                        })}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">
                                        Dipilih {parallelApproverUserIds.length} dari target {expectedParallelApprovers} approver.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Strategi</Label>
                                    <Select
                                        value={(rawData.parallelStrategy as string) ?? "quorum"}
                                        onValueChange={(v) => {
                                            const expected = Math.max(1, Number(rawData.expectedApprovers ?? 2))
                                            const patch: Record<string, unknown> = { parallelStrategy: v }
                                            if (v === "any") patch.minApprovals = 1
                                            if (v === "all") patch.minApprovals = expected
                                            update(patch)
                                        }}
                                    >
                                        <SelectTrigger className="h-9">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="any">Any 1 approver cukup</SelectItem>
                                            <SelectItem value="all">Semua approver wajib approve</SelectItem>
                                            <SelectItem value="quorum">Quorum (minimum N approve)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">Total Approver</Label>
                                        <Input
                                            type="number"
                                            min={1}
                                            value={(rawData.expectedApprovers as number) ?? 2}
                                            onChange={(e) => {
                                                const expected = Math.max(1, Number(e.target.value))
                                                const strategy = (rawData.parallelStrategy as string) ?? "quorum"
                                                const patch: Record<string, unknown> = {
                                                    expectedApprovers: expected,
                                                    approverUserIds: parallelApproverUserIds.slice(0, expected),
                                                }
                                                const names = (Array.isArray(rawData.approverUserNames)
                                                    ? rawData.approverUserNames.filter((value): value is string => typeof value === "string")
                                                    : []
                                                ).slice(0, expected)
                                                patch.approverUserNames = names
                                                if (strategy === "all") patch.minApprovals = expected
                                                if ((rawData.minApprovals as number) > expected) patch.minApprovals = expected
                                                update(patch)
                                            }}
                                            className="h-9"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">Min Approve</Label>
                                        <Input
                                            type="number"
                                            min={1}
                                            value={(rawData.minApprovals as number) ?? 1}
                                            onChange={(e) => {
                                                const expected = Math.max(1, Number(rawData.expectedApprovers ?? 2))
                                                const next = Math.max(1, Number(e.target.value))
                                                update({ minApprovals: Math.min(expected, next) })
                                            }}
                                            className="h-9"
                                        />
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            <div className="space-y-2">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                    <CheckCheck className="h-3.5 w-3.5" />Aturan Eksekusi
                                </Label>
                                <p className="text-[10px] text-muted-foreground bg-indigo-50 dark:bg-indigo-950/30 rounded-md p-2 border border-indigo-200 dark:border-indigo-900">
                                    Node ini menyimpan daftar approver paralel (siapa saja), strategi eksekusi, dan jumlah approval minimum di metadata workflow.
                                </p>
                            </div>
                        </>
                    )}

                    {/* ── CONDITION NODE ── */}
                    {nodeType === "conditionNode" && (
                        <div className="space-y-3">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-amber-600 flex items-center gap-1.5">
                                <GitBranch className="h-3.5 w-3.5" />
                                Kondisi Percabangan
                            </Label>
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Label Kondisi</Label>
                                <Input
                                    value={(rawData.conditionLabel as string) ?? ""}
                                    onChange={(e) => update({ conditionLabel: e.target.value })}
                                    placeholder="e.g. if amount > 100jt"
                                    className="h-9"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Field</Label>
                                <Select
                                    value={(rawData.conditionField as string) ?? ""}
                                    onValueChange={(v) => {
                                        const nextType = getDataTypeFromField(formFieldMetaOptions, v)
                                        update({
                                            conditionField: v,
                                            conditionDataType: nextType,
                                            conditionOperator: getDefaultOperatorForType(nextType),
                                        })
                                    }}
                                >
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder="Pilih field dari form" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(formFieldOptions ?? []).length > 0 ? (
                                            (formFieldOptions ?? []).map((field) => (
                                                <SelectItem key={field} value={field}>{field}</SelectItem>
                                            ))
                                        ) : (
                                            <div className="px-2 py-2 text-xs text-muted-foreground">
                                                Field form belum tersedia untuk workflow ini
                                            </div>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Data Type (otomatis)</Label>
                                    <div className="h-9 rounded-md border bg-muted/30 px-3 text-xs flex items-center">
                                        {conditionDataType === "date" ? "Date & Time" : conditionDataType.charAt(0).toUpperCase() + conditionDataType.slice(1)}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Operator</Label>
                                    <Select
                                        value={conditionOperator}
                                        onValueChange={(v) => update({ conditionOperator: v })}
                                    >
                                        <SelectTrigger className="h-9">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {conditionOperators.map((op) => (
                                                <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Value</Label>
                                <Input
                                    value={(rawData.conditionValue as string) ?? ""}
                                    onChange={(e) => update({ conditionValue: e.target.value })}
                                    placeholder={conditionNeedsValue ? "Masukkan nilai pembanding" : "Operator ini tidak membutuhkan nilai"}
                                    className="h-9"
                                    disabled={!conditionNeedsValue}
                                />
                            </div>
                            <p className="text-[10px] text-muted-foreground bg-amber-50 dark:bg-amber-950/30 rounded-md p-2 border border-amber-200 dark:border-amber-800">
                                Handle <span className="font-medium text-emerald-600">kanan</span> = Yes (kondisi terpenuhi)<br />
                                Handle <span className="font-medium text-rose-500">bawah</span> = No (kondisi tidak terpenuhi)
                            </p>
                        </div>
                    )}

                    {/* ── CONDITION BY FIELD NODE ── */}
                    {nodeType === "conditionByFieldNode" && (
                        <div className="space-y-3">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-cyan-600 flex items-center gap-1.5">
                                <Funnel className="h-3.5 w-3.5" />
                                Routing by Form Field
                            </Label>
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Field Form</Label>
                                <Select
                                    value={(rawData.fieldKey as string) ?? ""}
                                    onValueChange={(v) => {
                                        const nextType = getDataTypeFromField(formFieldMetaOptions, v)
                                        update({
                                            fieldKey: v,
                                            fieldDataType: nextType,
                                            operator: getDefaultOperatorForType(nextType),
                                        })
                                    }}
                                >
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder="Pilih field dari form" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(formFieldOptions ?? []).length > 0 ? (
                                            (formFieldOptions ?? []).map((field) => (
                                                <SelectItem key={field} value={field}>{field}</SelectItem>
                                            ))
                                        ) : (
                                            <div className="px-2 py-2 text-xs text-muted-foreground">
                                                Field form belum tersedia untuk workflow ini
                                            </div>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Data Type (otomatis)</Label>
                                <div className="h-9 rounded-md border bg-muted/30 px-3 text-xs flex items-center">
                                    {conditionByFieldDataType === "date" ? "Date & Time" : conditionByFieldDataType.charAt(0).toUpperCase() + conditionByFieldDataType.slice(1)}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Operator</Label>
                                <Select
                                    value={conditionByFieldOperator}
                                    onValueChange={(v) => update({ operator: v })}
                                >
                                    <SelectTrigger className="h-9">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {conditionByFieldOperators.map((op) => (
                                            <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Nilai Pembanding</Label>
                                <Input
                                    value={(rawData.targetValue as string) ?? ""}
                                    onChange={(e) => update({ targetValue: e.target.value })}
                                    placeholder={conditionByFieldNeedsValue ? "Masukkan nilai pembanding" : "Operator ini tidak membutuhkan nilai"}
                                    className="h-9"
                                    disabled={!conditionByFieldNeedsValue}
                                />
                            </div>
                            <p className="text-[10px] text-muted-foreground bg-cyan-50 dark:bg-cyan-950/30 rounded-md p-2 border border-cyan-200 dark:border-cyan-800">
                                Handle <span className="font-medium text-emerald-600">kanan</span> = kondisi match (sesuai rule)<br />
                                Handle <span className="font-medium text-rose-500">bawah</span> = kondisi tidak match
                            </p>
                        </div>
                    )}

                    {nodeType === "subWorkflowNode" && (
                        <div className="space-y-3">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-fuchsia-600 flex items-center gap-1.5">
                                <Workflow className="h-3.5 w-3.5" />
                                Sub Workflow
                            </Label>
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Form Key Target</Label>
                                <Select
                                    value={subWorkflowFormKey || "__none"}
                                    onValueChange={(v) => {
                                        if (v === "__none") {
                                            update({ subWorkflowFormKey: "", subWorkflowDefinitionId: "" })
                                            return
                                        }
                                        update({ subWorkflowFormKey: v, subWorkflowDefinitionId: "" })
                                    }}
                                >
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder="Pilih form key" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__none">(kosongkan)</SelectItem>
                                        {subWorkflowFormOptions.map((formKey) => (
                                            <SelectItem key={formKey} value={formKey}>{formKey}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Definition ID (opsional)</Label>
                                <Select
                                    value={subWorkflowDefinitionId || "__none"}
                                    onValueChange={(v) => {
                                        if (v === "__none") {
                                            update({ subWorkflowDefinitionId: "" })
                                            return
                                        }

                                        const selected = filteredSubDefinitions.find((option) => option.id === v)
                                        update({
                                            subWorkflowDefinitionId: v,
                                            subWorkflowFormKey: selected?.formKey ?? subWorkflowFormKey,
                                        })
                                    }}
                                >
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder="Pilih definition" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__none">(none)</SelectItem>
                                        {filteredSubDefinitions.map((definition) => (
                                            <SelectItem key={definition.id} value={definition.id}>
                                                {definition.name} · v{definition.version} · {definition.status}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <p className="text-[10px] text-muted-foreground bg-fuchsia-50 dark:bg-fuchsia-950/30 rounded-md p-2 border border-fuchsia-200 dark:border-fuchsia-800">
                                Pilih definition langsung dari dropdown agar menghindari typo pada form key/ID.
                            </p>
                        </div>
                    )}

                    {nodeType === "deadlineBranchNode" && (
                        <div className="space-y-3">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-red-600 flex items-center gap-1.5">
                                <AlarmClockCheck className="h-3.5 w-3.5" />
                                Deadline Branch
                            </Label>
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Mode</Label>
                                <Select
                                    value={(rawData.mode as string) ?? "request_due_at"}
                                    onValueChange={(v) => update({ mode: v })}
                                >
                                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="request_due_at">By Request DueAt</SelectItem>
                                        <SelectItem value="hours_since_submit">By Hours Since Submit</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {(rawData.mode as string) === "hours_since_submit" && (
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Threshold (hours)</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        value={(rawData.thresholdHours as number) ?? 24}
                                        onChange={(e) => update({ thresholdHours: Math.max(1, Number(e.target.value || 24)) })}
                                        className="h-9"
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {nodeType === "waitEventNode" && (
                        <div className="space-y-3">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-sky-600 flex items-center gap-1.5">
                                <PauseCircle className="h-3.5 w-3.5" />
                                Wait For Event
                            </Label>
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Event Key</Label>
                                <Input
                                    value={(rawData.eventKey as string) ?? ""}
                                    onChange={(e) => update({ eventKey: e.target.value })}
                                    placeholder="e.g. sapSynced"
                                    className="h-9"
                                />
                            </div>
                        </div>
                    )}

                    {nodeType === "cancelNode" && (
                        <div className="space-y-3">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-zinc-600 flex items-center gap-1.5">
                                <Ban className="h-3.5 w-3.5" />
                                Cancel / Terminate
                            </Label>
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Reason</Label>
                                <Textarea
                                    value={(rawData.reason as string) ?? ""}
                                    onChange={(e) => update({ reason: e.target.value })}
                                    placeholder="Alasan terminate"
                                    className="text-xs min-h-[80px]"
                                />
                            </div>
                        </div>
                    )}

                    {nodeType === "switchNode" && (
                        <div className="space-y-3">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-teal-600 flex items-center gap-1.5">
                                <SplitSquareVertical className="h-3.5 w-3.5" />
                                Switch / Case
                            </Label>
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Field (dropdown)</Label>
                                <Select
                                    value={(rawData.fieldKey as string) ?? ""}
                                    onValueChange={(v) => update({ fieldKey: v })}
                                >
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder="Pilih field dari form" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(formFieldOptions ?? []).length > 0 ? (
                                            (formFieldOptions ?? []).map((field) => (
                                                <SelectItem key={field} value={field}>{field}</SelectItem>
                                            ))
                                        ) : (
                                            <div className="px-2 py-2 text-xs text-muted-foreground">
                                                Field form belum tersedia
                                            </div>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Field (manual override)</Label>
                                <Input
                                    value={(rawData.fieldKey as string) ?? ""}
                                    onChange={(e) => update({ fieldKey: e.target.value })}
                                    className="h-9"
                                    placeholder="e.g. categoryPo"
                                />
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                                <Input value={(rawData.caseA as string) ?? ""} onChange={(e) => update({ caseA: e.target.value })} className="h-9" placeholder="Case A value" />
                                <Input value={(rawData.caseB as string) ?? ""} onChange={(e) => update({ caseB: e.target.value })} className="h-9" placeholder="Case B value" />
                                <Input value={(rawData.caseC as string) ?? ""} onChange={(e) => update({ caseC: e.target.value })} className="h-9" placeholder="Case C value" />
                                <Input value={(rawData.caseD as string) ?? ""} onChange={(e) => update({ caseD: e.target.value })} className="h-9" placeholder="Case D value" />
                                <Input value={(rawData.caseE as string) ?? ""} onChange={(e) => update({ caseE: e.target.value })} className="h-9" placeholder="Case E value" />
                                <Input value={(rawData.caseF as string) ?? ""} onChange={(e) => update({ caseF: e.target.value })} className="h-9" placeholder="Case F value" />
                            </div>
                            <p className="text-[10px] text-muted-foreground bg-teal-50 dark:bg-teal-950/30 rounded-md p-2 border border-teal-200 dark:border-teal-800">
                                Handle case hanya tampil untuk nilai case yang diisi. Jika semua kosong, minimal handle <span className="font-medium">caseA</span> tetap ditampilkan.
                            </p>
                        </div>
                    )}

                    {nodeType === "businessDelayNode" && (
                        <div className="space-y-3">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-lime-700 flex items-center gap-1.5">
                                <CalendarClock className="h-3.5 w-3.5" />
                                Business Delay
                            </Label>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Business Days</Label>
                                    <Input type="number" min={0} value={(rawData.businessDays as number) ?? 0} onChange={(e) => update({ businessDays: Math.max(0, Number(e.target.value || 0)) })} className="h-9" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Business Hours</Label>
                                    <Input type="number" min={0} value={(rawData.businessHours as number) ?? 0} onChange={(e) => update({ businessHours: Math.max(0, Number(e.target.value || 0)) })} className="h-9" />
                                </div>
                            </div>
                        </div>
                    )}

                    {nodeType === "requiredAttachmentNode" && (
                        <div className="space-y-3">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-cyan-700 flex items-center gap-1.5">
                                <Paperclip className="h-3.5 w-3.5" />
                                Required Attachment
                            </Label>
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Required Keys (comma separated)</Label>
                                <Input
                                    value={(rawData.requiredKeys as string) ?? ""}
                                    onChange={(e) => update({ requiredKeys: e.target.value })}
                                    className="h-9"
                                    placeholder="poFile,invoiceFile"
                                />
                            </div>
                        </div>
                    )}

                    {nodeType === "dynamicRoleResolverNode" && (
                        <div className="space-y-3">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                                <UserRoundCog className="h-3.5 w-3.5" />
                                Dynamic Role Resolver
                            </Label>
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Source Field</Label>
                                <Select
                                    value={dynamicSourceFieldOptions.includes(dynamicSourceField) ? dynamicSourceField : "__custom"}
                                    onValueChange={(v) => {
                                        if (v === "__custom") return
                                        update({ sourceField: v })
                                    }}
                                >
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder="Pilih source field" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {dynamicSourceFieldOptions.map((fieldKey) => (
                                            <SelectItem key={fieldKey} value={fieldKey}>{fieldKey}</SelectItem>
                                        ))}
                                        <SelectItem value="__custom">Custom…</SelectItem>
                                    </SelectContent>
                                </Select>
                                {!dynamicSourceFieldOptions.includes(dynamicSourceField) && (
                                    <Input
                                        value={dynamicSourceField}
                                        onChange={(e) => update({ sourceField: e.target.value })}
                                        className="h-9"
                                        placeholder="Custom source field"
                                    />
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Fallback Role</Label>
                                <Select
                                    value={dynamicRoleOptions.includes(dynamicFallbackRole) ? dynamicFallbackRole : "__custom"}
                                    onValueChange={(v) => {
                                        if (v === "__custom") return
                                        update({ fallbackRole: v })
                                    }}
                                >
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder="Pilih fallback role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {dynamicRoleOptions.map((roleName) => (
                                            <SelectItem key={roleName} value={roleName}>{roleName}</SelectItem>
                                        ))}
                                        <SelectItem value="__custom">Custom…</SelectItem>
                                    </SelectContent>
                                </Select>
                                {!dynamicRoleOptions.includes(dynamicFallbackRole) && (
                                    <Input
                                        value={dynamicFallbackRole}
                                        onChange={(e) => update({ fallbackRole: e.target.value })}
                                        className="h-9"
                                        placeholder="Custom role"
                                    />
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Metadata Key</Label>
                                <Select
                                    value={dynamicMetadataKeyOptions.includes(dynamicMetadataKey) ? dynamicMetadataKey : "__custom"}
                                    onValueChange={(v) => {
                                        if (v === "__custom") return
                                        update({ metadataKey: v })
                                    }}
                                >
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder="Pilih metadata key" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {dynamicMetadataKeyOptions.map((keyName) => (
                                            <SelectItem key={keyName} value={keyName}>{keyName}</SelectItem>
                                        ))}
                                        <SelectItem value="__custom">Custom…</SelectItem>
                                    </SelectContent>
                                </Select>
                                {!dynamicMetadataKeyOptions.includes(dynamicMetadataKey) && (
                                    <Input
                                        value={dynamicMetadataKey}
                                        onChange={(e) => update({ metadataKey: e.target.value })}
                                        className="h-9"
                                        placeholder="Custom metadata key"
                                    />
                                )}
                            </div>
                            <p className="text-[10px] text-muted-foreground bg-amber-50 dark:bg-amber-950/30 rounded-md p-2 border border-amber-200 dark:border-amber-800">
                                Gunakan dropdown agar mapping role lebih konsisten, dan pakai mode custom bila key/role belum ada di daftar.
                            </p>
                        </div>
                    )}

                    {/* ── NOTIFY NODE ── */}
                    {nodeType === "notifyNode" && (
                        <div className="space-y-3">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
                                <Bell className="h-3.5 w-3.5" />
                                Konfigurasi Notifikasi
                            </Label>
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Kirim ke</Label>
                                <Select
                                    value={(rawData.targetType as string) ?? "requester"}
                                    onValueChange={(v) => update({ targetType: v })}
                                >
                                    <SelectTrigger className="h-9">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="requester">Requester (Pemohon)</SelectItem>
                                        <SelectItem value="approver">Approver saat ini</SelectItem>
                                        <SelectItem value="custom">Custom Email</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {rawData.targetType === "custom" && (
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Custom Emails</Label>
                                    <Input
                                        value={(rawData.customEmails as string) ?? ""}
                                        onChange={(e) => update({ customEmails: e.target.value })}
                                        placeholder="email1@co.id, email2@co.id"
                                        className="h-9 text-xs"
                                    />
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Pesan Notifikasi</Label>
                                <NotifyMessageEditor
                                    value={(rawData.notifyMessage as string) ?? ""}
                                    onChange={(nextHtml) => update({ notifyMessage: nextHtml })}
                                />
                            </div>
                        </div>
                    )}

                    {/* ── AUTO APPROVE NODE ── */}
                    {nodeType === "autoApproveNode" && (
                        <div className="space-y-3">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-violet-600 flex items-center gap-1.5">
                                <Zap className="h-3.5 w-3.5" />
                                Auto Approve Config
                            </Label>
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Alasan / Keterangan</Label>
                                <Textarea
                                    value={(rawData.reason as string) ?? ""}
                                    onChange={(e) => update({ reason: e.target.value })}
                                    placeholder="e.g. Nominal di bawah batas, auto-approved"
                                    className="text-xs min-h-[80px]"
                                />
                            </div>
                            <p className="text-[10px] text-muted-foreground bg-violet-50 dark:bg-violet-950/30 rounded-md p-2 border border-violet-200 dark:border-violet-800">
                                Step ini akan langsung di-approve secara otomatis saat dicapai. Cocok untuk kondisi nominal kecil atau bypass tertentu.
                            </p>
                        </div>
                    )}

                    {/* ── DELAY NODE ── */}
                    {nodeType === "delayNode" && (
                        <div className="space-y-3">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-orange-600 flex items-center gap-1.5">
                                <Timer className="h-3.5 w-3.5" />
                                Delay / Timer Config
                            </Label>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Hari</Label>
                                    <Input
                                        type="number" min={0}
                                        value={(rawData.delayDays as number) ?? ""}
                                        onChange={(e) => update({ delayDays: e.target.value ? Number(e.target.value) : null })}
                                        placeholder="0"
                                        className="h-9"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Jam</Label>
                                    <Input
                                        type="number" min={0} max={23}
                                        value={(rawData.delayHours as number) ?? ""}
                                        onChange={(e) => update({ delayHours: e.target.value ? Number(e.target.value) : null })}
                                        placeholder="0"
                                        className="h-9"
                                    />
                                </div>
                            </div>
                            <p className="text-[10px] text-muted-foreground bg-orange-50 dark:bg-orange-950/30 rounded-md p-2 border border-orange-200 dark:border-orange-800">
                                Workflow akan dijeda selama waktu yang ditentukan sebelum lanjut ke step berikutnya.
                            </p>
                        </div>
                    )}
                </div>
            </ScrollArea>

            {/* Footer */}
            <div className="border-t p-3">
                <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    onClick={() => onDelete(nodeId)}
                >
                    Hapus Node Ini
                </Button>
            </div>
        </div>
    )
}
