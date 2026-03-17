"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
    Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Plus, MoreHorizontal, Pencil, Trash2, Copy } from "lucide-react"
import {
    deleteEmailTemplate,
    toggleEmailTemplate,
    createEmailTemplate,
    updateEmailTemplate,
} from "@/app/actions/email"
import { TemplateEditorDialog } from "./template-editor"
import type { emailTemplates } from "@/db/schema/email"

type Template = typeof emailTemplates.$inferSelect

const TYPE_COLORS: Record<string, string> = {
    magic_link: "bg-purple-100 text-purple-800",
    notification: "bg-blue-100 text-blue-800",
    welcome: "bg-green-100 text-green-800",
    password_reset: "bg-orange-100 text-orange-800",
    order_confirmation: "bg-yellow-100 text-yellow-800",
    delivery_update: "bg-cyan-100 text-cyan-800",
    custom: "bg-gray-100 text-gray-800",
}

const TYPE_LABELS: Record<string, string> = {
    magic_link: "Magic Link",
    notification: "Notification",
    welcome: "Welcome",
    password_reset: "Password Reset",
    order_confirmation: "Order Confirmation",
    delivery_update: "Delivery Update",
    custom: "Custom",
}

interface Props {
    initialTemplates: Template[]
    recipientUsers: Array<{
        id: string
        name: string
        email: string
        role: string
    }>
    recipientRoles: string[]
}

export function TemplateList({ initialTemplates, recipientUsers, recipientRoles }: Props) {
    const [templates, setTemplates] = useState<Template[]>(initialTemplates)
    const [editorOpen, setEditorOpen] = useState(false)
    const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)

    async function handleToggle(id: string, isActive: boolean) {
        const res = await toggleEmailTemplate(id, isActive)
        if (res.success) {
            setTemplates((prev) =>
                prev.map((t) => (t.id === id ? { ...t, isActive } : t))
            )
        } else {
            toast.error(res.error ?? "Failed to toggle template")
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("Delete this template? This cannot be undone.")) return
        const res = await deleteEmailTemplate(id)
        if (res.success) {
            setTemplates((prev) => prev.filter((t) => t.id !== id))
            toast.success("Template deleted")
        } else {
            toast.error(res.error ?? "Failed to delete")
        }
    }

    async function handleDuplicate(template: Template) {
        const res = await createEmailTemplate({
            name: `${template.name} (copy)`,
            code: null,
            type: template.type,
            subject: template.subject,
            htmlContent: template.htmlContent,
            textContent: template.textContent ?? undefined,
            variables: (template.variables as string[]) ?? [],
            recipientRoles: (template.recipientRoles as string[]) ?? [],
            recipientUserIds: (template.recipientUserIds as string[]) ?? [],
            ccEmails: (template.ccEmails as string[]) ?? [],
            isActive: false,
        })
        if (res.success && res.template) {
            setTemplates((prev) => [...prev, res.template!])
            toast.success("Template duplicated")
        } else {
            toast.error(res.error ?? "Failed to duplicate")
        }
    }

    async function handleSave(data: Partial<Template> & { id?: string }) {
        const normalizedData = {
            ...data,
            code: typeof data.code === "string" ? (data.code.trim() || null) : (data.code ?? null),
        }

        if (data.id) {
            const res = await updateEmailTemplate(data.id, normalizedData as Parameters<typeof updateEmailTemplate>[1])
            if (res.success) {
                setTemplates((prev) =>
                    prev.map((t) => (t.id === data.id ? { ...t, ...normalizedData, updatedAt: new Date() } : t))
                )
                toast.success("Template updated")
            } else {
                toast.error(res.error ?? "Failed to update")
            }
        } else {
            const res = await createEmailTemplate(normalizedData as Parameters<typeof createEmailTemplate>[0])
            if (res.success && res.template) {
                setTemplates((prev) => [...prev, res.template!])
                toast.success("Template created")
            } else {
                toast.error(res.error ?? "Failed to create")
            }
        }
        setEditorOpen(false)
        setEditingTemplate(null)
    }

    function openCreate() {
        setEditingTemplate(null)
        setEditorOpen(true)
    }

    function openEdit(template: Template) {
        setEditingTemplate(template)
        setEditorOpen(true)
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Email Templates</CardTitle>
                    <CardDescription>
                        Manage templates for magic links, notifications, welcome emails and more.
                        Use <code className="bg-muted px-1 rounded text-xs">{"{{variable}}"}</code> syntax for dynamic values.
                    </CardDescription>
                </div>
                <Button onClick={openCreate} size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    New Template
                </Button>
            </CardHeader>

            <CardContent>
                {templates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground space-y-3">
                        <div className="text-4xl">📭</div>
                        <p className="font-medium">No templates yet</p>
                        <p className="text-sm">Create your first template to get started.</p>
                        <Button onClick={openCreate} variant="secondary" size="sm" className="gap-2 mt-2">
                            <Plus className="h-4 w-4" />
                            Create Template
                        </Button>
                    </div>
                ) : (
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Code</TableHead>
                                    <TableHead>CC</TableHead>
                                    <TableHead>Subject</TableHead>
                                    <TableHead>Recipients</TableHead>
                                    <TableHead>Active</TableHead>
                                    <TableHead className="w-12" />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {templates.map((tmpl) => (
                                    <TableRow key={tmpl.id}>
                                        <TableCell className="font-medium">{tmpl.name}</TableCell>
                                        <TableCell>
                                            <span
                                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[tmpl.type] ?? "bg-gray-100 text-gray-800"}`}
                                            >
                                                {TYPE_LABELS[tmpl.type] ?? tmpl.type}
                                            </span>
                                        </TableCell>
                                        <TableCell className="max-w-[180px]">
                                            {tmpl.code ? (
                                                <Badge variant="secondary" className="font-mono text-[11px]">
                                                    {tmpl.code}
                                                </Badge>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="max-w-[220px]">
                                            <div className="flex gap-1 flex-wrap">
                                                {((tmpl.ccEmails as string[]) ?? []).length > 0
                                                    ? (tmpl.ccEmails as string[]).map((email) => (
                                                        <Badge key={email} variant="outline" className="text-[11px]">
                                                            {email}
                                                        </Badge>
                                                    ))
                                                    : <span className="text-xs text-muted-foreground">—</span>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="max-w-[240px] truncate text-sm text-muted-foreground">
                                            {tmpl.subject}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-1 flex-wrap">
                                                {((tmpl.recipientRoles as string[]) ?? []).length > 0
                                                    ? (tmpl.recipientRoles as string[]).map((r) => (
                                                        <Badge key={r} variant="outline" className="text-xs">
                                                            {r}
                                                        </Badge>
                                                    ))
                                                    : <span className="text-xs text-muted-foreground">—</span>}
                                                {((tmpl.recipientUserIds as string[]) ?? []).map((userId) => {
                                                    const user = recipientUsers.find((entry) => entry.id === userId)
                                                    if (!user) return null
                                                    return (
                                                        <Badge key={userId} variant="secondary" className="text-xs">
                                                            {user.name}
                                                        </Badge>
                                                    )
                                                })}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Switch
                                                checked={tmpl.isActive}
                                                onCheckedChange={(v) => handleToggle(tmpl.id, v)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => openEdit(tmpl)} className="gap-2">
                                                        <Pencil className="h-4 w-4" />
                                                        Edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleDuplicate(tmpl)} className="gap-2">
                                                        <Copy className="h-4 w-4" />
                                                        Duplicate
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => handleDelete(tmpl.id)}
                                                        className="gap-2 text-destructive focus:text-destructive"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                        Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>

            <TemplateEditorDialog
                open={editorOpen}
                onOpenChange={(v) => { setEditorOpen(v); if (!v) setEditingTemplate(null) }}
                template={editingTemplate}
                onSave={handleSave}
                recipientUsers={recipientUsers}
                recipientRoles={recipientRoles}
            />
        </Card>
    )
}
