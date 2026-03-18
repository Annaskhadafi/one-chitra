"use client"

import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Plus } from "lucide-react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { reorderWorkflowSteps } from "@/app/actions/approval"
import type { UIStepType, WorkflowStep } from "@/app/dashboard/approvals/_lib/types"
import { StepConfigForm } from "./step-config-form"
import { StepTypeSelector } from "./step-type-selector"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// ─── Step type badge config ───────────────────────────────────────────────────

const stepTypeMeta: Record<UIStepType, { label: string; className: string }> = {
  approval: {
    label: "Approval",
    className: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  },
  notification: {
    label: "Notification",
    className: "bg-purple-100 text-purple-800 hover:bg-purple-100",
  },
  update_user: {
    label: "Update User",
    className: "bg-orange-100 text-orange-800 hover:bg-orange-100",
  },
  user_input: {
    label: "User Input",
    className: "bg-green-100 text-green-800 hover:bg-green-100",
  },
}

// ─── Derive step type from conditionJson ──────────────────────────────────────

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

// ─── Sortable row ─────────────────────────────────────────────────────────────

function SortableRow({
  step,
  isTouchDevice,
}: {
  step: WorkflowStep
  isTouchDevice: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: step.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const meta = stepTypeMeta[step.stepType]

  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell className="w-10">
        {!isTouchDevice && (
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
            aria-label="Drag to reorder"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
      </TableCell>
      <TableCell className="font-medium">{step.stepName}</TableCell>
      <TableCell>
        <Badge className={meta.className}>{meta.label}</Badge>
      </TableCell>
      <TableCell className="text-right tabular-nums">{step.entriesCount}</TableCell>
    </TableRow>
  )
}

// ─── WorkflowCanvas ───────────────────────────────────────────────────────────

type WorkflowCanvasProps = {
  definitionId: string
  definitionName: string
  steps: WorkflowStep[]
}

export function WorkflowCanvas({ definitionId, definitionName, steps: initialSteps }: WorkflowCanvasProps) {
  const router = useRouter()
  const [steps, setSteps] = useState<WorkflowStep[]>(initialSteps)
  const [isTouchDevice, setIsTouchDevice] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectorOpen, setSelectorOpen] = useState(false)
  const [configFormOpen, setConfigFormOpen] = useState(false)
  const [selectedStepType, setSelectedStepType] = useState<UIStepType | null>(null)

  useEffect(() => {
    setIsTouchDevice(navigator.maxTouchPoints > 0)
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = steps.findIndex((s) => s.id === active.id)
    const newIndex = steps.findIndex((s) => s.id === over.id)

    const reordered = arrayMove(steps, oldIndex, newIndex).map((step, idx) => ({
      ...step,
      stepOrder: idx + 1,
    }))

    // Optimistic update
    const previous = steps
    setSteps(reordered)
    setError(null)

    const result = await reorderWorkflowSteps(
      definitionId,
      reordered.map((s) => ({ stepId: s.id, newStepOrder: s.stepOrder }))
    )

    if (!result.success) {
      setSteps(previous)
      setError(result.error ?? "Gagal menyimpan urutan step. Silakan coba lagi.")
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{definitionName}</h3>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {isTouchDevice && (
        <p className="text-sm text-muted-foreground">
          Drag-and-drop tidak tersedia di perangkat sentuh.
        </p>
      )}

      {steps.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada step pada workflow ini.</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={steps.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Step Name</TableHead>
                  <TableHead>Step Type</TableHead>
                  <TableHead className="text-right">Entries</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {steps.map((step) => (
                  <SortableRow key={step.id} step={step} isTouchDevice={isTouchDevice} />
                ))}
              </TableBody>
            </Table>
          </SortableContext>
        </DndContext>
      )}

      <Button variant="outline" size="sm" onClick={() => setSelectorOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Tambah Step
      </Button>

      <StepTypeSelector
        open={selectorOpen}
        onOpenChange={setSelectorOpen}
        onSelect={(type) => {
          setSelectedStepType(type)
          setSelectorOpen(false)
          setConfigFormOpen(true)
        }}
      />

      {selectedStepType !== null && (
        <StepConfigForm
          open={configFormOpen}
          onOpenChange={setConfigFormOpen}
          onSuccess={() => router.refresh()}
          mode="add"
          definitionId={definitionId}
          stepType={selectedStepType}
        />
      )}
    </div>
  )
}
