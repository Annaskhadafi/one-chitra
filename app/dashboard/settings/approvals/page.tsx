import { Settings2, Workflow } from "lucide-react"
import Link from "next/link"
import {
    createApprovalDefinition,
    createApprovalRequest,
    createApprovalStep,
    getApprovalDefinitions,
    getApprovalFormRegistry,
    getApprovalRequestsByDefinition,
    getWebsiteFormOptions,
    registerApprovalForm,
} from "@/app/actions/approval"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"

export const metadata = {
    title: "Approval Settings – One Chitra",
}

export default async function ApprovalSettingsPage() {
    const [forms, websiteForms, definitions] = await Promise.all([
        getApprovalFormRegistry(),
        getWebsiteFormOptions(),
        getApprovalDefinitions(),
    ])

    const selectedDefinition = definitions[0] ?? null
    const recentRequests = selectedDefinition
        ? await getApprovalRequestsByDefinition(selectedDefinition.id)
        : []

    return (
        <div className="space-y-6 p-6">
            <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                    <Settings2 className="h-6 w-6 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Approval Settings</h1>
                    <p className="text-sm text-muted-foreground">
                        Setup approval matrix, approval tree, dan definisi workflow per form.
                    </p>
                </div>
                <Button asChild variant="outline">
                    <Link href="/dashboard/approvals/matrix">Buka Matrix Approval</Link>
                </Button>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Form Registry</CardTitle>
                        <CardDescription>
                            Daftarkan form yang bisa memakai approval system (form existing maupun form baru).
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <form action={registerApprovalForm} className="space-y-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="discoveredForm">Select Form</Label>
                                <select
                                    id="discoveredForm"
                                    name="discoveredForm"
                                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                                    required
                                    defaultValue=""
                                >
                                    <option value="" disabled>Pilih form dari website</option>
                                    {websiteForms.map((form) => (
                                        <option key={form.modulePath} value={JSON.stringify(form)}>
                                            {form.formName} · {form.modulePath}
                                        </option>
                                    ))}
                                </select>
                                {websiteForms.length === 0 && (
                                    <p className="text-xs text-muted-foreground">
                                        Belum ada form website yang terdeteksi.
                                    </p>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="description">Description</Label>
                                <Textarea id="description" name="description" placeholder="Deskripsi singkat form approval" />
                            </div>
                            <Button type="submit">Tambah Form</Button>
                        </form>

                        <Separator />

                        <div className="space-y-2">
                            {forms.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Belum ada form terdaftar.</p>
                            ) : (
                                forms.map((form) => (
                                    <div key={form.id} className="rounded-md border p-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="font-medium">{form.formName}</p>
                                            <Badge variant={form.isActive ? "default" : "secondary"}>
                                                {form.isActive ? "Active" : "Inactive"}
                                            </Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground">{form.formKey} · {form.modulePath}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Create Workflow Definition</CardTitle>
                        <CardDescription>
                            Definisikan approval tree dengan step sequential dan approver berbasis role/user.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <form action={createApprovalDefinition} className="space-y-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="name">Workflow Name</Label>
                                <Input id="name" name="name" placeholder="Sales Workflow" required />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="formKeyDefinition">Form Key</Label>
                                <select
                                    id="formKeyDefinition"
                                    name="formKey"
                                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                                    required
                                    defaultValue=""
                                >
                                    <option value="" disabled>Pilih form key</option>
                                    {websiteForms.map((form) => (
                                        <option key={`${form.formKey}-${form.modulePath}`} value={form.formKey}>
                                            {form.formName} ({form.formKey})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="descriptionDef">Description</Label>
                                <Textarea id="descriptionDef" name="description" placeholder="Contoh: nominal > 100 juta perlu manager + director" />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="status">Status</Label>
                                <select
                                    id="status"
                                    name="status"
                                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                                    defaultValue="draft"
                                >
                                    <option value="draft">Draft</option>
                                    <option value="active">Active</option>
                                </select>
                            </div>
                            <Button type="submit">Buat Workflow</Button>
                        </form>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Workflow className="h-5 w-5" />
                        Workflow Definitions
                    </CardTitle>
                    <CardDescription>
                        Tambahkan step approval (DDL approver) dan uji submit request ke inbox approval.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                    {definitions.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Belum ada workflow definition.</p>
                    ) : (
                        definitions.map((definition) => (
                            <div key={definition.id} className="space-y-4 rounded-lg border p-4">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="font-semibold">{definition.name}</h3>
                                    <Badge variant="outline">{definition.formKey}</Badge>
                                    <Badge variant="secondary">v{definition.version}</Badge>
                                    <Badge>{definition.status}</Badge>
                                </div>

                                <div className="space-y-2">
                                    {definition.steps.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">Belum ada step.</p>
                                    ) : (
                                        definition.steps
                                            .sort((a, b) => a.stepOrder - b.stepOrder)
                                            .map((step) => (
                                                <div key={step.id} className="rounded-md border px-3 py-2 text-sm">
                                                    Step {step.stepOrder}: {step.stepName} · {step.approverType === "role" ? step.approverRole : step.approverUserId} · min {step.minApprovals}
                                                </div>
                                            ))
                                    )}
                                </div>

                                <form action={createApprovalStep} className="grid gap-3 rounded-md border p-3 lg:grid-cols-5">
                                    <input type="hidden" name="definitionId" value={definition.id} />
                                    <div className="space-y-1.5 lg:col-span-2">
                                        <Label htmlFor={`stepName-${definition.id}`}>Step Name</Label>
                                        <Input id={`stepName-${definition.id}`} name="stepName" placeholder="Manager Approval" required />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor={`approverType-${definition.id}`}>Approver Type</Label>
                                        <select id={`approverType-${definition.id}`} name="approverType" className="h-10 w-full rounded-md border bg-background px-3 text-sm" defaultValue="role">
                                            <option value="role">Role</option>
                                            <option value="user">User</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor={`approverRole-${definition.id}`}>Approver Role</Label>
                                        <Input id={`approverRole-${definition.id}`} name="approverRole" placeholder="manager" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor={`approverUserId-${definition.id}`}>Approver User ID</Label>
                                        <Input id={`approverUserId-${definition.id}`} name="approverUserId" placeholder="opsional jika type=user" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor={`minApprovals-${definition.id}`}>Min Approvals</Label>
                                        <Input id={`minApprovals-${definition.id}`} type="number" min={1} name="minApprovals" defaultValue={1} required />
                                    </div>
                                    <div className="flex items-end">
                                        <Button type="submit" className="w-full">Tambah Step</Button>
                                    </div>
                                </form>

                                <form action={createApprovalRequest} className="grid gap-3 rounded-md border p-3 lg:grid-cols-4">
                                    <input type="hidden" name="definitionId" value={definition.id} />
                                    <input type="hidden" name="formKey" value={definition.formKey} />
                                    <div className="space-y-1.5 lg:col-span-2">
                                        <Label htmlFor={`entityId-${definition.id}`}>Entity ID (Test Request)</Label>
                                        <Input id={`entityId-${definition.id}`} name="entityId" placeholder="mis. QUO-2026-0001" required />
                                    </div>
                                    <div className="flex items-end lg:col-span-2">
                                        <Button type="submit" variant="secondary" className="w-full">Submit Test Request</Button>
                                    </div>
                                </form>
                            </div>
                        ))
                    )}

                    {selectedDefinition && (
                        <div className="rounded-lg border p-4">
                            <h3 className="mb-2 font-medium">Recent Requests · {selectedDefinition.name}</h3>
                            {recentRequests.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Belum ada request.</p>
                            ) : (
                                <div className="space-y-2">
                                    {recentRequests.map((request) => (
                                        <div key={request.id} className="rounded-md border px-3 py-2 text-sm">
                                            {request.formKey} · {request.entityId} · {request.status} · step {request.currentStepOrder}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

        </div>
    )
}
