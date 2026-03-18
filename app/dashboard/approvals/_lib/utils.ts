import type { ApprovalStatusItem, StatusFilter, StepReorderItem, TimelineEntry, UIStepType } from "./types"

/**
 * Validates whether a comment satisfies the note policy for a given action.
 * Returns true if the action is allowed (comment is valid for the policy).
 *
 * Returns false when:
 * - policy is "required_on_approve" and action is "approve" and comment is empty/whitespace
 * - policy is "required_on_reject" and action is "reject" and comment is empty/whitespace
 * - policy is "required_always" and comment is empty/whitespace (regardless of action)
 */
export function validateNotePolicy(
  policy: string,
  comment: string,
  action: "approve" | "reject"
): boolean {
  const isEmpty = comment.trim().length === 0

  if (policy === "required_always" && isEmpty) return false
  if (policy === "required_on_approve" && action === "approve" && isEmpty) return false
  if (policy === "required_on_reject" && action === "reject" && isEmpty) return false

  return true
}

/**
 * Returns true if any assignment has status "approved" or "rejected".
 */
export function hasAnyApproverDecision(assignments: Array<{ status: string }>): boolean {
  return assignments.some((a) => a.status === "approved" || a.status === "rejected")
}

/**
 * Returns true only when ALL three conditions are met:
 * (a) userId === request.requesterId
 * (b) request.status === "pending"
 * (c) no assignment has status "approved" or "rejected"
 */
export function canRevert(
  request: { requesterId: string; status: string },
  assignments: Array<{ status: string }>,
  userId: string
): boolean {
  return (
    userId === request.requesterId &&
    request.status === "pending" &&
    !hasAnyApproverDecision(assignments)
  )
}

/**
 * Returns the subset of items matching ALL active filters.
 */
export function applyStatusFilters(
  items: ApprovalStatusItem[],
  filter: StatusFilter
): ApprovalStatusItem[] {
  return items.filter((item) => {
    if (filter.status !== "all" && item.status !== filter.status) return false

    if (filter.search && filter.search.trim().length > 0) {
      if (!item.requestId.toLowerCase().includes(filter.search.toLowerCase())) return false
    }

    if (filter.dateFrom) {
      if (item.submittedAt < new Date(filter.dateFrom)) return false
    }

    if (filter.dateTo) {
      const endOfDay = new Date(filter.dateTo)
      endOfDay.setHours(23, 59, 59, 999)
      if (item.submittedAt > endOfDay) return false
    }

    if (filter.formKey && item.formKey !== filter.formKey) return false

    return true
  })
}

/**
 * Returns true if the reorder is valid:
 * (a) same set of stepIds (no additions/removals)
 * (b) no duplicate stepOrder values in reordered
 * (c) all stepOrder values are positive integers (> 0)
 */
export function validateStepReorder(
  original: StepReorderItem[],
  reordered: StepReorderItem[]
): boolean {
  if (original.length !== reordered.length) return false

  const originalIds = new Set(original.map((s) => s.stepId))
  const reorderedIds = new Set(reordered.map((s) => s.stepId))

  if (originalIds.size !== reorderedIds.size) return false
  for (const id of originalIds) {
    if (!reorderedIds.has(id)) return false
  }

  const orders = reordered.map((s) => s.newStepOrder)
  const uniqueOrders = new Set(orders)
  if (uniqueOrders.size !== orders.length) return false

  for (const order of orders) {
    if (!Number.isInteger(order) || order <= 0) return false
  }

  return true
}

/**
 * Returns entries sorted ascending by createdAt (oldest first).
 * Does not mutate the input array.
 */
export function sortTimelineEntries(entries: TimelineEntry[]): TimelineEntry[] {
  return [...entries].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
}

export function deriveStepType(conditionJson: Record<string, unknown>): UIStepType {
  const nodeKind = conditionJson?.nodeKind as string | undefined
  switch (nodeKind) {
    case "approvalStep":
    case "parallelApproval":
      return "approval"
    case "notifyNode":
      return "notification"
    case "updateUserNode":
      return "update_user"
    case "userInputNode":
      return "user_input"
    default:
      return "approval"
  }
}
