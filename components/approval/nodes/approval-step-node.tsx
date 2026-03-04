"use client"

import { Handle, Position } from "@xyflow/react"
import { Bell, Mail, User, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export type ApprovalStepNodeData = {
    stepName: string
    approverType: "role" | "user"
    approverRole: string | null
    approverUserId: string | null
    approverUserName: string | null
    approvalPolicy?: "any" | "all" | "quorum"
    instructions?: string
    workflowNotePolicy?: "optional" | "required_on_approve" | "required_on_reject" | "required_always"
    minApprovals: number
    notifyOnAssign: boolean
    notifyOnComplete: boolean
    ccEmails: string | null
    slaDays: number | null
}

type ApprovalStepNodeProps = {
    data: ApprovalStepNodeData
    selected?: boolean
}

export function ApprovalStepNode({ data, selected }: ApprovalStepNodeProps) {
    const hasNotification = data?.notifyOnAssign || data?.notifyOnComplete

    return (
        <div
            style={{ minWidth: 200 }}
            className={`rounded-xl border-2 bg-card shadow-md transition-all ${selected
                ? "border-primary shadow-primary/20 shadow-lg"
                : "border-border hover:border-primary/50 hover:shadow-lg"
                }`}
        >
            {/* Header */}
            <div className="rounded-t-lg bg-primary/10 px-3 py-2 border-b border-border">
                <p className="text-xs font-semibold text-primary truncate max-w-[180px]">
                    {data?.stepName || "Untitled Step"}
                </p>
            </div>

            {/* Body */}
            <div className="p-3 space-y-2">
                {/* Approver */}
                <div className="flex items-center gap-1.5">
                    {data?.approverType === "user" ? (
                        <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    ) : (
                        <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                    <p className="text-xs text-muted-foreground truncate max-w-[160px]">
                        {data?.approverType === "user"
                            ? (data?.approverUserName || data?.approverUserId || "No user selected")
                            : (data?.approverRole || "No role set")}
                    </p>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-1">
                    {data?.approvalPolicy && data.approvalPolicy !== "quorum" && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 uppercase">
                            {data.approvalPolicy}
                        </Badge>
                    )}
                    {(data?.minApprovals ?? 1) > 1 && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            Min {data?.minApprovals}
                        </Badge>
                    )}
                    {data?.slaDays && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {data?.slaDays}d SLA
                        </Badge>
                    )}
                    {hasNotification && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5">
                            <Bell className="h-2.5 w-2.5" />
                            Notif
                        </Badge>
                    )}
                    {data?.ccEmails && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5">
                            <Mail className="h-2.5 w-2.5" />
                            CC
                        </Badge>
                    )}
                </div>
            </div>

            {/* Handles — di luar container agar tidak terpotong overflow */}
            <Handle
                id="in"
                type="target"
                position={Position.Left}
                isConnectable
                style={{ width: 14, height: 14, pointerEvents: "all", zIndex: 50 }}
                className="nodrag !border-2 !border-primary !bg-background !pointer-events-auto"
            />
            <Handle
                id="out"
                type="source"
                position={Position.Right}
                isConnectable
                style={{ width: 14, height: 14, pointerEvents: "all", zIndex: 50 }}
                className="nodrag !border-2 !border-primary !bg-background !pointer-events-auto"
            />
        </div>
    )
}
