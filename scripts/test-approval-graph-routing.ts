import "dotenv/config"
import { and, desc, eq, inArray } from "drizzle-orm"
import { db } from "../db"
import {
  approvalAssignments,
  approvalDefinitionSteps,
  approvalDefinitions,
  approvalFormRegistry,
  approvalRequests,
  user,
} from "../db/schema"
import { createApprovalRequestForEntity } from "../app/actions/approval"

const SCRIPT_USER_ID = "QtRav31w2URDoLREkWt1DSzj3hXuFnh0"
const REVIEWER_USER_ID = "QtRav31w2URDoLREkWt1DSzj3hXuFnh1"

async function ensureUser(id: string, email: string, name: string, role = "admin") {
  const existing = await db.query.user.findFirst({ where: eq(user.id, id) })
  if (existing) return existing

  const [created] = await db.insert(user).values({
    id,
    name,
    email,
    role,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning()

  return created
}

async function ensureFormRegistry(formKey: string, formName: string, modulePath: string) {
  const existing = await db.query.approvalFormRegistry.findFirst({
    where: eq(approvalFormRegistry.formKey, formKey),
  })

  if (existing) return existing

  const [created] = await db.insert(approvalFormRegistry).values({
    formKey,
    formName,
    modulePath,
    isActive: true,
    createdBy: SCRIPT_USER_ID,
  }).returning()

  return created
}

async function createDefinition(formKey: string, namePrefix: string) {
  const latest = await db
    .select({ version: approvalDefinitions.version })
    .from(approvalDefinitions)
    .where(eq(approvalDefinitions.formKey, formKey))
    .orderBy(desc(approvalDefinitions.version))
    .limit(1)

  const nextVersion = (latest[0]?.version ?? 0) + 1

  const [definition] = await db.insert(approvalDefinitions).values({
    name: `${namePrefix} v${nextVersion}`,
    formKey,
    description: "Automated graph-routing test",
    version: nextVersion,
    status: "active",
    isDefault: true,
    createdBy: SCRIPT_USER_ID,
  }).returning()

  return definition
}

async function runConditionBranchingTest() {
  const formKey = "quotation-graph-route"
  await ensureFormRegistry(formKey, "Quotation Graph Route", "/dashboard/quotations")
  const definition = await createDefinition(formKey, "Graph Condition Routing")

  await db.insert(approvalDefinitionSteps).values([
    {
      definitionId: definition.id,
      stepOrder: 1,
      stepName: "Check Category",
      approverType: "role",
      approverRole: "admin",
      minApprovals: 1,
      conditionJson: {
        nodeKind: "conditionByField",
        fieldKey: "categoryPo",
        fieldDataType: "string",
        operator: "eq",
        targetValue: "VIP",
        transitions: [
          { handle: "match", targetStepOrder: 3, target: "step" },
          { handle: "notMatch", targetStepOrder: 2, target: "step" },
        ],
      },
    },
    {
      definitionId: definition.id,
      stepOrder: 2,
      stepName: "Normal Reviewer",
      approverType: "user",
      approverUserId: SCRIPT_USER_ID,
      minApprovals: 1,
      conditionJson: {
        nodeKind: "approvalStep",
        transitions: [{ handle: "out", target: "end", targetStepOrder: null }],
      },
    },
    {
      definitionId: definition.id,
      stepOrder: 3,
      stepName: "VIP Reviewer",
      approverType: "user",
      approverUserId: SCRIPT_USER_ID,
      minApprovals: 1,
      conditionJson: {
        nodeKind: "approvalStep",
        transitions: [{ handle: "out", target: "end", targetStepOrder: null }],
      },
    },
  ])

  const vipRequest = await createApprovalRequestForEntity({
    formKey,
    entityId: `VIP-${Date.now()}`,
    requesterId: SCRIPT_USER_ID,
    conditionSnapshot: { categoryPo: "VIP" },
  })

  if (!vipRequest.success || !vipRequest.id) {
    throw new Error(`VIP request creation failed: ${vipRequest.error ?? "unknown"}`)
  }

  const vipPending = await db.query.approvalAssignments.findFirst({
    where: and(eq(approvalAssignments.requestId, vipRequest.id), eq(approvalAssignments.status, "pending")),
  })

  if (!vipPending || vipPending.stepOrder !== 3) {
    throw new Error(`Expected VIP route to stepOrder 3, got ${vipPending?.stepOrder ?? "none"}`)
  }

  const normalRequest = await createApprovalRequestForEntity({
    formKey,
    entityId: `NORMAL-${Date.now()}`,
    requesterId: SCRIPT_USER_ID,
    conditionSnapshot: { categoryPo: "REGULAR" },
  })

  if (!normalRequest.success || !normalRequest.id) {
    throw new Error(`Normal request creation failed: ${normalRequest.error ?? "unknown"}`)
  }

  const normalPending = await db.query.approvalAssignments.findFirst({
    where: and(eq(approvalAssignments.requestId, normalRequest.id), eq(approvalAssignments.status, "pending")),
  })

  if (!normalPending || normalPending.stepOrder !== 2) {
    throw new Error(`Expected normal route to stepOrder 2, got ${normalPending?.stepOrder ?? "none"}`)
  }

  console.log("[GRAPH] ✅ Condition branching routing works (VIP->3, REGULAR->2)")
}

async function runParallelExplicitAssigneeTest() {
  const formKey = "quotation-parallel-explicit"
  await ensureFormRegistry(formKey, "Quotation Parallel Explicit", "/dashboard/quotations")
  const definition = await createDefinition(formKey, "Parallel Explicit Routing")

  await db.insert(approvalDefinitionSteps).values([
    {
      definitionId: definition.id,
      stepOrder: 1,
      stepName: "Parallel Explicit",
      approverType: "role",
      approverRole: "admin",
      minApprovals: 2,
      conditionJson: {
        nodeKind: "parallelApproval",
        parallelStrategy: "quorum",
        expectedApprovers: 2,
        approverUserIds: [SCRIPT_USER_ID, REVIEWER_USER_ID],
        transitions: [{ handle: "out", target: "end", targetStepOrder: null }],
      },
    },
  ])

  const requestResult = await createApprovalRequestForEntity({
    formKey,
    entityId: `PAR-${Date.now()}`,
    requesterId: SCRIPT_USER_ID,
    conditionSnapshot: { any: true },
  })

  if (!requestResult.success || !requestResult.id) {
    throw new Error(`Parallel request creation failed: ${requestResult.error ?? "unknown"}`)
  }

  const assignments = await db
    .select({ assigneeUserId: approvalAssignments.assigneeUserId })
    .from(approvalAssignments)
    .where(eq(approvalAssignments.requestId, requestResult.id))

  const assigneeIds = assignments.map((item) => item.assigneeUserId).sort()
  const expected = [SCRIPT_USER_ID, REVIEWER_USER_ID].sort()

  if (assigneeIds.length !== expected.length || assigneeIds.some((id, idx) => id !== expected[idx])) {
    throw new Error(`Parallel explicit assignees mismatch: expected ${expected.join(",")}, got ${assigneeIds.join(",")}`)
  }

  console.log("[GRAPH] ✅ Parallel explicit approver assignment works")
}

async function main() {
  console.log("[GRAPH] Starting graph-runtime approval tests...")

  await ensureUser(SCRIPT_USER_ID, "approval-script-user@onechitra.local", "Approval Script User", "admin")
  await ensureUser(REVIEWER_USER_ID, "approval-reviewer@onechitra.local", "Approval Reviewer", "reviewer")

  await runConditionBranchingTest()
  await runParallelExplicitAssigneeTest()

  const recent = await db
    .select({ id: approvalRequests.id, formKey: approvalRequests.formKey, currentStepOrder: approvalRequests.currentStepOrder, status: approvalRequests.status })
    .from(approvalRequests)
    .where(inArray(approvalRequests.formKey, ["quotation-graph-route", "quotation-parallel-explicit"]))
    .orderBy(desc(approvalRequests.createdAt))
    .limit(4)

  console.log("[GRAPH] Recent requests:", recent)
  console.log("[GRAPH] ✅ All graph runtime tests passed")
}

main().catch((error) => {
  console.error("[GRAPH] ❌ Graph runtime tests failed:", error)
  process.exit(1)
})
