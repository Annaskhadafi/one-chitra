import { Settings2 } from "lucide-react"
import {
    createApprovalDefinition,
    getApprovalDefinitions,
    getApprovalFormRegistry,
    getApprovalUsersForSelect,
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
import { ApprovalWorkflowClient } from "./_components/approval-workflow-client"

export const metadata = {
    title: "Approval Settings – One Chitra",
}

// Void wrappers to satisfy Next.js form action type
async function registerApprovalFormVoid(formData: FormData): Promise<void> {
    "use server"
    await registerApprovalForm(formData)
}

async function createApprovalDefinitionVoid(formData: FormData): Promise<void> {
    "use server"
    await createApprovalDefinition(formData)
}

export default async function ApprovalSettingsPage() {
    const [forms, websiteForms, definitions, users] = await Promise.all([
        getApprovalFormRegistry(),
        getWebsiteFormOptions(),
        getApprovalDefinitions(),
        getApprovalUsersForSelect(),
    ])

    // Form Registry Card (server-rendered, passed as slot)
    const formRegistryContent = (
        <div className="grid gap-4 lg:grid-cols-2">
            <Card>
                <CardHeader>
                    <CardTitle>Daftarkan Form</CardTitle>
                    <CardDescription>
                        Pilih form dari halaman yang tersedia, atau daftarkan manual.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <form action={registerApprovalFormVoid} className="space-y-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="discoveredForm">Pilih Form dari Website</Label>
                            <select
                                id="discoveredForm"
                                name="discoveredForm"
                                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
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
                                <p className="text-xs text-muted-foreground">Belum ada form website yang terdeteksi.</p>
                            )}
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="description">Description</Label>
                            <Textarea id="description" name="description" placeholder="Deskripsi singkat form approval" />
                        </div>
                        <Button type="submit">Tambah Form</Button>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Form Terdaftar</CardTitle>
                    <CardDescription>
                        {forms.length} form terdaftar dalam sistem approval.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                        {forms.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Belum ada form terdaftar.</p>
                        ) : (
                            forms.map((form) => (
                                <div key={form.id} className="rounded-md border p-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="font-medium text-sm">{form.formName}</p>
                                        <Badge variant={form.isActive ? "default" : "secondary"}>
                                            {form.isActive ? "Active" : "Inactive"}
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5">{form.formKey} · {form.modulePath}</p>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    )

    // Create Definition Card (server-rendered, passed as slot)
    const createDefinitionContent = (
        <div className="max-w-xl">
            <Card>
                <CardHeader>
                    <CardTitle>Buat Workflow Definition</CardTitle>
                    <CardDescription>
                        Definisikan nama workflow dan form yang akan menggunakan approval ini.
                        Setelah dibuat, buka editor visual untuk menambah approval steps.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form action={createApprovalDefinitionVoid} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="name">Workflow Name</Label>
                            <Input id="name" name="name" placeholder="e.g. Sales Order Approval" required />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="formKeyDefinition">Form</Label>
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
                            <Label htmlFor="descriptionDef">Description (opsional)</Label>
                            <Textarea id="descriptionDef" name="description" placeholder="Contoh: Digunakan untuk SO dengan nominal > 100 juta" />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="status">Status Awal</Label>
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
                        <Separator />
                        <Button type="submit" className="w-full">Buat Workflow Definition</Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )

    return (
        <ApprovalWorkflowClient
            definitions={definitions as Parameters<typeof ApprovalWorkflowClient>[0]["definitions"]}
            forms={forms}
            users={users}
            formRegistryContent={formRegistryContent}
            createDefinitionContent={createDefinitionContent}
        />
    )
}
