import { getApprovalInbox } from "@/app/actions/approval"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { InboxTableRow } from "./inbox-table-row"

export async function InboxTab() {
  const { pendingTasks } = await getApprovalInbox()

  if (pendingTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <p className="text-sm font-medium text-muted-foreground">Tidak ada task pending</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Semua approval request sudah diproses.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">ID</TableHead>
            <TableHead>Form</TableHead>
            <TableHead>Step</TableHead>
            <TableHead className="w-[140px]">Submitted</TableHead>
            <TableHead className="w-[100px]">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pendingTasks.map((task) => (
            <InboxTableRow
              key={task.assignmentId}
              href={`/dashboard/approvals/${task.requestId}`}
            >
              <TableCell className="font-mono text-xs">
                {task.requestId.slice(0, 8)}
              </TableCell>
              <TableCell>
                <div className="font-medium">{task.formKey}</div>
                <div className="text-xs text-muted-foreground">{task.definitionName}</div>
              </TableCell>
              <TableCell className="text-sm">
                {task.stepOrder}. {task.stepName}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(task.submittedAt).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200 text-xs">
                  Pending
                </Badge>
              </TableCell>
            </InboxTableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
