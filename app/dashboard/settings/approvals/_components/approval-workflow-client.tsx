"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import dynamic from "next/dynamic"
import { Settings2, Plus, Workflow, ChevronRight, Edit2, Trash2, CheckCircle, Archive, FileText } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
} from "@/components/ui/card"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { deleteApprovalDefinition, updateApprovalDefinitionStatus } from "@/app/actions/approval"

// Dynamic import untuk WorkflowCanvas (ReactFlow butuh browser DOM)
const WorkflowCanvas = dynamic(
    () => import("@/components/approval/workflow-canvas").then((m) => m.WorkflowCanvas),
    {
        ssr: false,
        loading: () => (
            <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                Memuat canvas...
            </div>
        ),
    }
)

type User = {
    id: string
    name: string | null
    email: string
    role: string | null
}

type Step = {
    id: number
    stepOrder: number
    stepName: string
    approverType: "role" | "user"
    approverRole: string | null
    approverUserId: string | null
    minApprovals: number
    notifyOnAssign: boolean
    notifyOnComplete: boolean
    ccEmails: string | null
    slaDays: number | null
    nodePositionX: number | null
    nodePositionY: number | null
    conditionJson?: Record<string, unknown> | null
}

type Definition = {
    id: string
    name: string
    formKey: string
    description: string | null
    version: number
    status: "draft" | "active" | "archived"
    steps: Step[]
}

type Form = {
    id: string
    formKey: string
    formName: string
    modulePath: string
    isActive: boolean
}

type ApprovalWorkflowClientProps = {
    definitions: Definition[]
    forms: Form[]
    users: User[]
    formRegistryContent: React.ReactNode
    createDefinitionContent: React.ReactNode
}

const STATUS_CONFIG = {
    draft: { label: "Draft", variant: "secondary" as const, icon: FileText },
    active: { label: "Active", variant: "default" as const, icon: CheckCircle },
    archived: { label: "Archived", variant: "outline" as const, icon: Archive },
}

// Full-screen canvas overlay rendered via portal to avoid Dialog interference
function CanvasOverlay({
    definition,
    users,
    onClose,
}: {
    definition: Definition
    users: User[]
    onClose: () => void
}) {
    if (typeof window === "undefined") return null

    return createPortal(
        <div className="fixed inset-0 bg-background" style={{ zIndex: 9999 }}>
            <WorkflowCanvas
                definitionId={definition.id}
                definitionName={definition.name}
                definitionFormKey={definition.formKey}
                initialSteps={definition.steps}
                users={users}
                onClose={onClose}
            />
        </div>,
        document.body
    )
}

export function ApprovalWorkflowClient({
    definitions,
    forms,
    users,
    formRegistryContent,
    createDefinitionContent,
}: ApprovalWorkflowClientProps) {
    const router = useRouter()
    const [editingDefinition, setEditingDefinition] = useState<Definition | null>(null)
    const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) {
        return (
            <div className="space-y-6 p-6">
                <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2">
                        <Settings2 className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Approval Settings</h1>
                        <p className="text-sm text-muted-foreground">Memuat workflow settings...</p>
                    </div>
                </div>
            </div>
        )
    }

    const handleStatusChange = async (definitionId: string, status: "draft" | "active" | "archived") => {
        setIsUpdatingStatus(definitionId)
        try {
            const result = await updateApprovalDefinitionStatus(definitionId, status)
            if (result.success) {
                toast.success(`Status berhasil diubah ke "${status}"`)
                window.location.reload()
            } else {
                toast.error(result.error ?? "Gagal mengubah status")
            }
        } catch {
            toast.error("Terjadi kesalahan saat mengubah status")
        } finally {
            setIsUpdatingStatus(null)
        }
    }

    const handleDelete = async (definitionId: string) => {
        try {
            const result = await deleteApprovalDefinition(definitionId)
            if (result.success) {
                toast.success("Workflow definition berhasil dihapus")
                setTimeout(() => window.location.reload(), 500)
            } else {
                toast.error(result.error ?? "Gagal menghapus: " + result.error)
            }
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Unknown error"
            toast.error("Error: " + msg)
        }
    }

    return (
        <>
            <div className="space-y-6 p-6">
                {/* Page Header */}
                <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2">
                        <Settings2 className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Approval Settings</h1>
                        <p className="text-sm text-muted-foreground">
                            Setup approval workflow secara visual dengan drag-and-drop builder.
                        </p>
                    </div>
                </div>

                <Tabs defaultValue="workflows" id="approval-settings-tabs">
                    <TabsList className="h-10">
                        <TabsTrigger value="workflows" className="gap-2">
                            <Workflow className="h-3.5 w-3.5" />
                            Workflow Definitions
                        </TabsTrigger>
                        <TabsTrigger value="registry" className="gap-2">
                            <FileText className="h-3.5 w-3.5" />
                            Form Registry
                        </TabsTrigger>
                        <TabsTrigger value="create" className="gap-2">
                            <Plus className="h-3.5 w-3.5" />
                            Buat Baru
                        </TabsTrigger>
                    </TabsList>

                    {/* Tab: Workflow Definitions */}
                    <TabsContent value="workflows" className="mt-4 space-y-3">
                        {definitions.length === 0 ? (
                            <Card>
                                <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-3">
                                    <Workflow className="h-10 w-10 text-muted-foreground/40" />
                                    <p className="text-muted-foreground text-sm">Belum ada workflow definition.</p>
                                    <p className="text-xs text-muted-foreground">Buat definisi workflow baru di tab &quot;Buat Baru&quot;.</p>
                                </CardContent>
                            </Card>
                        ) : (
                            definitions.map((def) => {
                                const statusCfg = STATUS_CONFIG[def.status]
                                const formName = forms.find((f) => f.formKey === def.formKey)?.formName ?? def.formKey

                                return (
                                    <Card key={def.id} className="overflow-hidden transition-shadow hover:shadow-md">
                                        <div className="flex items-center gap-4 p-4">
                                            {/* Icon */}
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                                                <Workflow className="h-5 w-5 text-primary" />
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="font-semibold">{def.name}</p>
                                                    <Badge variant={statusCfg.variant} className="gap-1 text-xs">
                                                        <statusCfg.icon className="h-3 w-3" />
                                                        {statusCfg.label}
                                                    </Badge>
                                                    <Badge variant="outline" className="text-xs">v{def.version}</Badge>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                                    <span className="text-xs text-muted-foreground">{formName}</span>
                                                    <span className="text-xs text-muted-foreground">·</span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {def.steps.length} step{def.steps.length !== 1 ? "s" : ""}
                                                    </span>
                                                    {def.description && (
                                                        <>
                                                            <span className="text-xs text-muted-foreground">·</span>
                                                            <span className="text-xs text-muted-foreground truncate max-w-[200px]">{def.description}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex shrink-0 items-center gap-2">
                                                {/* Status toggle */}
                                                {def.status !== "active" && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-xs gap-1"
                                                        disabled={isUpdatingStatus === def.id}
                                                        onClick={() => handleStatusChange(def.id, "active")}
                                                    >
                                                        <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                                                        Aktifkan
                                                    </Button>
                                                )}
                                                {def.status === "active" && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-xs gap-1"
                                                        disabled={isUpdatingStatus === def.id}
                                                        onClick={() => handleStatusChange(def.id, "draft")}
                                                    >
                                                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                                        Set Draft
                                                    </Button>
                                                )}

                                                {/* Delete */}
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Hapus Workflow Definition?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Workflow &quot;{def.name}&quot; dan semua stepnya akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Batal</AlertDialogCancel>
                                                            <AlertDialogAction
                                                                onClick={() => handleDelete(def.id)}
                                                                className="bg-destructive hover:bg-destructive/90"
                                                            >
                                                                Hapus
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>

                                                {/* Edit Workflow */}
                                                <Button
                                                    size="sm"
                                                    className="gap-1.5"
                                                    onClick={() => router.push(`/dashboard/settings/approvals/${def.id}/canvas`)}
                                                >
                                                    <Edit2 className="h-3.5 w-3.5" />
                                                    Edit Workflow
                                                    <ChevronRight className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Step preview pills */}
                                        {def.steps.length > 0 && (
                                            <div className="border-t bg-muted/30 px-4 py-2 flex items-center gap-2 overflow-x-auto">
                                                <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                                                {def.steps
                                                    .sort((a, b) => a.stepOrder - b.stepOrder)
                                                    .map((step, idx) => (
                                                        <div key={step.id} className="flex items-center gap-2 shrink-0">
                                                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                                            <span className="rounded-md border bg-card px-2 py-0.5 text-xs font-medium">
                                                                {idx + 1}. {step.stepName}
                                                            </span>
                                                        </div>
                                                    ))}
                                                <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                                <div className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
                                            </div>
                                        )}
                                    </Card>
                                )
                            })
                        )}
                    </TabsContent>

                    {/* Tab: Form Registry */}
                    <TabsContent value="registry" className="mt-4">
                        {formRegistryContent}
                    </TabsContent>

                    {/* Tab: Create New */}
                    <TabsContent value="create" className="mt-4">
                        {createDefinitionContent}
                    </TabsContent>
                </Tabs>
            </div>

            {/* Canvas Overlay — render via portal langsung ke body, tanpa Dialog */}
            {editingDefinition && (
                <CanvasOverlay
                    definition={editingDefinition}
                    users={users}
                    onClose={() => setEditingDefinition(null)}
                />
            )}
        </>
    )
}
