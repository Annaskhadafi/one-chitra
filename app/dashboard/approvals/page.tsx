import { FileCheck2 } from "lucide-react"
import { Suspense } from "react"
import { getApprovalInbox } from "@/app/actions/approval"
import { InboxTab } from "./_components/inbox-tab"
import { ReportsTab } from "./_components/reports-tab"
import { StatusTab } from "./_components/status-tab"
import { TabShell } from "./_components/tab-shell"

export const metadata = {
  title: "Approvals – One Chitra",
}

type ApprovalPageProps = {
  searchParams: Promise<{ tab?: string }>
}

export default async function ApprovalPage({ searchParams }: ApprovalPageProps) {
  const { tab } = await searchParams
  const activeTab = tab ?? "inbox"

  const inbox = await getApprovalInbox()
  const pendingCount = inbox.pendingTasks.length

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <FileCheck2 className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Approvals</h1>
          <p className="text-sm text-muted-foreground">
            Kelola task approval, pantau status request, dan lihat laporan.
          </p>
        </div>
      </div>

      <TabShell
        defaultTab={activeTab}
        pendingCount={pendingCount}
        inboxContent={
          <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading...</div>}>
            <InboxTab />
          </Suspense>
        }
        statusContent={<StatusTab />}
        reportsContent={<ReportsTab />}
      />
    </div>
  )
}
