import { CheckCircle2, Clock, FileCheck2, XCircle } from "lucide-react"
import Link from "next/link"
import { getApprovalInbox, submitApprovalDecision } from "@/app/actions/approval"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

export const metadata = {
    title: "Approval Inbox – One Chitra",
}

export default async function ApprovalInboxPage() {
    const inbox = await getApprovalInbox()
    const pendingTasks = inbox.pendingTasks
    const mySubmissions = inbox.mySubmissions

    return (
        <div className="space-y-6 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2">
                        <FileCheck2 className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Approval Inbox</h1>
                        <p className="text-sm text-muted-foreground">
                            Pantau task approval yang perlu Anda proses dan request yang Anda submit.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button asChild>
                        <Link href="/dashboard/quotations/create">Submit Proposal</Link>
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                    <div>
                        <CardTitle>Pending Tasks</CardTitle>
                        <CardDescription>
                            Menampilkan task approval per step untuk user yang sedang login.
                        </CardDescription>
                    </div>
                    <Badge variant="secondary" className="gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {pendingTasks.length} pending
                    </Badge>
                </CardHeader>
                <CardContent>
                    {pendingTasks.length === 0 ? (
                        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
                            Tidak ada task approval yang pending.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Form</TableHead>
                                        <TableHead>Entity ID</TableHead>
                                        <TableHead>Workflow</TableHead>
                                        <TableHead>Step</TableHead>
                                        <TableHead>Submitted</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {pendingTasks.map((task) => (
                                        (() => {
                                            const stepConditionJson = (typeof task.stepConditionJson === "object" && task.stepConditionJson !== null)
                                                ? (task.stepConditionJson as Record<string, unknown>)
                                                : {}
                                            const instructions = typeof stepConditionJson.instructions === "string"
                                                ? stepConditionJson.instructions.trim()
                                                : ""
                                            const workflowNotePolicy = stepConditionJson.workflowNotePolicy === "optional"
                                                || stepConditionJson.workflowNotePolicy === "required_on_approve"
                                                || stepConditionJson.workflowNotePolicy === "required_on_reject"
                                                || stepConditionJson.workflowNotePolicy === "required_always"
                                                ? stepConditionJson.workflowNotePolicy
                                                : "required_on_approve"
                                            const noteHint = workflowNotePolicy === "optional"
                                                ? "Note optional"
                                                : workflowNotePolicy === "required_on_reject"
                                                    ? "Note wajib saat reject"
                                                    : workflowNotePolicy === "required_always"
                                                        ? "Note wajib untuk approve/reject"
                                                        : "Note wajib saat approve"

                                            return (
                                        <TableRow key={task.assignmentId}>
                                            <TableCell className="font-medium">{task.formKey}</TableCell>
                                            <TableCell>{task.entityId}</TableCell>
                                            <TableCell>{task.definitionName}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline">Step {task.stepOrder}</Badge>
                                                    <span>{task.stepName}</span>
                                                </div>
                                                {instructions ? (
                                                    <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">{instructions}</p>
                                                ) : null}
                                            </TableCell>
                                            <TableCell>
                                                {new Date(task.submittedAt).toLocaleString("id-ID")}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col items-end gap-2">
                                                    <span className="text-[10px] text-muted-foreground">{noteHint}</span>
                                                    <form
                                                        action={submitApprovalDecision}
                                                        className="flex items-center justify-end gap-2"
                                                    >
                                                        <input type="hidden" name="assignmentId" value={task.assignmentId} />
                                                        <Input
                                                            name="comment"
                                                            placeholder="Comment / workflow note"
                                                            className="h-8 w-44"
                                                        />
                                                        <Button size="sm" type="submit" name="decision" value="approve" className="gap-1">
                                                            <CheckCircle2 className="h-4 w-4" />
                                                            Approve
                                                        </Button>
                                                        <Button size="sm" variant="destructive" type="submit" name="decision" value="reject" className="gap-1">
                                                            <XCircle className="h-4 w-4" />
                                                            Reject
                                                        </Button>
                                                    </form>
                                                    <Button asChild size="sm" variant="outline">
                                                        <Link href={`/dashboard/approvals/${task.requestId}`}>Detail</Link>
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                            )
                                        })()
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                    <div>
                        <CardTitle>My Submissions</CardTitle>
                        <CardDescription>
                            Menampilkan semua approval request yang Anda submit.
                        </CardDescription>
                    </div>
                    <Badge variant="outline" className="gap-1">
                        <FileCheck2 className="h-3.5 w-3.5" />
                        {mySubmissions.length} request
                    </Badge>
                </CardHeader>
                <CardContent>
                    {mySubmissions.length === 0 ? (
                        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
                            Anda belum pernah submit approval request.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Form</TableHead>
                                        <TableHead>Entity ID</TableHead>
                                        <TableHead>Workflow</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Current Step</TableHead>
                                        <TableHead>Submitted</TableHead>
                                        <TableHead>Completed</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {mySubmissions.map((request) => (
                                        <TableRow key={request.requestId}>
                                            <TableCell className="font-medium">{request.formKey}</TableCell>
                                            <TableCell>{request.entityId}</TableCell>
                                            <TableCell>{request.definitionName}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{request.requestStatus}</Badge>
                                            </TableCell>
                                            <TableCell>{request.currentStepOrder}</TableCell>
                                            <TableCell>{new Date(request.submittedAt).toLocaleString("id-ID")}</TableCell>
                                            <TableCell>
                                                {request.completedAt
                                                    ? new Date(request.completedAt).toLocaleString("id-ID")
                                                    : "-"}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button asChild size="sm" variant="outline">
                                                        <Link href={`/dashboard/approvals/${request.requestId}`}>Detail</Link>
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
