import Link from "next/link"
import { notFound } from "next/navigation"
import { ExternalLink, FileText, History, ListChecks } from "lucide-react"
import { getApprovalRequestDetail } from "@/app/actions/approval"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

export default async function ApprovalRequestDetailPage({
    params,
}: {
    params: Promise<{ requestId: string }>
}) {
    const { requestId } = await params
    const detail = await getApprovalRequestDetail(requestId)

    if (!detail) {
        notFound()
    }

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

    return (
        <div className="space-y-6 p-6">
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

            <Card>
                <CardHeader>
                    <CardTitle>Overview</CardTitle>
                    <CardDescription>Ringkasan workflow dan requester.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-md border p-3 text-sm">
                        <p className="font-medium">Workflow</p>
                        <p className="text-muted-foreground">{detail.definition?.name}</p>
                        <p className="text-muted-foreground">Current step: {detail.currentStepOrder}</p>
                    </div>
                    <div className="rounded-md border p-3 text-sm">
                        <p className="font-medium">Requester</p>
                        <p className="text-muted-foreground">{detail.requester?.name ?? detail.requesterId}</p>
                        <p className="text-muted-foreground">Submitted: {new Date(detail.submittedAt).toLocaleString("id-ID")}</p>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Submitted Form Detail</CardTitle>
                    <CardDescription>
                        Preview isi form yang diajukan untuk kebutuhan review approver.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {embedUrl ? (
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
                                    className="h-[70vh] w-full border-0"
                                    loading="lazy"
                                />
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {candidateEmbedUrls.map((url) => (
                                    <Button key={url} asChild size="sm" variant="outline">
                                        <Link href={url} target="_blank">
                                            Open {url}
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

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ListChecks className="h-5 w-5" />
                        Assignments
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Step</TableHead>
                                    <TableHead>Assignee</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Acted At</TableHead>
                                    <TableHead>Comment</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {detail.assignments.map((assignment) => (
                                    <TableRow key={assignment.id}>
                                        <TableCell>{assignment.stepOrder}. {assignment.step?.stepName}</TableCell>
                                        <TableCell>{assignment.assignee?.name ?? assignment.assigneeUserId}</TableCell>
                                        <TableCell><Badge variant="outline">{assignment.status}</Badge></TableCell>
                                        <TableCell>{assignment.actedAt ? new Date(assignment.actedAt).toLocaleString("id-ID") : "-"}</TableCell>
                                        <TableCell>{assignment.comment ?? "-"}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <History className="h-5 w-5" />
                        Audit Trail
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    {detail.auditLogs.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Belum ada audit log.</p>
                    ) : (
                        detail.auditLogs.map((log) => (
                            <div key={log.id} className="rounded-md border p-3 text-sm">
                                <p className="font-medium">{log.action} · {new Date(log.createdAt).toLocaleString("id-ID")}</p>
                                <p className="text-muted-foreground">Actor: {log.actor?.name ?? log.actorUserId ?? "system"}</p>
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
