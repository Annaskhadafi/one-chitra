// Types for the Approval Workflow Enhancement feature

export type PendingTask = {
  assignmentId: string
  requestId: string
  formKey: string
  submitterName: string
  stepName: string
  stepOrder: number
  submittedAt: Date
}

export type ApprovalStatusItem = {
  requestId: string
  formKey: string
  definitionName: string
  requesterId: string
  requesterName: string
  status: "pending" | "approved" | "rejected" | "cancelled"
  currentStepOrder: number | null
  submittedAt: Date
  completedAt: Date | null
}

export type StatusFilter = {
  status: "all" | "pending" | "approved" | "rejected" | "cancelled"
  search: string
  dateFrom: string | null
  dateTo: string | null
  formKey: string | null
}

export type ApprovalReportsData = {
  byStatus: Record<string, number>
  avgCompletionDays: number | null
  stepBottlenecks: { stepName: string; stepOrder: number; pendingCount: number }[]
  dateRange: { from: Date | null; to: Date | null }
}

export type StepReorderItem = {
  stepId: number
  newStepOrder: number
}

export type TimelineEntry = {
  id: string
  action: "submitted" | "approved" | "rejected" | "reverted" | "commented" | "escalate" | "cancel"
  actorName: string
  createdAt: Date
  comment?: string | null
}

export type UIStepType = "approval" | "notification" | "update_user" | "user_input"

export type WorkflowStep = {
  id: number
  stepOrder: number
  stepName: string
  stepType: UIStepType
  entriesCount: number
  conditionJson: Record<string, unknown>
}

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }
