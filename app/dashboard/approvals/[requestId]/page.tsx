import Link from "next/link"
import { notFound } from "next/navigation"
import { ExternalLink, FileText, History } from "lucide-react"
import { getApprovalRequestDetail } from "@/app/actions/approval"
import { getAuthenticatedSession } from "@/lib/rbac"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Timeline } from "./_components/timeline"
import { ActionPanel } from "@/app/dashboard/approvals/_components/action-panel"
import type { TimelineEntry } from "@/app/dashboard/approvals/_lib/types"

export default async function ApprovalRequestDetailPage({
    params,
}: {
    params: Promise<{ requestId: string }>
}) {
    const { requestId } = await params
    const [detail, session] = await Promise.all([
        getApprovalRequestDetail(requestId),
        getAuthenticatedSession(),
    ])

    if (!detail) {
        notFound()
    }

    const currentUserId = session.user.id

    const modulePath = detail.definition?.form?.modulePath?.trim() || ""
    const normalizedModulePath = modulePath
        ? modulePath.startsWith("/")
            ? modulePath
            : `/${modulePath}`
        : ""

    const basePath = normalizedModulePath.endsWith("/create")
        ? normalizedModulePath.replace(/\/create$/, "")
        : normalizedModulePath
    const resolvedPreviewEntityUrl = typeof detail.previewEntityUrl === "string"
        ? detail.previewEntityUrl.trim()
        : ""

    const candidateEmbedUrls = [
        resolvedPreviewEntityUrl,
        basePath ? `${basePath}/${detail.entityId}` : "",
        basePath ? `${basePath}?id=${encodeURIComponent(detail.entityId)}` : "",
        basePath ? `${basePath}?quotationNumber=${encodeURIComponent(detail.entityId)}` : "",
        normalizedModulePath ? `${normalizedModulePath}?id=${encodeURIComponent(detail.entityId)}` : "",
        normalizedModulePath ? `${normalizedModulePath}?entityId=${encodeURIComponent(detail.entityId)}` : "",
    ].filter((url, index, arr): url is string => Boolean(url) && arr.indexOf(url) === index)

    const embedUrl = candidateEmbedUrls[0] ?? ""

    // Map DB audit log action values to TimelineEntry action union
    const ACTION_MAP: Record<string, TimelineEntry["action"]> = {
        approve: "approved",
        approved: "approved",
        reject: "rejected",
        rejected: "rejected",
        submit: "submitted",
        submitted: "submitted",
        revert: "reverted",
        reverted: "reverted",
        comment: "commented",
        commented: "commented",
        escalate: "escalate",
        cancel: "cancel",
    }

    const timelineEntries: TimelineEntry[] = detail.auditLogs.map((log) => {
        const action: TimelineEntry["action"] = ACTION_MAP[log.action] ?? "commented"
        const payload = (log as Record<string, unknown>).payload as Record<string, unknown> | null | undefined
        const comment =
            payload && typeof payload === "object" && "comment" in payload && typeof payload.comment === "string"
                ? payload.comment
                : null
        return {
            id: String(log.id),
            action,
            actorName: log.actor?.name ?? log.actorUserId ?? "system",
            createdAt: new Date(log.createdAt),
            comment,
        }
    })

    // conditionSnapshot fields for left panel
    const conditionSnapshot = (detail as Record<string, unknown>).conditionSnapshot as Record<string, unknown> | null | undefined
    const snapshotEntries = conditionSnapshot && typeof conditionSnapshot === "object"
        ? Object.entries(conditionSnapshot)
        : []

    // ActionPanel props
    const isAssignedApprover = detail.assignments.some(
        (a) => a.assigneeUserId === currentUserId && a.status === "pending"
    )
    const pendingAssignment = detail.assignments.find(
        (a) => a.assigneeUserId === currentUserId && a.status === "pending"
    )
    const assignmentId = pendingAssignment ? String(pendingAssignment.id) : null

    const currentStepConditionJson = detail.assignments.find(
        (a) => a.stepOrder === detail.currentStepOrder
    )?.step?.conditionJson as Record<string, unknown> | null | undefined
    const workflowNotePolicy = (
        (currentStepConditionJson?.workflowNotePolicy as string | undefined) ?? "optional"
    ) as "optional" | "required_on_approve" | "required_on_reject" | "required_always"

    const hasAnyApproverDecision = detail.assignments.some(
        (a) => a.status === "approved" || a.status === "rejected"
    )

    return (
        <div className="space-y-6 p-4 sm:p-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Approval Request Detail</h1>
                    <p className="text-sm text-muted-foreground">
                        {detail.formKey} · {detail.entityId} · request {detail.id}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge>{detail.status}</Badge>
                    <Button asChild variant="outline" size="sm">
                        <Link href={`/dashboard/approvals/${detail.id}/pdf`} target="_blank">
                            <FileText className="mr-1 h-4 w-4" />
                            PDF
                        </Link>
                    </Button>
                </div>
            </div>

            {/* Two-column grid layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left column (lg:col-span-2): form data + timeline */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Detail Form card */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Detail Form</CardTitle>
                            <CardDescription>
                                Data snapshot form yang diajukan untuk kebutuhan review approver.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {snapshotEntries.length > 0 ? (
                                <div className="divide-y rounded-md border text-sm">
                                    {snapshotEntries.map(([key, value]) => (
                                        <div key={key} className="flex gap-4 px-4 py-2">
                                            <span className="w-1/3 shrink-0 font-medium text-muted-foreground">{key}</span>
                                            <span className="flex-1 break-all">
                                                {value === null || value === undefined
                                                    ? <span className="text-muted-foreground italic">—</span>
                                                    : typeof value === "object"
                                                        ? JSON.stringify(value)
                                                        : String(value)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : embedUrl ? (
                                <>
                                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                        <span>Form:</span>
                                        <Badge variant="outline">{detail.definition?.form?.formName ?? detail.formKey}</Badge>
                                        <span className="truncate">{embedUrl}</span>
                                    </div>
                                    <div className="overflow-hidden rounded-md border">
                                        <iframe
                                            src={embedUrl}
                                            title={`Submitted ${detail.formKey} ${detail.entityId}`}
                                            className="h-[60vh] w-full border-0 sm:h-[70vh]"
                                            loading="lazy"
                                        />
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {candidateEmbedUrls.map((url) => (
                                            <Button key={url} asChild size="sm" variant="outline" className="w-full justify-between sm:w-auto">
                                                <Link href={url} target="_blank">
                                                    <span className="truncate">Open {url}</span>
                                                    <ExternalLink className="ml-1 h-4 w-4" />
                                                </Link>
                                            </Button>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                                    Module path untuk form ini belum terdaftar di registry approval, jadi detail form belum bisa di-embed.
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Timeline Aktivitas card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <History className="h-5 w-5" />
                                Timeline Aktivitas
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <Timeline entries={timelineEntries} />
                        </CardContent>
                    </Card>
                </div>

                {/* Right column (lg:col-span-1): entry info + actions */}
                <div className="lg:col-span-1 space-y-6">

                    {/* Info Request card */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Info Request</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            <div className="space-y-1">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Entry ID</p>
                                <p className="font-mono text-xs break-all">{detail.id}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Form</p>
                                <p>{detail.definition?.form?.formName ?? detail.formKey}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Submitted</p>
                                <p>{new Date(detail.submittedAt).toLocaleString("id-ID")}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</p>
                                <Badge>{detail.status}</Badge>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Requester</p>
                                <p>{detail.requester?.name ?? detail.requesterId}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Current Step</p>
                                <p>{detail.currentStepOrder ?? "—"}</p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Aksi card */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Aksi</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ActionPanel
                                requestId={detail.id}
                                requestStatus={detail.status as "pending" | "approved" | "rejected" | "cancelled"}
                                requesterId={detail.requesterId}
                                currentUserId={currentUserId}
                                isAssignedApprover={isAssignedApprover}
                                assignmentId={assignmentId}
                                workflowNotePolicy={workflowNotePolicy}
                                hasAnyApproverDecision={hasAnyApproverDecision}
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
