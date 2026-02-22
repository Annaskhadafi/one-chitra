"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import {
    Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card"
import {
    Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Eye, EyeOff, Send, Save, Wifi, AlertCircle } from "lucide-react"
import { saveSmtpSettings, testSmtpConnection } from "@/app/actions/email"
import type { smtpSettings } from "@/db/schema/email"

type SmtpRow = typeof smtpSettings.$inferSelect

const schema = z.object({
    host: z.string().min(1, "Host is required"),
    port: z.string().regex(/^\d+$/, "Must be a number"),
    secure: z.boolean(),
    username: z.string().email("Must be a valid email / username"),
    password: z.string().min(1, "Password / App Password is required"),
    fromEmail: z.string().email("Must be a valid email"),
    fromName: z.string().min(1, "Sender name is required"),
    isActive: z.boolean(),
})

type FormValues = z.infer<typeof schema>

const GOOGLE_PRESET = { host: "smtp.gmail.com", port: "587", secure: false }
const GOOGLE_SSL_PRESET = { host: "smtp.gmail.com", port: "465", secure: true }

interface Props {
    initialData: SmtpRow | null
}

export function SmtpSettingsForm({ initialData }: Props) {
    const [showPassword, setShowPassword] = useState(false)
    const [isTesting, setIsTesting] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [testEmail, setTestEmail] = useState("")

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            host: initialData?.host ?? "smtp.gmail.com",
            port: initialData?.port ?? "587",
            secure: initialData?.secure ?? false,
            username: initialData?.username ?? "",
            password: initialData?.password ?? "",
            fromEmail: initialData?.fromEmail ?? "",
            fromName: initialData?.fromName ?? "One Chitra",
            isActive: initialData?.isActive ?? true,
        },
    })

    async function onSubmit(values: FormValues) {
        setIsSaving(true)
        try {
            const res = await saveSmtpSettings(values)
            if (res.success) {
                toast.success("SMTP settings saved successfully")
            } else {
                toast.error(res.error ?? "Failed to save settings")
            }
        } finally {
            setIsSaving(false)
        }
    }

    async function handleTest() {
        const values = form.getValues()
        if (!testEmail) {
            toast.error("Enter a test recipient email first")
            return
        }
        setIsTesting(true)
        try {
            const res = await testSmtpConnection({ ...values, testTo: testEmail })
            if (res.success) {
                toast.success(`Test email sent to ${testEmail}`)
            } else {
                toast.error(res.error ?? "Test failed")
            }
        } finally {
            setIsTesting(false)
        }
    }

    function applyPreset(preset: { host: string; port: string; secure: boolean }) {
        form.setValue("host", preset.host)
        form.setValue("port", preset.port)
        form.setValue("secure", preset.secure)
    }

    return (
        <div className="grid gap-6 lg:grid-cols-2">
            {/* Left column – SMTP form */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        SMTP Configuration
                        <Badge variant={form.watch("isActive") ? "default" : "secondary"}>
                            {form.watch("isActive") ? "Active" : "Inactive"}
                        </Badge>
                    </CardTitle>
                    <CardDescription>
                        Configure outgoing mail server. For Gmail, use an App Password (not your
                        account password).
                    </CardDescription>
                </CardHeader>

                <CardContent>
                    {/* Quick presets */}
                    <div className="mb-6">
                        <p className="text-sm text-muted-foreground mb-2 font-medium">Quick Preset</p>
                        <div className="flex gap-2 flex-wrap">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => applyPreset(GOOGLE_PRESET)}
                            >
                                📧 Gmail (TLS 587)
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => applyPreset(GOOGLE_SSL_PRESET)}
                            >
                                🔒 Gmail (SSL 465)
                            </Button>
                        </div>
                    </div>

                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            {/* Host + Port */}
                            <div className="grid grid-cols-3 gap-3">
                                <FormField
                                    control={form.control}
                                    name="host"
                                    render={({ field }) => (
                                        <FormItem className="col-span-2">
                                            <FormLabel>SMTP Host</FormLabel>
                                            <FormControl>
                                                <Input placeholder="smtp.gmail.com" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="port"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Port</FormLabel>
                                            <FormControl>
                                                <Input placeholder="587" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {/* Secure toggle */}
                            <FormField
                                control={form.control}
                                name="secure"
                                render={({ field }) => (
                                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                                        <div>
                                            <FormLabel>SSL/TLS</FormLabel>
                                            <FormDescription className="text-xs">
                                                Enable for port 465, disable for 587 (STARTTLS)
                                            </FormDescription>
                                        </div>
                                        <FormControl>
                                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />

                            {/* Username */}
                            <FormField
                                control={form.control}
                                name="username"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Gmail Address</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="email"
                                                placeholder="yourname@gmail.com"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Password */}
                            <FormField
                                control={form.control}
                                name="password"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>App Password</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Input
                                                    type={showPassword ? "text" : "password"}
                                                    placeholder="xxxx xxxx xxxx xxxx"
                                                    {...field}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                                >
                                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </button>
                                            </div>
                                        </FormControl>
                                        <FormDescription className="flex items-start gap-1.5 text-xs">
                                            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
                                            Use a Gmail App Password, not your regular password.
                                            Enable 2FA in Google Account first, then generate one at{" "}
                                            <a
                                                href="https://myaccount.google.com/apppasswords"
                                                target="_blank"
                                                rel="noreferrer"
                                                className="underline text-primary"
                                            >
                                                myaccount.google.com/apppasswords
                                            </a>
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <Separator />

                            {/* From */}
                            <div className="grid grid-cols-2 gap-3">
                                <FormField
                                    control={form.control}
                                    name="fromName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Sender Name</FormLabel>
                                            <FormControl>
                                                <Input placeholder="One Chitra" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="fromEmail"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>From Email</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="email"
                                                    placeholder="noreply@yourcompany.com"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {/* Active toggle */}
                            <FormField
                                control={form.control}
                                name="isActive"
                                render={({ field }) => (
                                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                                        <div>
                                            <FormLabel>Enable SMTP</FormLabel>
                                            <FormDescription className="text-xs">
                                                Activate this configuration for all outgoing emails
                                            </FormDescription>
                                        </div>
                                        <FormControl>
                                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />

                            <Button type="submit" className="w-full" disabled={isSaving}>
                                <Save className="h-4 w-4 mr-2" />
                                {isSaving ? "Saving…" : "Save SMTP Settings"}
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>

            {/* Right column – Test + Guide */}
            <div className="space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Wifi className="h-5 w-5" />
                            Send Test Email
                        </CardTitle>
                        <CardDescription>
                            Verify your SMTP settings by sending a test message.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div>
                            <label className="text-sm font-medium mb-1.5 block">
                                Recipient Email
                            </label>
                            <Input
                                type="email"
                                placeholder="test@example.com"
                                value={testEmail}
                                onChange={(e) => setTestEmail(e.target.value)}
                            />
                        </div>
                        <Button
                            variant="secondary"
                            className="w-full"
                            onClick={handleTest}
                            disabled={isTesting}
                        >
                            <Send className="h-4 w-4 mr-2" />
                            {isTesting ? "Sending…" : "Send Test Email"}
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>📱 Gmail Setup Guide</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ol className="text-sm space-y-2 text-muted-foreground list-decimal list-inside">
                            <li>
                                Open{" "}
                                <a
                                    href="https://myaccount.google.com/security"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="underline text-primary"
                                >
                                    Google Account Security
                                </a>
                            </li>
                            <li>Enable <strong>2-Step Verification</strong></li>
                            <li>
                                Go to{" "}
                                <a
                                    href="https://myaccount.google.com/apppasswords"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="underline text-primary"
                                >
                                    App Passwords
                                </a>
                            </li>
                            <li>Create an app password for <strong>Mail</strong></li>
                            <li>Copy the 16-character password into the field above</li>
                            <li>Use <code className="bg-muted px-1 rounded text-xs">smtp.gmail.com</code> on port <code className="bg-muted px-1 rounded text-xs">587</code></li>
                        </ol>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
