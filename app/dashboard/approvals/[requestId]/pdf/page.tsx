import { notFound } from "next/navigation"
import { getApprovalRequestDetail } from "@/app/actions/approval"

export default async function ApprovalRequestPdfPage({
    params,
}: {
    params: Promise<{ requestId: string }>
}) {
    const { requestId } = await params
    const detail = await getApprovalRequestDetail(requestId)

    if (!detail) {
        notFound()
    }

    return (
        <main className="mx-auto max-w-4xl space-y-4 p-8 text-sm print:p-4">
            <header className="border-b pb-4">
                <h1 className="text-2xl font-bold">Approval Request Report</h1>
                <p>Request ID: {detail.id}</p>
                <p>Form: {detail.formKey} · Entity: {detail.entityId}</p>
                <p>Workflow: {detail.definition?.name}</p>
                <p>Status: {detail.status}</p>
                <p>Submitted: {new Date(detail.submittedAt).toLocaleString("id-ID")}</p>
            </header>

            <section className="space-y-2">
                <h2 className="text-lg font-semibold">Approval Steps</h2>
                <table className="w-full border-collapse border">
                    <thead>
                        <tr>
                            <th className="border p-2 text-left">Step</th>
                            <th className="border p-2 text-left">Assignee</th>
                            <th className="border p-2 text-left">Status</th>
                            <th className="border p-2 text-left">Acted At</th>
                            <th className="border p-2 text-left">Comment</th>
                        </tr>
                    </thead>
                    <tbody>
                        {detail.assignments.map((assignment) => (
                            <tr key={assignment.id}>
                                <td className="border p-2">{assignment.stepOrder}. {assignment.step?.stepName}</td>
                                <td className="border p-2">{assignment.assignee?.name ?? assignment.assigneeUserId}</td>
                                <td className="border p-2">{assignment.status}</td>
                                <td className="border p-2">{assignment.actedAt ? new Date(assignment.actedAt).toLocaleString("id-ID") : "-"}</td>
                                <td className="border p-2">{assignment.comment ?? "-"}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>

            <section className="space-y-2">
                <h2 className="text-lg font-semibold">Audit Trail</h2>
                <table className="w-full border-collapse border">
                    <thead>
                        <tr>
                            <th className="border p-2 text-left">Time</th>
                            <th className="border p-2 text-left">Action</th>
                            <th className="border p-2 text-left">Actor</th>
                        </tr>
                    </thead>
                    <tbody>
                        {detail.auditLogs.map((log) => (
                            <tr key={log.id}>
                                <td className="border p-2">{new Date(log.createdAt).toLocaleString("id-ID")}</td>
                                <td className="border p-2">{log.action}</td>
                                <td className="border p-2">{log.actor?.name ?? log.actorUserId ?? "system"}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>
        </main>
    )
}
