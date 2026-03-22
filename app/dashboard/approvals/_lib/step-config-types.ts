// Step configuration types for the Approval Workflow Enhancement feature

export type BaseStepConfig = {
  nodeKind: string
  instructions?: string
}

export type ApprovalStepConfig = BaseStepConfig & {
  nodeKind: "approvalStep"
  approverType?: "role" | "user"
  approverRole?: string
  approverUserId?: string
  minApprovals?: number
  workflowNotePolicy?: "optional" | "required_on_approve" | "required_on_reject" | "required_always"
}

export type NotificationStepConfig = BaseStepConfig & {
  nodeKind: "notifyNode"
  recipients: string[]
  messageTemplate: string
}

export type UpdateUserStepConfig = BaseStepConfig & {
  nodeKind: "updateUserNode"
  targetField: string
  newValue: string
}

export type UserInputStepConfig = BaseStepConfig & {
  nodeKind: "userInputNode"
  inputFields: {
    key: string
    label: string
    type: "text" | "number" | "date" | "select"
    required: boolean
    options?: string[]
  }[]
}
