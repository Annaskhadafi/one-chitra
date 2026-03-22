import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { and, eq } from "drizzle-orm"
import { db } from "@/db"
import {
  approvalAssignments,
  approvalDefinitionSteps,
  approvalDefinitions,
  approvalFormRegistry,
  approvalRequests,
  user,
} from "@/db/schema"
import { createApprovalRequestForEntity, submitApprovalDecision } from "../approval"

const TEST_APPROVER_ID = "test-approver-race"
const TEST_REQUESTER_ID = "test-requester-race"
const TEST_FORM_KEY = `approval-race-${Date.now()}`

vi.mock("@/lib/rbac", () => ({
  getAuthenticatedSession: vi.fn().mockResolvedValue({
    user: { id: "test-approver-race" },
    session: { id: "test-session-race" },
  }),
  checkPermission: vi.fn().mockResolvedValue(true),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

vi.mock("@/lib/email", () => ({
  sendNotificationEmail: vi.fn().mockResolvedValue(undefined),
  sendSystemTemplatedEmailByCode: vi.fn().mockResolvedValue(undefined),
}))

let definitionId = ""
let requestId = ""

beforeAll(async () => {
  await db.insert(user).values({
    id: TEST_APPROVER_ID,
    name: "Test Approver",
    email: "approver-race@onechitra.local",
    role: "manager",
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).onConflictDoNothing()

  await db.insert(user).values({
    id: TEST_REQUESTER_ID,
    name: "Test Requester",
    email: "requester-race@onechitra.local",
    role: "staff",
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).onConflictDoNothing()

  await db.insert(approvalFormRegistry).values({
    formKey: TEST_FORM_KEY,
    formName: "Approval Race Form",
    modulePath: "/dashboard/approvals",
    isActive: true,
    createdBy: TEST_REQUESTER_ID,
  }).onConflictDoNothing()

  const [definition] = await db.insert(approvalDefinitions).values({
    name: "Approval Race Definition",
    formKey: TEST_FORM_KEY,
    version: 1,
    status: "active",
    isDefault: true,
    createdBy: TEST_REQUESTER_ID,
  }).returning({ id: approvalDefinitions.id })
  definitionId = definition.id

  await db.insert(approvalDefinitionSteps).values({
    definitionId,
    stepOrder: 1,
    stepName: "Manager Approval",
    approverType: "user",
    approverUserId: TEST_APPROVER_ID,
    minApprovals: 1,
    notifyOnAssign: false,
    notifyOnComplete: false,
  })

  const created = await createApprovalRequestForEntity({
    formKey: TEST_FORM_KEY,
    entityId: `entity-${Date.now()}`,
    requesterId: TEST_REQUESTER_ID,
    conditionSnapshot: { amount: 1000 },
  })

  if (!created.success || !created.id) {
    throw new Error(created.success ? "request id missing" : (created.error ?? "failed creating request"))
  }

  requestId = created.id
})

afterAll(async () => {
  // Full cascade cleanup — handles both current run and any orphaned data from previous failed runs.
  // Order: assignments → requests → steps → definitions → form_registry → users

  // 1. Delete all requests submitted by the test requester (covers current + orphaned runs)
  const orphanedRequests = await db.select({ id: approvalRequests.id })
    .from(approvalRequests)
    .where(eq(approvalRequests.requesterId, TEST_REQUESTER_ID))
  for (const req of orphanedRequests) {
    await db.delete(approvalAssignments).where(eq(approvalAssignments.requestId, req.id))
  }
  await db.delete(approvalRequests).where(eq(approvalRequests.requesterId, TEST_REQUESTER_ID))

  // 2. Delete all definitions created by the test requester (covers current + orphaned runs)
  const orphanedDefs = await db.select({ id: approvalDefinitions.id })
    .from(approvalDefinitions)
    .where(eq(approvalDefinitions.createdBy, TEST_REQUESTER_ID))
  for (const def of orphanedDefs) {
    const steps = await db.select({ id: approvalDefinitionSteps.id })
      .from(approvalDefinitionSteps)
      .where(eq(approvalDefinitionSteps.definitionId, def.id))
    for (const step of steps) {
      await db.delete(approvalAssignments).where(eq(approvalAssignments.stepId, step.id))
    }
    await db.delete(approvalDefinitionSteps).where(eq(approvalDefinitionSteps.definitionId, def.id))
  }
  await db.delete(approvalDefinitions).where(eq(approvalDefinitions.createdBy, TEST_REQUESTER_ID))

  // 3. Delete all steps referencing the test approver user
  const approverSteps = await db.select({ id: approvalDefinitionSteps.id })
    .from(approvalDefinitionSteps)
    .where(eq(approvalDefinitionSteps.approverUserId, TEST_APPROVER_ID))
  for (const step of approverSteps) {
    await db.delete(approvalAssignments).where(eq(approvalAssignments.stepId, step.id))
  }
  if (approverSteps.length > 0) {
    await db.delete(approvalDefinitionSteps).where(eq(approvalDefinitionSteps.approverUserId, TEST_APPROVER_ID))
  }

  // 4. Delete form registry entries created by test users
  await db.delete(approvalFormRegistry).where(eq(approvalFormRegistry.createdBy, TEST_REQUESTER_ID))
  await db.delete(approvalFormRegistry).where(eq(approvalFormRegistry.formKey, TEST_FORM_KEY))

  // 5. Finally delete the test users
  await db.delete(user).where(and(eq(user.id, TEST_APPROVER_ID), eq(user.email, "approver-race@onechitra.local")))
  await db.delete(user).where(and(eq(user.id, TEST_REQUESTER_ID), eq(user.email, "requester-race@onechitra.local")))
})

describe("approval decision concurrency", () => {
  it("allows only one atomic decision for same assignment", async () => {
    const assignment = await db.query.approvalAssignments.findFirst({
      where: and(
        eq(approvalAssignments.requestId, requestId),
        eq(approvalAssignments.status, "pending"),
        eq(approvalAssignments.assigneeUserId, TEST_APPROVER_ID)
      ),
    })

    expect(assignment).toBeTruthy()

    const makeForm = () => {
      const form = new FormData()
      form.set("assignmentId", assignment!.id)
      form.set("decision", "approve")
      form.set("comment", "approved in race test")
      return form
    }

    const [a, b] = await Promise.all([
      submitApprovalDecision(makeForm()),
      submitApprovalDecision(makeForm()),
    ])

    const successCount = [a, b].filter((item) => item.success).length
    const failCount = [a, b].filter((item) => !item.success).length

    expect(successCount).toBe(1)
    expect(failCount).toBe(1)

    const request = await db.query.approvalRequests.findFirst({
      where: eq(approvalRequests.id, requestId),
    })

    expect(request?.status).toBe("approved")
  })
})
