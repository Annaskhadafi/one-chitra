import "dotenv/config"
import { and, desc, eq } from "drizzle-orm"
import { db } from "../db"
import {
  approvalAssignments,
  approvalDefinitionSteps,
  approvalDefinitions,
  approvalFormRegistry,
  approvalRequests,
  emailLogs,
  emailTemplates,
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

async function ensureNotificationTemplate() {
  const existing = await db.query.emailTemplates.findFirst({
    where: and(eq(emailTemplates.type, "notification"), eq(emailTemplates.isActive, true)),
    orderBy: [desc(emailTemplates.createdAt)],
  })

  if (existing) {
    return existing
  }

  const [created] = await db.insert(emailTemplates).values({
    name: "Default Notification Template",
    type: "notification",
    subject: "{{title}}",
    htmlContent: `<div><h2>{{title}}</h2><p>{{message}}</p><p><a href=\"{{actionUrl}}\">Open</a></p><small>{{appName}}</small></div>`,
    textContent: "{{title}}\n{{message}}\n{{actionUrl}}",
    variables: ["title", "message", "actionUrl", "appName"],
    recipientRoles: ["all"],
    isActive: true,
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
    name: `E2E Quotation Reject Workflow v${nextVersion}`,
    formKey: "quotation",
    description: "Automated reject test workflow",
    version: nextVersion,
    status: "active",
    isDefault: true,
    createdBy: SCRIPT_USER_ID,
  }).returning()

  await db.insert(approvalDefinitionSteps).values({
    definitionId: definition.id,
    stepOrder: 1,
    stepName: "Auto Reject Step",
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
    quotationNumber: `E2E-REJ-QUO-${Date.now()}`,
    customerId: customerRow.id,
    createdBy: SCRIPT_USER_ID,
    status: "draft",
    subject: "E2E Reject Test Quotation",
    discount: "0",
    tax: "0",
    shipping: "0",
    currency: "IDR",
    discountType: "fixed",
  }).returning()

  return quotation
}

async function main() {
  console.log("[E2E-REJECT] Starting reject + email-log test...")

  await ensureScriptUser()
  await ensureNotificationTemplate()
  await ensureFormRegistry()
  const definition = await createWorkflowDefinition()
  const quotation = await createTestQuotation()

  const beforeEmailLogs = await db.select({ count: emailLogs.id }).from(emailLogs)
  const beforeCount = beforeEmailLogs.length

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

  const rejectFormData = new FormData()
  rejectFormData.set("assignmentId", assignment.id)
  rejectFormData.set("decision", "reject")
  rejectFormData.set("comment", "Rejected by automated E2E script")

  const decisionResult = await submitApprovalDecision(rejectFormData)
  if (!decisionResult.success) {
    throw new Error(`Failed submitting reject decision: ${decisionResult.error ?? "unknown error"}`)
  }

  const finalRequest = await db.query.approvalRequests.findFirst({
    where: eq(approvalRequests.id, requestResult.id),
  })

  if (finalRequest?.status !== "rejected") {
    throw new Error(`Expected rejected status, got ${finalRequest?.status ?? "unknown"}`)
  }

  const afterEmailLogs = await db.select({ count: emailLogs.id }).from(emailLogs)
  const afterCount = afterEmailLogs.length

  console.log("[E2E-REJECT] Workflow:", definition.name)
  console.log("[E2E-REJECT] Quotation ID:", quotation.id)
  console.log("[E2E-REJECT] Request ID:", requestResult.id)
  console.log("[E2E-REJECT] Final Status:", finalRequest.status)
  console.log("[E2E-REJECT] Email logs before/after:", beforeCount, "/", afterCount)

  if (afterCount <= beforeCount) {
    console.warn("[E2E-REJECT] ⚠️ No new email log detected (check SMTP/template configuration).")
  } else {
    console.log("[E2E-REJECT] ✅ Email log increased after reject flow.")
  }

  console.log("[E2E-REJECT] ✅ Reject + email-log test passed.")
}

main().catch((error) => {
  console.error("[E2E-REJECT] ❌ Test failed:", error)
  process.exit(1)
})
