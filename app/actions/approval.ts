"use server"

import { revalidatePath } from "next/cache"
import { readdir } from "node:fs/promises"
import path from "node:path"
import { and, asc, count, desc, eq, ilike, inArray } from "drizzle-orm"
import Papa from "papaparse"
import * as XLSX from "xlsx"
import { db } from "@/db"
import {
    approvalAssignments,
    approvalAuditLogs,
    approvalDefinitionSteps,
    approvalDefinitions,
    approvalFormRegistry,
    approvalMatrixImports,
    approvalOrgStructureNodes,
    approvalOrgStructures,
    approvalRequests,
    user,
} from "@/db/schema"
import { checkPermission, getAuthenticatedSession } from "@/lib/rbac"
import { sendNotificationEmail } from "@/lib/email"

type DecisionType = "approve" | "reject"

type MatrixRow = {
    formKey: string
    formName?: string
    modulePath?: string
    workflowName: string
    description?: string
    status?: "draft" | "active"
    stepOrder?: number
    stepName: string
    approverType?: "role" | "user"
    approverRole?: string
    approverUserId?: string
    minApprovals?: number
}

type WebsiteFormOption = {
    formKey: string
    formName: string
    modulePath: string
}

function toTitleCase(value: string) {
    return value
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")
}

function buildFormOptionFromRoute(route: string): WebsiteFormOption {
    const cleanRoute = route.replace(/\/+$/, "") || "/dashboard"
    const segments = cleanRoute
        .replace(/^\/dashboard\/?/, "")
        .split("/")
        .filter(Boolean)

    const formKey = segments.length > 0 ? segments.join("-") : "dashboard"
    const formName = segments.length > 0 ? segments.map(toTitleCase).join(" · ") : "Dashboard"

    return {
        formKey,
        formName,
        modulePath: cleanRoute,
    }
}

async function collectDashboardRoutes(currentDir: string, segments: string[] = []): Promise<string[]> {
    const entries = await readdir(currentDir, { withFileTypes: true })
    const routes: string[] = []

    const hasPage = entries.some((entry) => entry.isFile() && entry.name === "page.tsx")
    if (hasPage) {
        const routePath = segments.length > 0 ? `/dashboard/${segments.join("/")}` : "/dashboard"
        routes.push(routePath)
    }

    for (const entry of entries) {
        if (!entry.isDirectory()) {
            continue
        }

        const segment = entry.name
        if (segment.startsWith("_") || segment.startsWith("(")) {
            continue
        }

        routes.push(...await collectDashboardRoutes(path.join(currentDir, segment), [...segments, segment]))
    }

    return routes
}

function safeRevalidatePath(path: string) {
    try {
        revalidatePath(path)
    } catch {
        // no-op for script/non-request contexts
    }
}

async function resolveAssigneeIds(stepId: number) {
    const step = await db.query.approvalDefinitionSteps.findFirst({
        where: eq(approvalDefinitionSteps.id, stepId),
    })

    if (!step) {
        throw new Error("Approval step not found")
    }

    if (step.approverType === "user") {
        if (!step.approverUserId) {
            throw new Error("Approver user is not configured on this step")
        }
        return { step, assigneeIds: [step.approverUserId] }
    }

    if (!step.approverRole) {
        throw new Error("Approver role is not configured on this step")
    }

    const roleUsers = await db
        .select({ id: user.id })
        .from(user)
        .where(ilike(user.role, step.approverRole))

    if (roleUsers.length === 0) {
        throw new Error(`No users found for role ${step.approverRole}`)
    }

    return { step, assigneeIds: roleUsers.map((entry) => entry.id) }
}

async function createAssignmentsForStep(requestId: string, stepId: number, stepOrder: number) {
    const { assigneeIds } = await resolveAssigneeIds(stepId)

    await db.insert(approvalAssignments).values(
        assigneeIds.map((assigneeId) => ({
            requestId,
            stepId,
            stepOrder,
            assigneeUserId: assigneeId,
        }))
    )

    const recipients = await db
        .select({ email: user.email })
        .from(user)
        .where(inArray(user.id, assigneeIds))

    const recipientEmails = recipients.map((entry) => entry.email).filter(Boolean)
    if (recipientEmails.length > 0) {
        await sendNotificationEmail(
            recipientEmails,
            "New Approval Assignment",
            `You have a new approval task (Request ID: ${requestId}, Step ${stepOrder}).`,
            `/dashboard/approvals/${requestId}`
        )
    }
}

export async function getApprovalInbox() {
    const session = await getAuthenticatedSession()

    const rows = await db
        .select({
            assignmentId: approvalAssignments.id,
            requestId: approvalRequests.id,
            requestStatus: approvalRequests.status,
            formKey: approvalRequests.formKey,
            entityId: approvalRequests.entityId,
            currentStepOrder: approvalRequests.currentStepOrder,
            stepName: approvalDefinitionSteps.stepName,
            stepOrder: approvalAssignments.stepOrder,
            definitionName: approvalDefinitions.name,
            submittedAt: approvalRequests.submittedAt,
            dueAt: approvalRequests.dueAt,
            assignmentStatus: approvalAssignments.status,
        })
        .from(approvalAssignments)
        .innerJoin(approvalRequests, eq(approvalAssignments.requestId, approvalRequests.id))
        .innerJoin(approvalDefinitions, eq(approvalRequests.definitionId, approvalDefinitions.id))
        .innerJoin(approvalDefinitionSteps, eq(approvalAssignments.stepId, approvalDefinitionSteps.id))
        .where(
            and(
                eq(approvalAssignments.assigneeUserId, session.user.id),
                eq(approvalAssignments.status, "pending"),
                eq(approvalRequests.status, "pending")
            )
        )
        .orderBy(asc(approvalRequests.submittedAt))

    const myRequests = await db
        .select({
            requestId: approvalRequests.id,
            requestStatus: approvalRequests.status,
            formKey: approvalRequests.formKey,
            entityId: approvalRequests.entityId,
            currentStepOrder: approvalRequests.currentStepOrder,
            definitionName: approvalDefinitions.name,
            submittedAt: approvalRequests.submittedAt,
            completedAt: approvalRequests.completedAt,
            dueAt: approvalRequests.dueAt,
        })
        .from(approvalRequests)
        .innerJoin(approvalDefinitions, eq(approvalRequests.definitionId, approvalDefinitions.id))
        .where(eq(approvalRequests.requesterId, session.user.id))
        .orderBy(desc(approvalRequests.submittedAt))

    return {
        pendingTasks: rows,
        mySubmissions: myRequests,
    }
}

export async function getApprovalDefinitions() {
    await getAuthenticatedSession("approvals-settings", "view")

    return db.query.approvalDefinitions.findMany({
        with: {
            steps: true,
        },
        orderBy: [desc(approvalDefinitions.updatedAt)],
    })
}

export async function getApprovalFormRegistry() {
    await getAuthenticatedSession("approvals-settings", "view")

    return db.query.approvalFormRegistry.findMany({
        orderBy: [asc(approvalFormRegistry.formName)],
    })
}

export async function getWebsiteFormOptions() {
    await getAuthenticatedSession("approvals-settings", "view")

    const dashboardDir = path.join(process.cwd(), "app", "dashboard")
    const routes = await collectDashboardRoutes(dashboardDir)

    const filteredRoutes = routes.filter((route) => {
        if (route.includes("[")) {
            return false
        }

        if (route === "/dashboard") {
            return false
        }

        if (route.startsWith("/dashboard/settings") || route.startsWith("/dashboard/security") || route.startsWith("/dashboard/reports")) {
            return false
        }

        return true
    })

    const uniqueByRoute = new Map<string, WebsiteFormOption>()
    for (const route of filteredRoutes) {
        uniqueByRoute.set(route, buildFormOptionFromRoute(route))
    }

    return Array.from(uniqueByRoute.values()).sort((a, b) => a.formName.localeCompare(b.formName))
}

export async function registerApprovalForm(formData: FormData) {
    const session = await getAuthenticatedSession("approvals-settings", "create")

    const discoveredFormRaw = String(formData.get("discoveredForm") ?? "").trim()
    const manualFormKey = String(formData.get("formKey") ?? "").trim()
    const manualFormName = String(formData.get("formName") ?? "").trim()
    const manualModulePath = String(formData.get("modulePath") ?? "").trim()
    const description = String(formData.get("description") ?? "").trim()

    let formKey = manualFormKey
    let formName = manualFormName
    let modulePath = manualModulePath

    if (discoveredFormRaw) {
        try {
            const parsed = JSON.parse(discoveredFormRaw) as Partial<WebsiteFormOption>
            formKey = String(parsed.formKey ?? "").trim()
            formName = String(parsed.formName ?? "").trim()
            modulePath = String(parsed.modulePath ?? "").trim()
        } catch {
            return { success: false, error: "Invalid selected form payload" }
        }
    }

    if (!formKey || !formName || !modulePath) {
        return { success: false, error: "Please select a form from website list" }
    }

    try {
        await db.insert(approvalFormRegistry).values({
            formKey,
            formName,
            modulePath,
            description: description || null,
            createdBy: session.user.id,
        }).onConflictDoNothing()

        safeRevalidatePath("/dashboard/settings/approvals")
        return { success: true }
    } catch (error) {
        console.error("Failed to register approval form:", error)
        return { success: false, error: "Failed to register form" }
    }
}

export async function createApprovalDefinition(formData: FormData) {
    const session = await getAuthenticatedSession("approvals-settings", "create")

    const name = String(formData.get("name") ?? "").trim()
    const formKey = String(formData.get("formKey") ?? "").trim()
    const description = String(formData.get("description") ?? "").trim()
    const statusInput = String(formData.get("status") ?? "draft").trim()
    const status = statusInput === "active" ? "active" : "draft"

    if (!name || !formKey) {
        return { success: false, error: "Definition name and form key are required" }
    }

    const latest = await db
        .select({ version: approvalDefinitions.version })
        .from(approvalDefinitions)
        .where(eq(approvalDefinitions.formKey, formKey))
        .orderBy(desc(approvalDefinitions.version))
        .limit(1)

    const nextVersion = (latest[0]?.version ?? 0) + 1

    try {
        const [created] = await db.insert(approvalDefinitions).values({
            name,
            formKey,
            description: description || null,
            version: nextVersion,
            status,
            createdBy: session.user.id,
            isDefault: status === "active",
        }).returning({ id: approvalDefinitions.id })

        safeRevalidatePath("/dashboard/settings/approvals")
        return { success: true, id: created.id }
    } catch (error) {
        console.error("Failed to create approval definition:", error)
        return { success: false, error: "Failed to create approval definition" }
    }
}

export async function createApprovalStep(formData: FormData) {
    await getAuthenticatedSession("approvals-settings", "create")

    const definitionId = String(formData.get("definitionId") ?? "").trim()
    const stepName = String(formData.get("stepName") ?? "").trim()
    const approverTypeRaw = String(formData.get("approverType") ?? "role").trim()
    const approverType = approverTypeRaw === "user" ? "user" : "role"
    const approverRole = String(formData.get("approverRole") ?? "").trim()
    const approverUserId = String(formData.get("approverUserId") ?? "").trim()
    const minApprovals = Math.max(1, Number(formData.get("minApprovals") ?? 1))

    if (!definitionId || !stepName) {
        return { success: false, error: "Definition and step name are required" }
    }

    if (approverType === "role" && !approverRole) {
        return { success: false, error: "Approver role is required for role-based step" }
    }

    if (approverType === "user" && !approverUserId) {
        return { success: false, error: "Approver user is required for user-based step" }
    }

    const latestOrder = await db
        .select({ stepOrder: approvalDefinitionSteps.stepOrder })
        .from(approvalDefinitionSteps)
        .where(eq(approvalDefinitionSteps.definitionId, definitionId))
        .orderBy(desc(approvalDefinitionSteps.stepOrder))
        .limit(1)

    try {
        await db.insert(approvalDefinitionSteps).values({
            definitionId,
            stepOrder: (latestOrder[0]?.stepOrder ?? 0) + 1,
            stepName,
            approverType,
            approverRole: approverType === "role" ? approverRole : null,
            approverUserId: approverType === "user" ? approverUserId : null,
            minApprovals,
        })

        safeRevalidatePath("/dashboard/settings/approvals")
        return { success: true }
    } catch (error) {
        console.error("Failed to create approval step:", error)
        return { success: false, error: "Failed to add approval step" }
    }
}

export async function createApprovalRequest(formData: FormData) {
    const session = await getAuthenticatedSession("approvals-settings", "create")

    const definitionId = String(formData.get("definitionId") ?? "").trim()
    const formKey = String(formData.get("formKey") ?? "").trim()
    const entityId = String(formData.get("entityId") ?? "").trim()

    if (!definitionId || !formKey || !entityId) {
        return { success: false, error: "Definition, form key, and entity ID are required" }
    }

    const firstStep = await db.query.approvalDefinitionSteps.findFirst({
        where: eq(approvalDefinitionSteps.definitionId, definitionId),
        orderBy: [asc(approvalDefinitionSteps.stepOrder)],
    })

    if (!firstStep) {
        return { success: false, error: "Definition has no steps" }
    }

    try {
        const [created] = await db.insert(approvalRequests).values({
            definitionId,
            formKey,
            entityId,
            requesterId: session.user.id,
            currentStepOrder: firstStep.stepOrder,
        }).returning({ id: approvalRequests.id })

        await createAssignmentsForStep(created.id, firstStep.id, firstStep.stepOrder)

        await db.insert(approvalAuditLogs).values({
            requestId: created.id,
            action: "comment",
            actorUserId: session.user.id,
            payload: {
                message: "Approval request submitted",
                stepOrder: firstStep.stepOrder,
            },
        })

        safeRevalidatePath("/dashboard/approvals")
        safeRevalidatePath("/dashboard/settings/approvals")
        return { success: true, id: created.id }
    } catch (error) {
        console.error("Failed to create approval request:", error)
        return { success: false, error: "Failed to create request" }
    }
}

async function createApprovalRequestCore(input: {
    definitionId: string
    formKey: string
    entityId: string
    requesterId: string
}) {
    const firstStep = await db.query.approvalDefinitionSteps.findFirst({
        where: eq(approvalDefinitionSteps.definitionId, input.definitionId),
        orderBy: [asc(approvalDefinitionSteps.stepOrder)],
    })

    if (!firstStep) {
        return { success: false as const, error: "Definition has no steps" }
    }

    const [created] = await db.insert(approvalRequests).values({
        definitionId: input.definitionId,
        formKey: input.formKey,
        entityId: input.entityId,
        requesterId: input.requesterId,
        currentStepOrder: firstStep.stepOrder,
    }).returning({ id: approvalRequests.id })

    await createAssignmentsForStep(created.id, firstStep.id, firstStep.stepOrder)

    await db.insert(approvalAuditLogs).values({
        requestId: created.id,
        action: "comment",
        actorUserId: input.requesterId,
        payload: {
            message: "Approval request submitted",
            stepOrder: firstStep.stepOrder,
        },
    })

    return { success: true as const, id: created.id }
}

export async function createApprovalRequestForEntity(input: {
    formKey: string
    entityId: string
    requesterId: string
}) {
    const activeDefinition = await db.query.approvalDefinitions.findFirst({
        where: and(
            eq(approvalDefinitions.formKey, input.formKey),
            eq(approvalDefinitions.status, "active")
        ),
        orderBy: [desc(approvalDefinitions.version)],
    })

    if (!activeDefinition) {
        return { success: true, skipped: true, reason: "No active definition" }
    }

    try {
        const result = await createApprovalRequestCore({
            definitionId: activeDefinition.id,
            formKey: input.formKey,
            entityId: input.entityId,
            requesterId: input.requesterId,
        })

        if (!result.success) {
            return { success: false, error: result.error }
        }

        safeRevalidatePath("/dashboard/approvals")
        return { success: true, id: result.id }
    } catch (error) {
        console.error("Failed to create approval request for entity:", error)
        return { success: false, error: "Failed to create approval request" }
    }
}

export async function submitApprovalDecision(formData: FormData) {
    const session = await getAuthenticatedSession("approvals-inbox", "edit")

    const assignmentId = String(formData.get("assignmentId") ?? "").trim()
    const decision = String(formData.get("decision") ?? "").trim() as DecisionType
    const comment = String(formData.get("comment") ?? "").trim()

    if (!assignmentId || (decision !== "approve" && decision !== "reject")) {
        return { success: false, error: "Invalid assignment or decision" }
    }

    if (decision === "approve" && !comment) {
        return { success: false, error: "Comment is required when approving" }
    }

    const assignment = await db.query.approvalAssignments.findFirst({
        where: eq(approvalAssignments.id, assignmentId),
    })

    if (!assignment) {
        return { success: false, error: "Assignment not found" }
    }

    if (assignment.assigneeUserId !== session.user.id) {
        return { success: false, error: "You are not assigned to this approval step" }
    }

    if (assignment.status !== "pending") {
        return { success: false, error: "Assignment already processed" }
    }

    try {
        await db.transaction(async (tx) => {
            await tx.update(approvalAssignments)
                .set({
                    status: decision === "approve" ? "approved" : "rejected",
                    actedAt: new Date(),
                    comment: comment || null,
                    updatedAt: new Date(),
                })
                .where(eq(approvalAssignments.id, assignmentId))

            const request = await tx.query.approvalRequests.findFirst({
                where: eq(approvalRequests.id, assignment.requestId),
            })

            if (!request) {
                throw new Error("Approval request not found")
            }

            if (decision === "reject") {
                await tx.update(approvalRequests)
                    .set({
                        status: "rejected",
                        completedAt: new Date(),
                        updatedAt: new Date(),
                    })
                    .where(eq(approvalRequests.id, request.id))

                await tx.update(approvalAssignments)
                    .set({ status: "skipped", updatedAt: new Date() })
                    .where(and(eq(approvalAssignments.requestId, request.id), eq(approvalAssignments.status, "pending")))

                await tx.insert(approvalAuditLogs).values({
                    requestId: request.id,
                    action: "reject",
                    actorUserId: session.user.id,
                    payload: {
                        assignmentId,
                        comment,
                        stepOrder: assignment.stepOrder,
                    },
                })

                const requester = await tx.query.user.findFirst({
                    where: eq(user.id, request.requesterId),
                })

                if (requester?.email) {
                    await sendNotificationEmail(
                        requester.email,
                        "Approval Request Rejected",
                        `Your approval request ${request.id} has been rejected at step ${assignment.stepOrder}.`,
                        `/dashboard/approvals/${request.id}`
                    )
                }

                return
            }

            await tx.insert(approvalAuditLogs).values({
                requestId: request.id,
                action: "approve",
                actorUserId: session.user.id,
                payload: {
                    assignmentId,
                    comment,
                    stepOrder: assignment.stepOrder,
                },
            })

            const currentStep = await tx.query.approvalDefinitionSteps.findFirst({
                where: eq(approvalDefinitionSteps.id, assignment.stepId),
            })

            if (!currentStep) {
                throw new Error("Approval step missing")
            }

            const currentAssignments = await tx
                .select({ status: approvalAssignments.status })
                .from(approvalAssignments)
                .where(and(eq(approvalAssignments.requestId, request.id), eq(approvalAssignments.stepId, assignment.stepId)))

            const approvedCount = currentAssignments.filter((entry) => entry.status === "approved").length
            const rejectedCount = currentAssignments.filter((entry) => entry.status === "rejected").length

            if (rejectedCount > 0) {
                await tx.update(approvalRequests)
                    .set({
                        status: "rejected",
                        completedAt: new Date(),
                        updatedAt: new Date(),
                    })
                    .where(eq(approvalRequests.id, request.id))

                await tx.update(approvalAssignments)
                    .set({ status: "skipped", updatedAt: new Date() })
                    .where(and(eq(approvalAssignments.requestId, request.id), eq(approvalAssignments.status, "pending")))

                return
            }

            if (approvedCount < currentStep.minApprovals) {
                return
            }

            const remainingPendingCurrentStep = currentAssignments.some((entry) => entry.status === "pending")
            if (remainingPendingCurrentStep) {
                await tx.update(approvalAssignments)
                    .set({ status: "skipped", updatedAt: new Date() })
                    .where(and(
                        eq(approvalAssignments.requestId, request.id),
                        eq(approvalAssignments.stepId, assignment.stepId),
                        eq(approvalAssignments.status, "pending")
                    ))
            }

            const nextStep = await tx.query.approvalDefinitionSteps.findFirst({
                where: and(
                    eq(approvalDefinitionSteps.definitionId, request.definitionId),
                    eq(approvalDefinitionSteps.stepOrder, assignment.stepOrder + 1)
                ),
            })

            if (!nextStep) {
                await tx.update(approvalRequests)
                    .set({
                        status: "approved",
                        completedAt: new Date(),
                        updatedAt: new Date(),
                    })
                    .where(eq(approvalRequests.id, request.id))

                const requester = await tx.query.user.findFirst({
                    where: eq(user.id, request.requesterId),
                })

                if (requester?.email) {
                    await sendNotificationEmail(
                        requester.email,
                        "Approval Request Approved",
                        `Your approval request ${request.id} has been fully approved.`,
                        `/dashboard/approvals/${request.id}`
                    )
                }

                return
            }

            await tx.update(approvalRequests)
                .set({
                    currentStepOrder: nextStep.stepOrder,
                    updatedAt: new Date(),
                })
                .where(eq(approvalRequests.id, request.id))

            const stepAssignees = await (async () => {
                if (nextStep.approverType === "user") {
                    return nextStep.approverUserId ? [nextStep.approverUserId] : []
                }

                if (!nextStep.approverRole) {
                    return []
                }

                const roleUsers = await tx
                    .select({ id: user.id })
                    .from(user)
                    .where(ilike(user.role, nextStep.approverRole))

                return roleUsers.map((entry) => entry.id)
            })()

            if (stepAssignees.length === 0) {
                throw new Error("Next step has no assignees")
            }

            await tx.insert(approvalAssignments).values(
                stepAssignees.map((assigneeId) => ({
                    requestId: request.id,
                    stepId: nextStep.id,
                    stepOrder: nextStep.stepOrder,
                    assigneeUserId: assigneeId,
                }))
            )

            await tx.insert(approvalAuditLogs).values({
                requestId: request.id,
                action: "comment",
                actorUserId: session.user.id,
                payload: {
                    message: "Moved to next step",
                    from: assignment.stepOrder,
                    to: nextStep.stepOrder,
                },
            })
        })

        safeRevalidatePath("/dashboard/approvals")
        return { success: true }
    } catch (error) {
        console.error("Failed to submit approval decision:", error)
        return { success: false, error: "Failed to submit decision" }
    }
}

export async function getApprovalRequestsByDefinition(definitionId: string) {
    await getAuthenticatedSession("approvals-settings", "view")

    const requests = await db.query.approvalRequests.findMany({
        where: eq(approvalRequests.definitionId, definitionId),
        orderBy: [desc(approvalRequests.createdAt)],
        limit: 20,
    })

    if (requests.length === 0) {
        return []
    }

    const requesterIds = [...new Set(requests.map((request) => request.requesterId))]
    const requesters = await db
        .select({ id: user.id, name: user.name, email: user.email })
        .from(user)
        .where(inArray(user.id, requesterIds))

    const requesterMap = new Map(requesters.map((entry) => [entry.id, entry]))

    return requests.map((request) => ({
        ...request,
        requester: requesterMap.get(request.requesterId) ?? null,
    }))
}

export async function getApprovalRequestDetail(requestId: string) {
    const session = await getAuthenticatedSession()

    const request = await db.query.approvalRequests.findFirst({
        where: eq(approvalRequests.id, requestId),
        with: {
            definition: {
                with: {
                    form: true,
                },
            },
            requester: true,
            assignments: {
                with: {
                    assignee: true,
                    step: true,
                },
                orderBy: [asc(approvalAssignments.stepOrder), asc(approvalAssignments.createdAt)],
            },
            auditLogs: {
                with: {
                    actor: true,
                },
                orderBy: [asc(approvalAuditLogs.createdAt)],
            },
        },
    })

    if (!request) {
        return null
    }

    const isRequester = request.requesterId === session.user.id
    const isAssignee = request.assignments.some((assignment) => assignment.assigneeUserId === session.user.id)

    if (isRequester || isAssignee) {
        return request
    }

    try {
        await checkPermission("approvals-inbox", "view")
        return request
    } catch {
        return null
    }
}

export async function getApprovalMatrixImports() {
    await getAuthenticatedSession("approvals-matrix", "view")

    return db.query.approvalMatrixImports.findMany({
        orderBy: [desc(approvalMatrixImports.createdAt)],
        limit: 20,
    })
}

export async function getApprovalOrgStructures() {
    await getAuthenticatedSession("approvals-matrix", "view")

    const structures = await db.query.approvalOrgStructures.findMany({
        where: eq(approvalOrgStructures.isActive, true),
        with: {
            nodes: {
                with: {
                    user: true,
                },
                orderBy: [asc(approvalOrgStructureNodes.sortOrder), asc(approvalOrgStructureNodes.createdAt)],
            },
        },
        orderBy: [asc(approvalOrgStructures.type), asc(approvalOrgStructures.name)],
    })

    return structures.map((structure) => ({
        ...structure,
        validation: validateOrgStructureNodes(structure.nodes),
    }))
}

type OrgValidationSummary = {
    isValid: boolean
    issues: string[]
    nodeCount: number
    rootCount: number
}

type OrgNodeShape = {
    id: string
    parentNodeId: string | null
    userId?: string | null
}

function validateOrgStructureNodes(nodes: OrgNodeShape[]): OrgValidationSummary {
    const issues: string[] = []
    const nodeMap = new Map(nodes.map((node) => [node.id, node]))
    const childMap = new Map<string | null, OrgNodeShape[]>()

    for (const node of nodes) {
        const key = node.parentNodeId ?? null
        const bucket = childMap.get(key) ?? []
        bucket.push(node)
        childMap.set(key, bucket)

        if (node.parentNodeId && !nodeMap.has(node.parentNodeId)) {
            issues.push(`Node ${node.id} references unknown parent ${node.parentNodeId}`)
        }

        if (node.parentNodeId === node.id) {
            issues.push(`Node ${node.id} cannot reference itself as parent`)
        }
    }

    const roots = nodes.filter((node) => !node.parentNodeId)
    if (nodes.length > 0 && roots.length === 0) {
        issues.push("Structure has no root node")
    }
    if (roots.length > 1) {
        issues.push(`Structure has multiple root nodes (${roots.length})`)
    }

    const state = new Map<string, 0 | 1 | 2>()
    const walk = (nodeId: string) => {
        const current = state.get(nodeId) ?? 0
        if (current === 1) {
            issues.push(`Cycle detected at node ${nodeId}`)
            return
        }
        if (current === 2) {
            return
        }

        state.set(nodeId, 1)
        const children = childMap.get(nodeId) ?? []
        for (const child of children) {
            walk(child.id)
        }
        state.set(nodeId, 2)
    }

    for (const root of roots) {
        walk(root.id)
    }

    for (const node of nodes) {
        if ((state.get(node.id) ?? 0) === 0) {
            walk(node.id)
        }
    }

    const userCounts = new Map<string, number>()
    for (const node of nodes) {
        if (!node.userId) {
            continue
        }
        userCounts.set(node.userId, (userCounts.get(node.userId) ?? 0) + 1)
    }

    for (const [userId, count] of userCounts.entries()) {
        if (count > 1) {
            issues.push(`User ${userId} appears ${count} times in the same structure`)
        }
    }

    return {
        isValid: issues.length === 0,
        issues,
        nodeCount: nodes.length,
        rootCount: roots.length,
    }
}

type MatrixBuilderNodeInput = {
    tempId: string
    parentRef?: string | null
    userId?: string | null
    nodeName?: string | null
    department?: string | null
    jobTitle?: string | null
    sortOrder?: number | null
}

export async function saveApprovalMatrixBuilder(formData: FormData) {
    await getAuthenticatedSession("approvals-matrix", "create")

    const structureId = String(formData.get("structureId") ?? "").trim()
    const nodesJson = String(formData.get("nodes") ?? "").trim()

    if (!structureId) {
        return { success: false, error: "Structure is required" }
    }

    if (!nodesJson) {
        return { success: false, error: "No matrix nodes provided" }
    }

    const structure = await db.query.approvalOrgStructures.findFirst({
        where: and(eq(approvalOrgStructures.id, structureId), eq(approvalOrgStructures.isActive, true)),
    })

    if (!structure) {
        return { success: false, error: "Structure not found" }
    }

    let nodesInput: MatrixBuilderNodeInput[]
    try {
        const parsed = JSON.parse(nodesJson) as unknown
        if (!Array.isArray(parsed)) {
            return { success: false, error: "Invalid matrix payload" }
        }
        nodesInput = parsed as MatrixBuilderNodeInput[]
    } catch {
        return { success: false, error: "Invalid matrix payload" }
    }

    if (nodesInput.length === 0) {
        return { success: false, error: "Please add at least one node" }
    }

    const existingNodes = await db
        .select({ id: approvalOrgStructureNodes.id, parentNodeId: approvalOrgStructureNodes.parentNodeId, userId: approvalOrgStructureNodes.userId })
        .from(approvalOrgStructureNodes)
        .where(eq(approvalOrgStructureNodes.structureId, structureId))

    const existingIds = new Set(existingNodes.map((node) => node.id))
    const tempIds = new Set(nodesInput.map((node) => node.tempId).filter(Boolean))

    const normalizedNodes = nodesInput.map((node) => ({
        tempId: String(node.tempId ?? "").trim(),
        parentRef: String(node.parentRef ?? "").trim() || null,
        userId: String(node.userId ?? "").trim() || null,
        nodeName: String(node.nodeName ?? "").trim(),
        department: String(node.department ?? "").trim() || null,
        jobTitle: String(node.jobTitle ?? "").trim() || null,
        sortOrder: Number.isFinite(Number(node.sortOrder ?? 0)) ? Number(node.sortOrder ?? 0) : 0,
    }))

    for (const node of normalizedNodes) {
        if (!node.tempId) {
            return { success: false, error: "Every node must have temp id" }
        }
        if (node.parentRef && !existingIds.has(node.parentRef) && !tempIds.has(node.parentRef)) {
            return { success: false, error: `Parent reference ${node.parentRef} is not found` }
        }
        if (node.parentRef && node.parentRef === node.tempId) {
            return { success: false, error: "A node cannot be parent of itself" }
        }
    }

    const simulated = [
        ...existingNodes.map((node) => ({ id: node.id, parentNodeId: node.parentNodeId, userId: node.userId })),
        ...normalizedNodes.map((node) => ({ id: node.tempId, parentNodeId: node.parentRef, userId: node.userId })),
    ]
    const validation = validateOrgStructureNodes(simulated)
    if (!validation.isValid) {
        return { success: false, error: validation.issues[0] ?? "Matrix structure is invalid", issues: validation.issues }
    }

    try {
        await db.transaction(async (tx) => {
            const unresolved = [...normalizedNodes]
            const resolvedIds = new Map<string, string>()

            while (unresolved.length > 0) {
                let progressed = false

                for (let index = unresolved.length - 1; index >= 0; index -= 1) {
                    const node = unresolved[index]
                    const parentResolved = !node.parentRef || existingIds.has(node.parentRef) || resolvedIds.has(node.parentRef)

                    if (!parentResolved) {
                        continue
                    }

                    const selectedUser = node.userId
                        ? await tx.query.user.findFirst({ where: eq(user.id, node.userId) })
                        : null

                    const nodeName = node.nodeName || selectedUser?.name || ""
                    const department = node.department || selectedUser?.department || null
                    const jobTitle = node.jobTitle || selectedUser?.jobTitle || null

                    if (!nodeName) {
                        throw new Error("Node name is required")
                    }

                    const parentNodeId = node.parentRef
                        ? (resolvedIds.get(node.parentRef) ?? (existingIds.has(node.parentRef) ? node.parentRef : null))
                        : null

                    const [inserted] = await tx.insert(approvalOrgStructureNodes).values({
                        structureId,
                        parentNodeId,
                        userId: node.userId,
                        nodeName,
                        department,
                        jobTitle,
                        sortOrder: node.sortOrder,
                    }).returning({ id: approvalOrgStructureNodes.id })

                    resolvedIds.set(node.tempId, inserted.id)
                    unresolved.splice(index, 1)
                    progressed = true
                }

                if (!progressed) {
                    throw new Error("Cannot resolve node parents. Please check for circular parent references.")
                }
            }
        })

        safeRevalidatePath("/dashboard/approvals/matrix")
        return { success: true }
    } catch (error) {
        console.error("Failed to save matrix builder nodes:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to save matrix" }
    }
}

export async function seedApprovalOrgSampleData() {
    const session = await getAuthenticatedSession("approvals-matrix", "create")

    const [existing] = await db
        .select({ count: count() })
        .from(approvalOrgStructures)
        .where(eq(approvalOrgStructures.isActive, true))

    if ((existing?.count ?? 0) > 0) {
        return { success: true, skipped: true, message: "Sample data skipped because structures already exist" }
    }

    const users = await db
        .select({
            id: user.id,
            name: user.name,
            department: user.department,
            jobTitle: user.jobTitle,
        })
        .from(user)
        .orderBy(asc(user.name))

    if (users.length === 0) {
        return { success: false, error: "No users available for sample data" }
    }

    const pick = (index: number) => users[Math.min(index, users.length - 1)]

    try {
        await db.transaction(async (tx) => {
            const structuresToCreate = [
                { name: "Struktur Organisasi Besar", type: "enterprise" as const },
                { name: "Struktur Organisasi Pekerjaan", type: "work" as const },
                { name: "Struktur Organisasi Project", type: "project" as const },
            ]

            for (const [index, structureInfo] of structuresToCreate.entries()) {
                const [structure] = await tx.insert(approvalOrgStructures).values({
                    name: structureInfo.name,
                    type: structureInfo.type,
                    description: `Sample ${structureInfo.name}`,
                    createdBy: session.user.id,
                }).returning({ id: approvalOrgStructures.id })

                const rootUser = pick(index)
                const [root] = await tx.insert(approvalOrgStructureNodes).values({
                    structureId: structure.id,
                    userId: rootUser.id,
                    nodeName: rootUser.name,
                    department: rootUser.department,
                    jobTitle: rootUser.jobTitle,
                    sortOrder: 1,
                }).returning({ id: approvalOrgStructureNodes.id })

                const childUserA = pick(index + 1)
                const childUserB = pick(index + 2)

                await tx.insert(approvalOrgStructureNodes).values([
                    {
                        structureId: structure.id,
                        parentNodeId: root.id,
                        userId: childUserA.id,
                        nodeName: childUserA.name,
                        department: childUserA.department,
                        jobTitle: childUserA.jobTitle,
                        sortOrder: 2,
                    },
                    {
                        structureId: structure.id,
                        parentNodeId: root.id,
                        userId: childUserB.id,
                        nodeName: childUserB.name,
                        department: childUserB.department,
                        jobTitle: childUserB.jobTitle,
                        sortOrder: 3,
                    },
                ])
            }
        })

        safeRevalidatePath("/dashboard/approvals/matrix")
        return { success: true }
    } catch (error) {
        console.error("Failed to seed approval org structures:", error)
        return { success: false, error: "Failed to seed sample structures" }
    }
}

export async function getApprovalOrgUsers() {
    await getAuthenticatedSession("approvals-matrix", "view")

    return db
        .select({
            id: user.id,
            name: user.name,
            email: user.email,
            department: user.department,
            jobTitle: user.jobTitle,
        })
        .from(user)
        .orderBy(asc(user.name))
}

export async function createApprovalOrgStructure(formData: FormData) {
    const session = await getAuthenticatedSession("approvals-matrix", "create")

    const name = String(formData.get("name") ?? "").trim()
    const typeRaw = String(formData.get("type") ?? "enterprise").trim()
    const description = String(formData.get("description") ?? "").trim()
    const type = typeRaw === "work" || typeRaw === "project" ? typeRaw : "enterprise"

    if (!name) {
        return { success: false, error: "Structure name is required" }
    }

    try {
        await db.insert(approvalOrgStructures).values({
            name,
            type,
            description: description || null,
            createdBy: session.user.id,
        })

        safeRevalidatePath("/dashboard/approvals/matrix")
        return { success: true }
    } catch (error) {
        console.error("Failed to create approval org structure:", error)
        return { success: false, error: "Failed to create structure" }
    }
}

export async function updateApprovalOrgStructure(formData: FormData) {
    await getAuthenticatedSession("approvals-matrix", "edit")

    const structureId = String(formData.get("structureId") ?? "").trim()
    const name = String(formData.get("name") ?? "").trim()
    const typeRaw = String(formData.get("type") ?? "enterprise").trim()
    const description = String(formData.get("description") ?? "").trim()
    const type = typeRaw === "work" || typeRaw === "project" ? typeRaw : "enterprise"

    if (!structureId || !name) {
        return { success: false, error: "Structure id and name are required" }
    }

    try {
        await db.update(approvalOrgStructures)
            .set({
                name,
                type,
                description: description || null,
                updatedAt: new Date(),
            })
            .where(eq(approvalOrgStructures.id, structureId))

        safeRevalidatePath("/dashboard/approvals/matrix")
        return { success: true }
    } catch (error) {
        console.error("Failed to update approval org structure:", error)
        return { success: false, error: "Failed to update structure" }
    }
}

export async function deleteApprovalOrgStructure(formData: FormData) {
    await getAuthenticatedSession("approvals-matrix", "delete")

    const structureId = String(formData.get("structureId") ?? "").trim()

    if (!structureId) {
        return { success: false, error: "Structure is required" }
    }

    try {
        await db.update(approvalOrgStructures)
            .set({
                isActive: false,
                updatedAt: new Date(),
            })
            .where(eq(approvalOrgStructures.id, structureId))

        safeRevalidatePath("/dashboard/approvals/matrix")
        return { success: true }
    } catch (error) {
        console.error("Failed to delete approval org structure:", error)
        return { success: false, error: "Failed to delete structure" }
    }
}

export async function createApprovalOrgNode(formData: FormData) {
    await getAuthenticatedSession("approvals-matrix", "create")

    const structureId = String(formData.get("structureId") ?? "").trim()
    const parentNodeIdRaw = String(formData.get("parentNodeId") ?? "").trim()
    const userIdRaw = String(formData.get("userId") ?? "").trim()
    const nodeNameRaw = String(formData.get("nodeLabel") ?? formData.get("nodeName") ?? "").trim()
    const departmentRaw = String(formData.get("department") ?? "").trim()
    const jobTitleRaw = String(formData.get("jobTitle") ?? "").trim()
    const sortOrder = Number(formData.get("sortOrder") ?? 0)

    if (!structureId) {
        return { success: false, error: "Structure is required" }
    }

    const selectedUser = userIdRaw
        ? await db.query.user.findFirst({ where: eq(user.id, userIdRaw) })
        : null

    const nodeName = nodeNameRaw || selectedUser?.name || ""
    const department = departmentRaw || selectedUser?.department || null
    const jobTitle = jobTitleRaw || selectedUser?.jobTitle || null

    if (!nodeName) {
        return { success: false, error: "Node name is required" }
    }

    try {
        await db.insert(approvalOrgStructureNodes).values({
            structureId,
            parentNodeId: parentNodeIdRaw || null,
            userId: userIdRaw || null,
            nodeName,
            department,
            jobTitle,
            sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
        })

        safeRevalidatePath("/dashboard/approvals/matrix")
        return { success: true }
    } catch (error) {
        console.error("Failed to create approval org node:", error)
        return { success: false, error: "Failed to create structure node" }
    }
}

export async function updateApprovalOrgNode(formData: FormData) {
    await getAuthenticatedSession("approvals-matrix", "edit")

    const structureId = String(formData.get("structureId") ?? "").trim()
    const nodeId = String(formData.get("nodeId") ?? "").trim()
    const parentNodeIdRaw = String(formData.get("parentNodeId") ?? "").trim()
    const userIdRaw = String(formData.get("userId") ?? "").trim()
    const nodeNameRaw = String(formData.get("nodeLabel") ?? formData.get("nodeName") ?? "").trim()
    const departmentRaw = String(formData.get("department") ?? "").trim()
    const jobTitleRaw = String(formData.get("jobTitle") ?? "").trim()
    const sortOrder = Number(formData.get("sortOrder") ?? 0)

    if (!structureId || !nodeId) {
        return { success: false, error: "Structure and node are required" }
    }

    if (parentNodeIdRaw && parentNodeIdRaw === nodeId) {
        return { success: false, error: "Node cannot reference itself as parent" }
    }

    const selectedUser = userIdRaw
        ? await db.query.user.findFirst({ where: eq(user.id, userIdRaw) })
        : null

    const nodeName = nodeNameRaw || selectedUser?.name || ""
    const department = departmentRaw || selectedUser?.department || null
    const jobTitle = jobTitleRaw || selectedUser?.jobTitle || null

    if (!nodeName) {
        return { success: false, error: "Node name is required" }
    }

    try {
        const nodes = await db
            .select({ id: approvalOrgStructureNodes.id, parentNodeId: approvalOrgStructureNodes.parentNodeId, userId: approvalOrgStructureNodes.userId })
            .from(approvalOrgStructureNodes)
            .where(eq(approvalOrgStructureNodes.structureId, structureId))

        const simulated = nodes.map((node) => {
            if (node.id !== nodeId) {
                return node
            }
            return {
                ...node,
                parentNodeId: parentNodeIdRaw || null,
                userId: userIdRaw || null,
            }
        })

        const validation = validateOrgStructureNodes(simulated)
        if (!validation.isValid) {
            return { success: false, error: validation.issues[0] ?? "Invalid structure update" }
        }

        await db.update(approvalOrgStructureNodes)
            .set({
                parentNodeId: parentNodeIdRaw || null,
                userId: userIdRaw || null,
                nodeName,
                department,
                jobTitle,
                sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
                updatedAt: new Date(),
            })
            .where(and(eq(approvalOrgStructureNodes.id, nodeId), eq(approvalOrgStructureNodes.structureId, structureId)))

        safeRevalidatePath("/dashboard/approvals/matrix")
        return { success: true }
    } catch (error) {
        console.error("Failed to update approval org node:", error)
        return { success: false, error: "Failed to update node" }
    }
}

export async function deleteApprovalOrgNode(formData: FormData) {
    await getAuthenticatedSession("approvals-matrix", "delete")

    const structureId = String(formData.get("structureId") ?? "").trim()
    const nodeId = String(formData.get("nodeId") ?? "").trim()

    if (!structureId || !nodeId) {
        return { success: false, error: "Structure and node are required" }
    }

    try {
        const nodes = await db
            .select({ id: approvalOrgStructureNodes.id, parentNodeId: approvalOrgStructureNodes.parentNodeId })
            .from(approvalOrgStructureNodes)
            .where(eq(approvalOrgStructureNodes.structureId, structureId))

        const descendantIds = new Set<string>()
        const queue: string[] = [nodeId]
        while (queue.length > 0) {
            const currentId = queue.shift()!
            if (descendantIds.has(currentId)) {
                continue
            }
            descendantIds.add(currentId)

            for (const node of nodes) {
                if (node.parentNodeId === currentId) {
                    queue.push(node.id)
                }
            }
        }

        await db.delete(approvalOrgStructureNodes)
            .where(and(eq(approvalOrgStructureNodes.structureId, structureId), inArray(approvalOrgStructureNodes.id, Array.from(descendantIds))))

        safeRevalidatePath("/dashboard/approvals/matrix")
        return { success: true }
    } catch (error) {
        console.error("Failed to delete approval org node:", error)
        return { success: false, error: "Failed to delete node" }
    }
}

function normalizeMatrixRow(row: Record<string, unknown>): MatrixRow | null {
    const formKey = String(row.formKey ?? row.form_key ?? "").trim()
    const workflowName = String(row.workflowName ?? row.workflow_name ?? "").trim()
    const stepName = String(row.stepName ?? row.step_name ?? "").trim()

    if (!formKey || !workflowName || !stepName) {
        return null
    }

    const approverTypeRaw = String(row.approverType ?? row.approver_type ?? "role").trim().toLowerCase()
    const approverType: "role" | "user" = approverTypeRaw === "user" ? "user" : "role"
    const statusRaw = String(row.status ?? "draft").trim().toLowerCase()
    const status: "draft" | "active" = statusRaw === "active" ? "active" : "draft"
    const stepOrder = Number(row.stepOrder ?? row.step_order ?? 0)
    const minApprovals = Math.max(1, Number(row.minApprovals ?? row.min_approvals ?? 1))

    return {
        formKey,
        formName: String(row.formName ?? row.form_name ?? "").trim() || undefined,
        modulePath: String(row.modulePath ?? row.module_path ?? "").trim() || undefined,
        workflowName,
        description: String(row.description ?? "").trim() || undefined,
        status,
        stepOrder: Number.isFinite(stepOrder) && stepOrder > 0 ? stepOrder : undefined,
        stepName,
        approverType,
        approverRole: String(row.approverRole ?? row.approver_role ?? "").trim() || undefined,
        approverUserId: String(row.approverUserId ?? row.approver_user_id ?? "").trim() || undefined,
        minApprovals,
    }
}

async function parseMatrixFile(file: File) {
    const extension = file.name.split(".").pop()?.toLowerCase()

    if (extension === "csv") {
        const csvText = await file.text()
        const parsed = Papa.parse<Record<string, unknown>>(csvText, {
            header: true,
            skipEmptyLines: true,
        })

        if (parsed.errors.length > 0) {
            throw new Error(parsed.errors[0]?.message ?? "Invalid CSV format")
        }

        return parsed.data
    }

    if (extension === "xlsx" || extension === "xls") {
        const arrayBuffer = await file.arrayBuffer()
        const workbook = XLSX.read(Buffer.from(arrayBuffer), { type: "buffer" })
        const firstSheetName = workbook.SheetNames[0]

        if (!firstSheetName) {
            return []
        }

        const worksheet = workbook.Sheets[firstSheetName]
        return XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" })
    }

    throw new Error("Unsupported file type. Please upload CSV or XLSX")
}

export async function importApprovalMatrix(formData: FormData) {
    const session = await getAuthenticatedSession("approvals-matrix", "create")
    const file = formData.get("matrixFile")

    if (!(file instanceof File) || file.size === 0) {
        return { success: false, error: "Matrix file is required" }
    }

    const extension = file.name.split(".").pop()?.toLowerCase() ?? "unknown"

    try {
        const rawRows = await parseMatrixFile(file)
        const rows = rawRows
            .map((row) => normalizeMatrixRow(row))
            .filter((row): row is MatrixRow => Boolean(row))

        if (rows.length === 0) {
            return { success: false, error: "No valid rows found in matrix file" }
        }

        let createdDefinitions = 0
        let createdSteps = 0
        const grouped = new Map<string, MatrixRow[]>()

        for (const row of rows) {
            const key = `${row.formKey}::${row.workflowName}::${row.status ?? "draft"}`
            const bucket = grouped.get(key) ?? []
            bucket.push(row)
            grouped.set(key, bucket)
        }

        await db.transaction(async (tx) => {
            for (const [, groupRows] of grouped) {
                const first = groupRows[0]

                if (first.formName && first.modulePath) {
                    await tx.insert(approvalFormRegistry).values({
                        formKey: first.formKey,
                        formName: first.formName,
                        modulePath: first.modulePath,
                        createdBy: session.user.id,
                    }).onConflictDoNothing()
                }

                const latest = await tx
                    .select({ version: approvalDefinitions.version })
                    .from(approvalDefinitions)
                    .where(eq(approvalDefinitions.formKey, first.formKey))
                    .orderBy(desc(approvalDefinitions.version))
                    .limit(1)

                const [definition] = await tx.insert(approvalDefinitions).values({
                    name: first.workflowName,
                    formKey: first.formKey,
                    description: first.description ?? null,
                    status: first.status ?? "draft",
                    version: (latest[0]?.version ?? 0) + 1,
                    isDefault: (first.status ?? "draft") === "active",
                    createdBy: session.user.id,
                }).returning({ id: approvalDefinitions.id })

                createdDefinitions += 1

                const orderedRows = [...groupRows].sort((a, b) => (a.stepOrder ?? 9999) - (b.stepOrder ?? 9999))
                let currentOrder = 1

                for (const row of orderedRows) {
                    const approverType = row.approverType ?? "role"
                    if (approverType === "role" && !row.approverRole) {
                        continue
                    }

                    if (approverType === "user" && !row.approverUserId) {
                        continue
                    }

                    await tx.insert(approvalDefinitionSteps).values({
                        definitionId: definition.id,
                        stepOrder: row.stepOrder ?? currentOrder,
                        stepName: row.stepName,
                        approverType,
                        approverRole: approverType === "role" ? row.approverRole ?? null : null,
                        approverUserId: approverType === "user" ? row.approverUserId ?? null : null,
                        minApprovals: row.minApprovals ?? 1,
                    })

                    createdSteps += 1
                    currentOrder += 1
                }
            }
        })

        await db.insert(approvalMatrixImports).values({
            fileName: file.name,
            fileType: extension,
            importedBy: session.user.id,
            status: "success",
            summary: {
                parsedRows: rawRows.length,
                validRows: rows.length,
                createdDefinitions,
                createdSteps,
            },
        })

        safeRevalidatePath("/dashboard/settings/approvals")
        return { success: true }
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error"

        await db.insert(approvalMatrixImports).values({
            fileName: file.name,
            fileType: extension,
            importedBy: session.user.id,
            status: "failed",
            summary: {
                error: message,
            },
        })

        return { success: false, error: `Import failed: ${message}` }
    }
}
