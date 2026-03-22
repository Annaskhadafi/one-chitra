import { redirect } from "next/navigation"
import { db } from "@/db"
import { approvalDefinitions, approvalDefinitionSteps, user } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getAuthenticatedSession } from "@/lib/rbac"
import { WorkflowCanvas } from "@/components/approval/workflow-canvas"

type Props = {
    params: Promise<{ id: string }>
}

export default async function WorkflowCanvasPage({ params }: Props) {
    try {
        await getAuthenticatedSession()
    } catch {
        redirect("/login")
    }

    const { id } = await params

    const [definition] = await db
        .select()
        .from(approvalDefinitions)
        .where(eq(approvalDefinitions.id, id))
        .limit(1)

    if (!definition) {
        redirect("/dashboard/settings/approvals")
    }

    const steps = await db
        .select()
        .from(approvalDefinitionSteps)
        .where(eq(approvalDefinitionSteps.definitionId, id))
        .orderBy(approvalDefinitionSteps.stepOrder)

    const users = await db
        .select({ id: user.id, name: user.name, email: user.email, role: user.role })
        .from(user)

    return (
        <div className="fixed inset-0 bg-background z-50">
            <WorkflowCanvas
                definitionId={definition.id}
                definitionName={definition.name}
                definitionFormKey={definition.formKey}
                initialSteps={steps.map((s) => ({
                    id: s.id,
                    stepOrder: s.stepOrder,
                    stepName: s.stepName,
                    approverType: s.approverType,
                    approverRole: s.approverRole,
                    approverUserId: s.approverUserId,
                    minApprovals: s.minApprovals,
                    notifyOnAssign: s.notifyOnAssign,
                    notifyOnComplete: s.notifyOnComplete,
                    ccEmails: s.ccEmails,
                    slaDays: s.slaDays,
                    nodePositionX: s.nodePositionX,
                    nodePositionY: s.nodePositionY,
                    conditionJson: s.conditionJson,
                }))}
                users={users}
                onClose={undefined}
            />
        </div>
    )
}
