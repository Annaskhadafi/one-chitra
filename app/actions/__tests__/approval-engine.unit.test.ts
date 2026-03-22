import { describe, it, expect, beforeAll } from "vitest"
import path from "node:path"
import { getApprovalTestUtils } from "../approval"

let __approvalTestUtils: Awaited<ReturnType<typeof getApprovalTestUtils>>

beforeAll(async () => {
  __approvalTestUtils = await getApprovalTestUtils()
})

describe("approval engine hardening utils", () => {
  describe("normalizeModuleRoute", () => {
    it("accepts valid dashboard route", () => {
      expect(__approvalTestUtils.normalizeModuleRoute("/dashboard/sales-orders")).toBe("/dashboard/sales-orders")
      expect(__approvalTestUtils.normalizeModuleRoute("dashboard/approvals")).toBe("/dashboard/approvals")
    })

    it("rejects traversal and non-dashboard paths", () => {
      expect(__approvalTestUtils.normalizeModuleRoute("/dashboard/../../etc")).toBeNull()
      expect(__approvalTestUtils.normalizeModuleRoute("/api/users")).toBeNull()
      expect(__approvalTestUtils.normalizeModuleRoute("../dashboard/approvals")).toBeNull()
    })
  })

  describe("resolveSafeDashboardModuleDir", () => {
    it("resolves only under app/dashboard", () => {
      const resolved = __approvalTestUtils.resolveSafeDashboardModuleDir("/dashboard/approvals")
      expect(resolved).toBeTruthy()
      expect(resolved).toBe(path.resolve(process.cwd(), "app", "dashboard", "approvals"))
    })

    it("rejects escaped path", () => {
      expect(__approvalTestUtils.resolveSafeDashboardModuleDir("/dashboard/../../tmp")).toBeNull()
    })
  })

  describe("getStepDueAt", () => {
    it("returns null for empty or invalid SLA", () => {
      const now = new Date("2026-03-03T00:00:00.000Z")
      expect(__approvalTestUtils.getStepDueAt(now, null)).toBeNull()
      expect(__approvalTestUtils.getStepDueAt(now, 0)).toBeNull()
      expect(__approvalTestUtils.getStepDueAt(now, -2)).toBeNull()
    })

    it("adds SLA days to baseline date", () => {
      const now = new Date("2026-03-03T00:00:00.000Z")
      const due = __approvalTestUtils.getStepDueAt(now, 2)
      expect(due?.toISOString()).toBe("2026-03-05T00:00:00.000Z")
    })
  })

  describe("P1 node routing", () => {
    it("routes deadline branch to overdue handle when dueAt passed", () => {
      const next = __approvalTestUtils.resolveNextStepOrderFromGraph(
        2,
        {
          nodeKind: "deadlineBranchNode",
          transitions: [
            { handle: "onTime", target: "step", targetStepOrder: 3 },
            { handle: "overdue", target: "step", targetStepOrder: 5 },
          ],
        },
        {},
        {
          requestDueAt: new Date(Date.now() - 60_000),
          requestMetadata: {},
          requestSubmittedAt: new Date(Date.now() - 2 * 60_000),
        }
      )

      expect(next).toBe(5)
    })

    it("routes wait-for-event to pending handle when event missing", () => {
      const next = __approvalTestUtils.resolveNextStepOrderFromGraph(
        4,
        {
          nodeKind: "waitEventNode",
          eventKey: "sapSynced",
          transitions: [
            { handle: "received", target: "step", targetStepOrder: 6 },
            { handle: "pending", target: "step", targetStepOrder: 4 },
          ],
        },
        {},
        {
          requestMetadata: { events: {} },
          requestDueAt: null,
          requestSubmittedAt: new Date(),
        }
      )

      expect(next).toBe(4)
    })

    it("evaluates wait-event node true when event is present", () => {
      const evaluated = __approvalTestUtils.evaluateConditionForStep(
        {
          nodeKind: "waitEventNode",
          eventKey: "sapSynced",
        },
        {},
        {
          requestMetadata: {
            events: {
              sapSynced: true,
            },
          },
          requestDueAt: null,
          requestSubmittedAt: new Date(),
        }
      )

      expect(evaluated).toBe(true)
    })
  })

  describe("P2 node routing", () => {
    it("routes switch node by case handle", () => {
      const next = __approvalTestUtils.resolveNextStepOrderFromGraph(
        1,
        {
          nodeKind: "switchNode",
          fieldKey: "category",
          caseA: "A",
          caseB: "B",
          caseC: "C",
          caseD: "D",
          caseE: "E",
          caseF: "F",
          transitions: [
            { handle: "caseA", target: "step", targetStepOrder: 2 },
            { handle: "caseB", target: "step", targetStepOrder: 3 },
            { handle: "caseC", target: "step", targetStepOrder: 4 },
            { handle: "caseD", target: "step", targetStepOrder: 6 },
            { handle: "caseE", target: "step", targetStepOrder: 7 },
            { handle: "caseF", target: "step", targetStepOrder: 8 },
            { handle: "default", target: "step", targetStepOrder: 5 },
          ],
        },
        { category: "E" },
        { requestMetadata: {}, requestDueAt: null, requestSubmittedAt: new Date() }
      )

      expect(next).toBe(7)
    })

    it("evaluates required attachment node correctly", () => {
      const hasAll = __approvalTestUtils.evaluateConditionForStep(
        {
          nodeKind: "requiredAttachmentNode",
          requiredKeys: "poFile,invoiceFile",
        },
        {},
        {
          requestMetadata: {
            attachments: {
              poFile: true,
              invoiceFile: true,
            },
          },
          requestDueAt: null,
          requestSubmittedAt: new Date(),
        }
      )

      expect(hasAll).toBe(true)
    })
  })
})
