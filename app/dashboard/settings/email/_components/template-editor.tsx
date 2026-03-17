"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
    Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
    Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Check, ChevronsUpDown, X, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import type { emailTemplates } from "@/db/schema/email"

type Template = typeof emailTemplates.$inferSelect

const TEMPLATE_TYPES = [
    { value: "magic_link", label: "Magic Link" },
    { value: "notification", label: "Notification" },
    { value: "welcome", label: "Welcome" },
    { value: "password_reset", label: "Password Reset" },
    { value: "order_confirmation", label: "Order Confirmation" },
    { value: "delivery_update", label: "Delivery Update" },
    { value: "custom", label: "Custom" },
] as const

const STARTER_TEMPLATES: Record<string, { subject: string; htmlContent: string; variables: string[] }> = {
    magic_link: {
        subject: "Your sign-in link for {{appName}}",
        variables: ["magicLink", "userName", "appName", "expiresIn"],
        htmlContent: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:'Segoe UI',sans-serif;background:#f3f4f6;margin:0;padding:32px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
    <div style="background:#1d4ed8;padding:32px;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:24px">{{appName}}</h1>
    </div>
    <div style="padding:32px">
      <h2 style="margin:0 0 12px;color:#111827">Hi {{userName}} 👋</h2>
      <p style="color:#6b7280;line-height:1.6;margin:0 0 24px">
        Click the button below to sign in. This link will expire in <strong>{{expiresIn}}</strong>.
      </p>
      <a href="{{magicLink}}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600">
        Sign In
      </a>
      <p style="margin:24px 0 0;font-size:12px;color:#9ca3af">
        If you didn't request this, you can safely ignore this email.
      </p>
    </div>
  </div>
</body>
</html>`,
    },
    welcome: {
        subject: "Welcome to {{appName}}! 🎉",
        variables: ["userName", "appName", "loginUrl"],
        htmlContent: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:'Segoe UI',sans-serif;background:#f3f4f6;margin:0;padding:32px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
    <div style="background:#059669;padding:32px;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:24px">Welcome to {{appName}} 🎉</h1>
    </div>
    <div style="padding:32px">
      <h2 style="margin:0 0 12px;color:#111827">Hi {{userName}}!</h2>
      <p style="color:#6b7280;line-height:1.6;margin:0 0 24px">
        Your account has been created successfully. You can now sign in and start using {{appName}}.
      </p>
      <a href="{{loginUrl}}" style="display:inline-block;background:#059669;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600">
        Go to Dashboard
      </a>
    </div>
  </div>
</body>
</html>`,
    },
    notification: {
        subject: "{{title}}",
        variables: ["title", "message", "actionUrl", "appName"],
        htmlContent: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:'Segoe UI',sans-serif;background:#f3f4f6;margin:0;padding:32px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
    <div style="background:#7c3aed;padding:24px 32px">
      <h2 style="color:#fff;margin:0;font-size:18px">{{title}}</h2>
    </div>
    <div style="padding:32px">
      <p style="color:#374151;line-height:1.6;margin:0 0 24px">{{message}}</p>
      <a href="{{actionUrl}}" style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600">
        View Details
      </a>
      <p style="margin:24px 0 0;font-size:12px;color:#9ca3af">{{appName}}</p>
    </div>
  </div>
</body>
</html>`,
    },
    password_reset: {
        subject: "Reset your {{appName}} password",
        variables: ["resetUrl", "userName", "appName", "expiresIn"],
        htmlContent: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:'Segoe UI',sans-serif;background:#f3f4f6;margin:0;padding:32px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
    <div style="background:#dc2626;padding:32px;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:24px">Password Reset</h1>
    </div>
    <div style="padding:32px">
      <h2 style="margin:0 0 12px;color:#111827">Hi {{userName}},</h2>
      <p style="color:#6b7280;line-height:1.6;margin:0 0 24px">
        We received a request to reset your password. Click below to set a new one. 
        This link expires in <strong>{{expiresIn}}</strong>.
      </p>
      <a href="{{resetUrl}}" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600">
        Reset Password
      </a>
      <p style="margin:24px 0 0;font-size:12px;color:#9ca3af">
        If you didn't request this, ignore this email. Your password remains unchanged.
      </p>
    </div>
  </div>
</body>
</html>`,
    },
    order_confirmation: {
        subject: "Order #{{orderNumber}} Confirmed – {{appName}}",
        variables: ["orderNumber", "customerName", "orderTotal", "orderDate", "appName"],
        htmlContent: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:'Segoe UI',sans-serif;background:#f3f4f6;margin:0;padding:32px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
    <div style="background:#f59e0b;padding:32px;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:24px">Order Confirmed ✅</h1>
    </div>
    <div style="padding:32px">
      <p style="color:#374151;line-height:1.6;margin:0 0 16px">Hi <strong>{{customerName}}</strong>,</p>
      <p style="color:#374151;line-height:1.6;margin:0 0 24px">
        Your order <strong>#{{orderNumber}}</strong> placed on {{orderDate}} has been confirmed.
        Total: <strong>{{orderTotal}}</strong>.
      </p>
      <p style="margin:24px 0 0;font-size:12px;color:#9ca3af">{{appName}} — Thank you for your business!</p>
    </div>
  </div>
</body>
</html>`,
    },
    delivery_update: {
        subject: "Delivery Update – Order #{{orderNumber}}",
        variables: ["orderNumber", "customerName", "status", "estimatedDelivery", "trackingUrl", "appName"],
        htmlContent: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:'Segoe UI',sans-serif;background:#f3f4f6;margin:0;padding:32px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
    <div style="background:#0891b2;padding:32px;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:24px">Delivery Update 🚚</h1>
    </div>
    <div style="padding:32px">
      <p style="color:#374151;line-height:1.6;margin:0 0 16px">Hi <strong>{{customerName}}</strong>,</p>
      <p style="color:#374151;line-height:1.6;margin:0 0 24px">
        Your order <strong>#{{orderNumber}}</strong> is now <strong>{{status}}</strong>.
        Estimated delivery: <strong>{{estimatedDelivery}}</strong>.
      </p>
      <a href="{{trackingUrl}}" style="display:inline-block;background:#0891b2;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600">
        Track Order
      </a>
      <p style="margin:24px 0 0;font-size:12px;color:#9ca3af">{{appName}}</p>
    </div>
  </div>
</body>
</html>`,
    },
    custom: {
        subject: "{{subject}}",
        variables: ["subject", "message", "appName"],
        htmlContent: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:'Segoe UI',sans-serif;background:#f3f4f6;margin:0;padding:32px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.1)">
    <h2 style="margin:0 0 16px;color:#111827">{{subject}}</h2>
    <div style="color:#374151;line-height:1.6">{{message}}</div>
    <p style="margin:32px 0 0;font-size:12px;color:#9ca3af">{{appName}}</p>
  </div>
</body>
</html>`,
    },
}

const formSchema = z.object({
    name: z.string().min(1, "Name is required"),
    code: z.string().max(120, "Code is too long").optional().or(z.literal("")),
    type: z.enum(["magic_link", "notification", "welcome", "password_reset", "order_confirmation", "delivery_update", "custom"]),
    subject: z.string().min(1, "Subject is required"),
    htmlContent: z.string().min(1, "HTML content is required"),
    textContent: z.string().optional(),
    isActive: z.boolean(),
})

type FormValues = z.infer<typeof formSchema>

interface Props {
    open: boolean
    onOpenChange: (v: boolean) => void
    template: Template | null
    onSave: (data: Partial<Template> & { id?: string }) => void
    recipientUsers: Array<{
        id: string
        name: string
        email: string
        role: string
    }>
    recipientRoles: string[]
}

export function TemplateEditorDialog({ open, onOpenChange, template, onSave, recipientUsers, recipientRoles: availableRecipientRoles }: Props) {
    const [variables, setVariables] = useState<string[]>([])
    const [selectedRecipientRoles, setSelectedRecipientRoles] = useState<string[]>([])
    const [recipientUserIds, setRecipientUserIds] = useState<string[]>([])
    const [ccEmails, setCcEmails] = useState<string[]>([])
    const [newVar, setNewVar] = useState("")
    const [newCcEmail, setNewCcEmail] = useState("")
    const [preview, setPreview] = useState(false)
    const [userPickerOpen, setUserPickerOpen] = useState(false)

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            code: "",
            type: "notification",
            subject: "",
            htmlContent: "",
            textContent: "",
            isActive: true,
        },
    })

    // Reset form when template changes
    useEffect(() => {
        if (template) {
            form.reset({
                name: template.name,
                code: template.code ?? "",
                type: template.type,
                subject: template.subject,
                htmlContent: template.htmlContent,
                textContent: template.textContent ?? "",
                isActive: template.isActive,
            })
            setVariables((template.variables as string[]) ?? [])
            setSelectedRecipientRoles((template.recipientRoles as string[]) ?? [])
            setRecipientUserIds((template.recipientUserIds as string[]) ?? [])
            setCcEmails((template.ccEmails as string[]) ?? [])
        } else {
            form.reset({
                name: "",
                code: "",
                type: "notification",
                subject: STARTER_TEMPLATES.notification.subject,
                htmlContent: STARTER_TEMPLATES.notification.htmlContent,
                textContent: "",
                isActive: true,
            })
            setVariables(STARTER_TEMPLATES.notification.variables)
            setSelectedRecipientRoles([])
            setRecipientUserIds([])
            setCcEmails([])
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [template, open])

    const watchType = form.watch("type")

    function applyStarterTemplate(type: string) {
        const starter = STARTER_TEMPLATES[type]
        if (starter) {
            form.setValue("subject", starter.subject)
            form.setValue("htmlContent", starter.htmlContent)
            setVariables(starter.variables)
        }
    }

    function addVariable() {
        const v = newVar.trim().replace(/\s+/g, "_")
        if (v && !variables.includes(v)) {
            setVariables((prev) => [...prev, v])
        }
        setNewVar("")
    }

    function addCcEmail() {
        const email = newCcEmail.trim().toLowerCase()
        const isValid = z.string().email().safeParse(email).success
        if (email && isValid && !ccEmails.includes(email)) {
            setCcEmails((prev) => [...prev, email])
        }
        setNewCcEmail("")
    }

    function removeVariable(v: string) {
        setVariables((prev) => prev.filter((x) => x !== v))
    }

    function removeCcEmail(email: string) {
        setCcEmails((prev) => prev.filter((entry) => entry !== email))
    }

    function toggleRole(role: string) {
        setSelectedRecipientRoles((prev) =>
            prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
        )
    }

    function toggleRecipientUser(userId: string) {
        setRecipientUserIds((prev) =>
            prev.includes(userId) ? prev.filter((entry) => entry !== userId) : [...prev, userId]
        )
    }

    function onSubmit(values: FormValues) {
        onSave({
            ...(template?.id ? { id: template.id } : {}),
            ...values,
            code: values.code?.trim() || null,
            variables,
            recipientRoles: selectedRecipientRoles,
            recipientUserIds,
            ccEmails,
        } as Partial<Template> & { id?: string })
    }

    const htmlValue = form.watch("htmlContent")

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="!flex h-[94vh] w-[calc(100vw-1rem)] !max-w-none !flex-col overflow-hidden p-0 sm:h-[92vh] sm:w-[calc(100vw-2.5rem)] sm:max-w-[calc(100vw-2.5rem)] 2xl:max-w-[1600px]">
                <DialogHeader className="px-6 pt-6 pb-0">
                    <DialogTitle>{template ? "Edit Template" : "New Email Template"}</DialogTitle>
                    <DialogDescription>
                        Use <code className="bg-muted px-1 rounded text-xs">{"{{variableName}}"}</code> placeholders
                        in your subject and HTML content.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
                        <ScrollArea className="min-h-0 flex-1 overflow-hidden">
                            <div className="space-y-5 px-6 py-4">
                                {/* Name + Type */}
                                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Template Name</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="E.g. welcome email" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="code"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Template Code</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        placeholder="opsional-untuk-custom-template"
                                                        {...field}
                                                        readOnly={Boolean(template?.code)}
                                                    />
                                                </FormControl>
                                                <FormDescription className="text-xs">
                                                    {template?.code
                                                        ? "Code template sistem dikunci agar alur notifikasi tetap aman."
                                                        : "Gunakan jika template ini akan dipanggil oleh workflow tertentu."}
                                                </FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="type"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Type</FormLabel>
                                                <Select
                                                    value={field.value}
                                                    onValueChange={(v) => {
                                                        field.onChange(v)
                                                        if (!template) applyStarterTemplate(v)
                                                    }}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {TEMPLATE_TYPES.map((t) => (
                                                            <SelectItem key={t.value} value={t.value}>
                                                                {t.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                {/* Subject */}
                                <FormField
                                    control={form.control}
                                    name="subject"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Email Subject</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Your subject line here" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* Recipient Roles */}
                                <div>
                                    <p className="text-sm font-medium mb-2">Recipient Email</p>
                                    <p className="text-xs text-muted-foreground mb-2">
                                        Pilih role atau beberapa user untuk email utama. Daftar ini akan digabung dengan recipient dinamis seperti Sales PIC bila ada.
                                    </p>
                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-xs font-medium text-muted-foreground mb-2">By Role</p>
                                            <div className="flex gap-2 flex-wrap">
                                                {availableRecipientRoles.map((role) => (
                                                    <button
                                                        key={role}
                                                        type="button"
                                                        onClick={() => toggleRole(role)}
                                                        className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                                                            selectedRecipientRoles.includes(role)
                                                                ? "bg-primary text-primary-foreground border-primary"
                                                                : "bg-background text-muted-foreground border-input hover:bg-accent"
                                                        }`}
                                                    >
                                                        {role}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <p className="text-xs font-medium text-muted-foreground mb-2">By User</p>
                                            <div className="flex gap-2 flex-wrap mb-2">
                                                {recipientUserIds.length > 0 ? recipientUserIds.map((userId) => {
                                                    const selectedUser = recipientUsers.find((user) => user.id === userId)
                                                    if (!selectedUser) return null
                                                    return (
                                                        <span
                                                            key={userId}
                                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs"
                                                        >
                                                            {selectedUser.name}
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleRecipientUser(userId)}
                                                                className="hover:text-destructive"
                                                            >
                                                                <X className="h-3 w-3" />
                                                            </button>
                                                        </span>
                                                    )
                                                }) : (
                                                    <span className="text-xs text-muted-foreground">Belum ada user dipilih.</span>
                                                )}
                                            </div>
                                            <Popover open={userPickerOpen} onOpenChange={setUserPickerOpen}>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" role="combobox" className="w-full justify-between sm:w-[420px]">
                                                        Pilih beberapa user
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[min(420px,calc(100vw-3rem))] p-0" align="start">
                                                    <Command>
                                                        <CommandInput placeholder="Cari nama atau email..." />
                                                        <CommandList>
                                                            <CommandEmpty>User tidak ditemukan.</CommandEmpty>
                                                            <CommandGroup heading="Users">
                                                                {recipientUsers.map((user) => (
                                                                    <CommandItem
                                                                        key={user.id}
                                                                        value={`${user.name} ${user.email} ${user.role}`}
                                                                        onSelect={() => toggleRecipientUser(user.id)}
                                                                        className="items-start"
                                                                    >
                                                                        <Checkbox checked={recipientUserIds.includes(user.id)} className="mt-0.5" />
                                                                        <div className="flex flex-col gap-0.5">
                                                                            <span>{user.name}</span>
                                                                            <span className="text-xs text-muted-foreground">{user.email} • {user.role}</span>
                                                                        </div>
                                                                        <Check
                                                                            className={cn(
                                                                                "ml-auto h-4 w-4",
                                                                                recipientUserIds.includes(user.id) ? "opacity-100" : "opacity-0",
                                                                            )}
                                                                        />
                                                                    </CommandItem>
                                                                ))}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <p className="text-sm font-medium mb-2">CC Emails</p>
                                    <p className="text-xs text-muted-foreground mb-2">
                                        Email di sini akan selalu di-CC setiap template ini dipakai.
                                    </p>
                                    <div className="flex gap-2 flex-wrap mb-2">
                                        {ccEmails.map((email) => (
                                            <span
                                                key={email}
                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs"
                                            >
                                                {email}
                                                <button
                                                    type="button"
                                                    onClick={() => removeCcEmail(email)}
                                                    className="hover:text-destructive"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                    <div className="flex gap-2">
                                        <Input
                                            type="email"
                                            placeholder="cc@example.com"
                                            value={newCcEmail}
                                            onChange={(e) => setNewCcEmail(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCcEmail() } }}
                                            className="h-8 text-sm"
                                        />
                                        <Button type="button" size="sm" variant="outline" onClick={addCcEmail} className="h-8 gap-1">
                                            <Plus className="h-3 w-3" />
                                            Add CC
                                        </Button>
                                    </div>
                                </div>

                                {/* Variables */}
                                <div>
                                    <p className="text-sm font-medium mb-2">Template Variables</p>
                                    <p className="text-xs text-muted-foreground mb-2">
                                        These are the <code className="bg-muted px-1 rounded">{"{{variable}}"}</code> placeholders used in this template.
                                    </p>
                                    <div className="flex gap-2 flex-wrap mb-2">
                                        {variables.map((v) => (
                                            <span
                                                key={v}
                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs"
                                            >
                                                {"{{"}{v}{"}}"}
                                                <button
                                                    type="button"
                                                    onClick={() => removeVariable(v)}
                                                    className="hover:text-destructive"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="variableName"
                                            value={newVar}
                                            onChange={(e) => setNewVar(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addVariable() } }}
                                            className="h-8 text-sm"
                                        />
                                        <Button type="button" size="sm" variant="outline" onClick={addVariable} className="h-8 gap-1">
                                            <Plus className="h-3 w-3" />
                                            Add
                                        </Button>
                                    </div>
                                </div>

                                {/* HTML Content */}
                                <FormField
                                    control={form.control}
                                    name="htmlContent"
                                    render={({ field }) => (
                                        <FormItem>
                                            <div className="flex items-center justify-between mb-1">
                                                <FormLabel>HTML Content</FormLabel>
                                                <div className="flex gap-2">
                                                    {!template && (
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 text-xs"
                                                            onClick={() => applyStarterTemplate(watchType)}
                                                        >
                                                            Load starter
                                                        </Button>
                                                    )}
                                                    <Button
                                                        type="button"
                                                        variant={preview ? "default" : "outline"}
                                                        size="sm"
                                                        className="h-7 text-xs"
                                                        onClick={() => setPreview(!preview)}
                                                    >
                                                        {preview ? "Edit" : "Preview"}
                                                    </Button>
                                                </div>
                                            </div>
                                            {preview ? (
                                                <div className="border rounded-md overflow-hidden">
                                                    <iframe
                                                        srcDoc={htmlValue}
                                                        className="h-[420px] w-full"
                                                        title="Email preview"
                                                        sandbox="allow-same-origin"
                                                    />
                                                </div>
                                            ) : (
                                                <FormControl>
                                                    <Textarea
                                                        {...field}
                                                        className="min-h-[420px] resize-none font-mono text-xs"
                                                        placeholder="<html>…</html>"
                                                    />
                                                </FormControl>
                                            )}
                                            <FormDescription className="text-xs">
                                                Write standard HTML. Use {"{{"} and {"}}"}  for variable interpolation.
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* Plain text fallback */}
                                <FormField
                                    control={form.control}
                                    name="textContent"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Plain Text Fallback <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    {...field}
                                                    className="min-h-32 resize-none text-sm"
                                                    placeholder="Plain text version for email clients that don't support HTML"
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* Active toggle */}
                                <FormField
                                    control={form.control}
                                    name="isActive"
                                    render={({ field }) => (
                                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                                            <div>
                                                <FormLabel>Active</FormLabel>
                                                <FormDescription className="text-xs">
                                                    Only active templates are used when sending emails
                                                </FormDescription>
                                            </div>
                                            <FormControl>
                                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </ScrollArea>

                        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-background">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button type="submit">
                                {template ? "Save Changes" : "Create Template"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
