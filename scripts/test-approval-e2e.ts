import "dotenv/config"
import { and, desc, eq } from "drizzle-orm"
import { db } from "../db"
import {
  approvalAssignments,
  approvalDefinitionSteps,
  approvalDefinitions,
  approvalFormRegistry,
  approvalRequests,
  quotations,
  user,
} from "../db/schema"
import { createApprovalRequestForEntity, submitApprovalDecision } from "../app/actions/approval"

const SCRIPT_USER_ID = "QtRav31w2URDoLREkWt1DSzj3hXuFnh0"

async function ensureScriptUser() {
  const existing = await db.query.user.findFirst({ where: eq(user.id, SCRIPT_USER_ID) })
  if (existing) {
    return existing
  }

  const [created] = await db.insert(user).values({
    id: SCRIPT_USER_ID,
    name: "Approval Script User",
    email: "approval-script-user@onechitra.local",
    role: "admin",
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning()

  return created
}

async function ensureFormRegistry() {
  const existing = await db.query.approvalFormRegistry.findFirst({
    where: eq(approvalFormRegistry.formKey, "quotation"),
  })

  if (existing) {
    return existing
  }

  const [created] = await db.insert(approvalFormRegistry).values({
    formKey: "quotation",
    formName: "Quotation",
    modulePath: "/dashboard/quotations",
    isActive: true,
    createdBy: SCRIPT_USER_ID,
  }).returning()

  return created
}

async function createWorkflowDefinition() {
  const latest = await db
    .select({ version: approvalDefinitions.version })
    .from(approvalDefinitions)
    .where(eq(approvalDefinitions.formKey, "quotation"))
    .orderBy(desc(approvalDefinitions.version))
    .limit(1)

  const nextVersion = (latest[0]?.version ?? 0) + 1

  const [definition] = await db.insert(approvalDefinitions).values({
    name: `E2E Quotation Workflow v${nextVersion}`,
    formKey: "quotation",
    description: "Automated E2E test workflow",
    version: nextVersion,
    status: "active",
    isDefault: true,
    createdBy: SCRIPT_USER_ID,
  }).returning()

  await db.insert(approvalDefinitionSteps).values({
    definitionId: definition.id,
    stepOrder: 1,
    stepName: "Auto Approval Step",
    approverType: "user",
    approverUserId: SCRIPT_USER_ID,
    minApprovals: 1,
  })

  return definition
}

async function createTestQuotation() {
  const customerRow = await db.query.customers.findFirst({
    orderBy: (c, { asc }) => [asc(c.id)],
  })

  if (!customerRow) {
    throw new Error("No customer found. Please seed customers first.")
  }

  const [quotation] = await db.insert(quotations).values({
    quotationNumber: `E2E-QUO-${Date.now()}`,
    customerId: customerRow.id,
    createdBy: SCRIPT_USER_ID,
    status: "draft",
    subject: "E2E Approval Test Quotation",
    discount: "0",
    tax: "0",
    shipping: "0",
    currency: "IDR",
    discountType: "fixed",
  }).returning()

  return quotation
}

async function main() {
  console.log("[E2E] Starting approval workflow test...")

  await ensureScriptUser()
  await ensureFormRegistry()
  const definition = await createWorkflowDefinition()
  const quotation = await createTestQuotation()

  const requestResult = await createApprovalRequestForEntity({
    formKey: "quotation",
    entityId: String(quotation.id),
    requesterId: SCRIPT_USER_ID,
  })

  if (!requestResult.success || !requestResult.id) {
    throw new Error(`Failed creating approval request: ${requestResult.error ?? "unknown error"}`)
  }

  const assignment = await db.query.approvalAssignments.findFirst({
    where: and(
      eq(approvalAssignments.requestId, requestResult.id),
      eq(approvalAssignments.status, "pending")
    ),
  })

  if (!assignment) {
    throw new Error("No pending assignment found after request creation.")
  }

  const approvalFormData = new FormData()
  approvalFormData.set("assignmentId", assignment.id)
  approvalFormData.set("decision", "approve")
  approvalFormData.set("comment", "Approved by automated E2E script")

  const decisionResult = await submitApprovalDecision(approvalFormData)
  if (!decisionResult.success) {
    throw new Error(`Failed submitting approval decision: ${decisionResult.error ?? "unknown error"}`)
  }

  const finalRequest = await db.query.approvalRequests.findFirst({
    where: eq(approvalRequests.id, requestResult.id),
  })

  console.log("[E2E] Workflow:", definition.name)
  console.log("[E2E] Quotation ID:", quotation.id)
  console.log("[E2E] Request ID:", requestResult.id)
  console.log("[E2E] Final Status:", finalRequest?.status)

  if (finalRequest?.status !== "approved") {
    throw new Error(`Expected approved status, got ${finalRequest?.status ?? "unknown"}`)
  }

  console.log("[E2E] ✅ Approval end-to-end test passed.")
}

main().catch((error) => {
  console.error("[E2E] ❌ Approval end-to-end test failed:", error)
  process.exit(1)
})
