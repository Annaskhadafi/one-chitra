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
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { X, Plus } from "lucide-react"
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

const RECIPIENT_ROLES = ["admin", "manager", "staff", "customer", "all"]

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
}

export function TemplateEditorDialog({ open, onOpenChange, template, onSave }: Props) {
    const [variables, setVariables] = useState<string[]>([])
    const [recipientRoles, setRecipientRoles] = useState<string[]>([])
    const [newVar, setNewVar] = useState("")
    const [preview, setPreview] = useState(false)

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
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
                type: template.type,
                subject: template.subject,
                htmlContent: template.htmlContent,
                textContent: template.textContent ?? "",
                isActive: template.isActive,
            })
            setVariables((template.variables as string[]) ?? [])
            setRecipientRoles((template.recipientRoles as string[]) ?? [])
        } else {
            form.reset({
                name: "",
                type: "notification",
                subject: STARTER_TEMPLATES.notification.subject,
                htmlContent: STARTER_TEMPLATES.notification.htmlContent,
                textContent: "",
                isActive: true,
            })
            setVariables(STARTER_TEMPLATES.notification.variables)
            setRecipientRoles([])
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

    function removeVariable(v: string) {
        setVariables((prev) => prev.filter((x) => x !== v))
    }

    function toggleRole(role: string) {
        setRecipientRoles((prev) =>
            prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
        )
    }

    function onSubmit(values: FormValues) {
        onSave({
            ...(template?.id ? { id: template.id } : {}),
            ...values,
            variables,
            recipientRoles,
        } as Partial<Template> & { id?: string })
    }

    const htmlValue = form.watch("htmlContent")

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
                <DialogHeader className="px-6 pt-6 pb-0">
                    <DialogTitle>{template ? "Edit Template" : "New Email Template"}</DialogTitle>
                    <DialogDescription>
                        Use <code className="bg-muted px-1 rounded text-xs">{"{{variableName}}"}</code> placeholders
                        in your subject and HTML content.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
                        <ScrollArea className="flex-1 px-6 py-4">
                            <div className="space-y-5">
                                {/* Name + Type */}
                                <div className="grid grid-cols-2 gap-4">
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
                                    <p className="text-sm font-medium mb-2">Recipient Roles</p>
                                    <p className="text-xs text-muted-foreground mb-2">
                                        Tag which roles this template is intended for (informational only).
                                    </p>
                                    <div className="flex gap-2 flex-wrap">
                                        {RECIPIENT_ROLES.map((role) => (
                                            <button
                                                key={role}
                                                type="button"
                                                onClick={() => toggleRole(role)}
                                                className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                                                    recipientRoles.includes(role)
                                                        ? "bg-primary text-primary-foreground border-primary"
                                                        : "bg-background text-muted-foreground border-input hover:bg-accent"
                                                }`}
                                            >
                                                {role}
                                            </button>
                                        ))}
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
                                                        className="w-full h-64"
                                                        title="Email preview"
                                                        sandbox="allow-same-origin"
                                                    />
                                                </div>
                                            ) : (
                                                <FormControl>
                                                    <Textarea
                                                        {...field}
                                                        className="font-mono text-xs h-64 resize-none"
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
                                                    className="text-sm h-24 resize-none"
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
