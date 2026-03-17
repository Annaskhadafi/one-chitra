"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { Bell, Plus, MoreHorizontal, Pencil, Trash2, History, X, HelpCircle, ChevronsUpDown } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { emailNotificationRuleLogs, emailNotificationRules, emailTemplates } from "@/db/schema/email"
import {
    createEmailNotificationRule,
    deleteEmailNotificationRule,
    getEmailNotificationRuleLogs,
    searchRecipientEmails,
    toggleEmailNotificationRule,
    updateEmailNotificationRule,
} from "@/app/actions/email"
import {
    getApprovalFormFieldOptions,
    getApprovalFormRegistry,
    getWebsiteFormFieldOptions,
    getWebsiteFormOptions,
} from "@/app/actions/approval"
import {
    addRecipientsWithValidation,
    isValidEmailFormat,
    normalizeRecipientList,
    splitEmailCandidates,
    validateConditionDrafts,
} from "@/lib/email-notification-rule-form-utils"

type Rule = typeof emailNotificationRules.$inferSelect
type Template = typeof emailTemplates.$inferSelect
type LogRow = typeof emailNotificationRuleLogs.$inferSelect
type WebsiteFormOption = { formKey: string; formName: string; modulePath: string }
type RegistryFormOption = { formKey: string; formName: string; modulePath: string | null }

type FieldMeta = {
    key: string
    dataType: "string" | "number" | "date" | "boolean" | "array"
}

type ComparisonOption = {
    value: string
    label: string
    needsValue: boolean
}

const COMPARISON_OPTIONS: Record<FieldMeta["dataType"], ComparisonOption[]> = {
    string: [
        { value: "exists", label: "Ada", needsValue: false },
        { value: "not_exists", label: "Tidak ada", needsValue: false },
        { value: "is_empty", label: "Kosong", needsValue: false },
        { value: "is_not_empty", label: "Tidak kosong", needsValue: false },
        { value: "eq", label: "=", needsValue: true },
        { value: "neq", label: "!=", needsValue: true },
        { value: "contains", label: "LIKE", needsValue: true },
        { value: "not_contains", label: "NOT LIKE", needsValue: true },
        { value: "starts_with", label: "Starts With", needsValue: true },
        { value: "ends_with", label: "Ends With", needsValue: true },
        { value: "regex", label: "Regex", needsValue: true },
    ],
    number: [
        { value: "exists", label: "Ada", needsValue: false },
        { value: "not_exists", label: "Tidak ada", needsValue: false },
        { value: "is_empty", label: "Kosong", needsValue: false },
        { value: "is_not_empty", label: "Tidak kosong", needsValue: false },
        { value: "eq", label: "=", needsValue: true },
        { value: "neq", label: "!=", needsValue: true },
        { value: "gt", label: ">", needsValue: true },
        { value: "lt", label: "<", needsValue: true },
        { value: "gte", label: ">=", needsValue: true },
        { value: "lte", label: "<=", needsValue: true },
    ],
    date: [
        { value: "exists", label: "Ada", needsValue: false },
        { value: "not_exists", label: "Tidak ada", needsValue: false },
        { value: "is_empty", label: "Kosong", needsValue: false },
        { value: "is_not_empty", label: "Tidak kosong", needsValue: false },
        { value: "eq", label: "=", needsValue: true },
        { value: "neq", label: "!=", needsValue: true },
        { value: "after", label: ">", needsValue: true },
        { value: "before", label: "<", needsValue: true },
        { value: "on_or_after", label: ">=", needsValue: true },
        { value: "on_or_before", label: "<=", needsValue: true },
    ],
    boolean: [
        { value: "exists", label: "Ada", needsValue: false },
        { value: "not_exists", label: "Tidak ada", needsValue: false },
        { value: "is_true", label: "True", needsValue: false },
        { value: "is_false", label: "False", needsValue: false },
        { value: "eq", label: "=", needsValue: true },
        { value: "neq", label: "!=", needsValue: true },
    ],
    array: [
        { value: "exists", label: "Ada", needsValue: false },
        { value: "not_exists", label: "Tidak ada", needsValue: false },
        { value: "is_empty", label: "Kosong", needsValue: false },
        { value: "is_not_empty", label: "Tidak kosong", needsValue: false },
        { value: "contains", label: "IN", needsValue: true },
        { value: "not_contains", label: "NOT IN", needsValue: true },
        { value: "len_eq", label: "LEN =", needsValue: true },
        { value: "len_gt", label: "LEN >", needsValue: true },
        { value: "len_gte", label: "LEN >=", needsValue: true },
        { value: "len_lt", label: "LEN <", needsValue: true },
        { value: "len_lte", label: "LEN <=", needsValue: true },
    ],
}

const conditionSchema = z.object({
    id: z.string().min(1),
    fieldKey: z.string().min(1),
    operator: z.string().min(1),
    value: z.string().optional().nullable(),
    dataType: z.enum(["string", "number", "date", "boolean", "array"]).optional(),
})

const ruleOptionsSchema = z.object({
    priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
    scheduleType: z.enum(["immediate", "daily", "weekly", "custom_cron"]).default("immediate"),
    scheduleValue: z.string().optional().nullable(),
    includeAttachments: z.boolean().default(false),
    attachmentMode: z.enum(["none", "all", "filtered"]).default("none"),
    allowedFileTypes: z.array(z.string()).default([]),
    maxAttachmentMb: z.number().min(1).max(50).default(10),
    replyTo: z.string().optional().nullable(),
    subjectPrefix: z.string().optional().nullable(),
})

const ruleSchema = z.object({
    name: z.string().min(1, "Nama rule wajib diisi"),
    formKey: z.string().min(1, "Form wajib dipilih"),
    combinator: z.enum(["AND", "OR"]),
    templateId: z.string().min(1, "Template wajib dipilih"),
    toEmails: z.array(z.string().email("Format email tidak valid")).max(50, "Maksimum 50 penerima"),
    ccEmails: z.array(z.string().email("Format email tidak valid")).max(50, "Maksimum 50 penerima"),
    isActive: z.boolean(),
    conditions: z.array(conditionSchema),
    options: ruleOptionsSchema,
})

type RuleFormValues = z.infer<typeof ruleSchema>

function randomId() {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function RuleLogsDialog({ open, onOpenChange, logs }: { open: boolean; onOpenChange: (v: boolean) => void; logs: LogRow[] }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-6xl max-h-[85vh] overflow-hidden">
                <DialogHeader>
                    <DialogTitle>Riwayat Notifikasi</DialogTitle>
                    <DialogDescription>Menampilkan notifikasi yang berhasil / gagal dikirim.</DialogDescription>
                </DialogHeader>
                <ScrollArea className="h-[70vh] rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Waktu</TableHead>
                                <TableHead>Entity</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>To</TableHead>
                                <TableHead>Subject</TableHead>
                                <TableHead>Error</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {logs.map((row) => (
                                <TableRow key={row.id}>
                                    <TableCell className="whitespace-nowrap">{row.createdAt ? new Date(row.createdAt).toLocaleString("id-ID") : "-"}</TableCell>
                                    <TableCell className="font-mono text-xs">{row.entityId}</TableCell>
                                    <TableCell><Badge variant={row.status === "sent" ? "default" : "destructive"}>{row.status}</Badge></TableCell>
                                    <TableCell className="max-w-[260px] truncate text-xs">{row.toEmail ?? "-"}</TableCell>
                                    <TableCell className="max-w-[360px] truncate text-xs">{row.subject ?? "-"}</TableCell>
                                    <TableCell className="max-w-[420px] truncate text-xs text-muted-foreground">{row.errorMessage ?? "-"}</TableCell>
                                </TableRow>
                            ))}
                            {logs.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">Belum ada riwayat.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}

function EmailRecipientMultiSelect(props: {
    label: string
    value: string[]
    onChange: (next: string[]) => void
    placeholder: string
}) {
    const value = props.value
    const [query, setQuery] = useState("")
    const [suggestions, setSuggestions] = useState<Array<{ id: string; email: string; name: string | null; role: string | null }>>([])
    const [loading, setLoading] = useState(false)
    const [invalidHint, setInvalidHint] = useState<string | null>(null)
    const [openSuggestion, setOpenSuggestion] = useState(false)

    useEffect(() => {
        const safeQuery = query.trim()
        if (safeQuery.length < 3) {
            setSuggestions([])
            setLoading(false)
            return
        }

        const timer = setTimeout(async () => {
            setLoading(true)
            try {
                const rows = await searchRecipientEmails(safeQuery)
                setSuggestions(rows)
                setOpenSuggestion(true)
            } finally {
                setLoading(false)
            }
        }, 260)

        return () => clearTimeout(timer)
    }, [query])

    const addCandidates = (candidates: string[]) => {
        const result = addRecipientsWithValidation({
            current: value,
            incoming: candidates,
            max: 50,
        })
        props.onChange(result.values)
        if (result.invalid.length > 0) {
            setInvalidHint(`Email tidak valid: ${result.invalid.join(", ")}`)
        } else {
            setInvalidHint(null)
        }
        if (result.maxReached && result.values.length >= 50) {
            toast.error("Maksimum 50 penerima")
        }
    }

    const commitQuery = () => {
        const candidates = splitEmailCandidates(query)
        if (candidates.length === 0) return
        addCandidates(candidates)
        setQuery("")
        setOpenSuggestion(false)
    }

    const removeEmail = (email: string) => {
        props.onChange(value.filter((item) => item !== email))
    }

    return (
        <div className="space-y-1.5">
            <Label className="text-sm">{props.label}</Label>
            <div className="rounded-md border bg-background px-2 py-2">
                <div className="flex flex-wrap gap-2 mb-2">
                    {value.map((email) => (
                        <Badge key={email} variant="secondary" className="gap-1 py-1 text-xs">
                            {email}
                            <button type="button" onClick={() => removeEmail(email)} aria-label={`hapus ${email}`}>
                                <X className="h-3 w-3" />
                            </button>
                        </Badge>
                    ))}
                </div>
                <Input
                    value={query}
                    onChange={(event) => {
                        const next = event.target.value
                        setQuery(next)
                        if (next.includes(",") || next.includes(";") || next.includes(" ")) {
                            const candidates = splitEmailCandidates(next)
                            const invalid = candidates.find((item) => item.includes("@") && !isValidEmailFormat(item))
                            setInvalidHint(invalid ? `Format email tidak valid: ${invalid}` : null)
                        } else {
                            setInvalidHint(null)
                        }
                    }}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === "," || event.key === ";") {
                            event.preventDefault()
                            commitQuery()
                        }
                    }}
                    onBlur={() => commitQuery()}
                    placeholder={props.placeholder}
                    className="h-9 border-0 px-0 shadow-none focus-visible:ring-0"
                />
            </div>
            {invalidHint && <p className="text-xs text-destructive">{invalidHint}</p>}
            <p className="text-xs text-muted-foreground">Autocomplete AJAX aktif saat minimal 3 karakter. {value.length}/50 penerima.</p>
            {openSuggestion && query.trim().length >= 3 && (
                <div className="rounded-md border bg-background shadow-sm max-h-44 overflow-auto">
                    {loading && <div className="px-3 py-2 text-xs text-muted-foreground">Mencari email…</div>}
                    {!loading && suggestions.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">Tidak ada hasil.</div>}
                    {!loading && suggestions.map((item) => (
                        <button
                            type="button"
                            key={item.id}
                            className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
                            onMouseDown={(event) => {
                                event.preventDefault()
                                addCandidates([item.email])
                                setQuery("")
                                setOpenSuggestion(false)
                            }}
                        >
                            <p className="font-medium">{item.email}</p>
                            <p className="text-xs text-muted-foreground">{item.name ?? "-"} {item.role ? `• ${item.role}` : ""}</p>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

function RuleEditorDialog(props: {
    open: boolean
    onOpenChange: (v: boolean) => void
    templates: Template[]
    initial?: Rule | null
    onSaved: (next: Rule, isNew: boolean) => void
}) {
    const { open, onOpenChange, templates, initial, onSaved } = props
    const [forms, setForms] = useState<Array<{ formKey: string; formName: string; modulePath: string }>>([])
    const [fieldMeta, setFieldMeta] = useState<FieldMeta[]>([])
    const [isLoadingForms, setIsLoadingForms] = useState(false)
    const [isLoadingFields, setIsLoadingFields] = useState(false)
    const [showOptionalGeneral, setShowOptionalGeneral] = useState(false)
    const [showOptionalAttachment, setShowOptionalAttachment] = useState(false)

    const form = useForm<RuleFormValues>({
        defaultValues: {
            name: "",
            formKey: "",
            combinator: "AND",
            templateId: "",
            toEmails: [],
            ccEmails: [],
            isActive: true,
            conditions: [],
            options: {
                priority: "normal",
                scheduleType: "immediate",
                scheduleValue: "",
                includeAttachments: false,
                attachmentMode: "none",
                allowedFileTypes: [],
                maxAttachmentMb: 10,
                replyTo: "",
                subjectPrefix: "",
            },
        },
    })

    useEffect(() => {
        if (!open) return
        const rawOptions = (initial?.options ?? {}) as RuleFormValues["options"]
        form.reset({
            name: initial?.name ?? "",
            formKey: initial?.formKey ?? "",
            combinator: initial?.combinator === "OR" ? "OR" : "AND",
            templateId: initial?.templateId ?? "",
            toEmails: normalizeRecipientList((initial?.toEmails as string[] | null) ?? [], 50),
            ccEmails: normalizeRecipientList((initial?.ccEmails as string[] | null) ?? [], 50),
            isActive: initial?.isActive ?? true,
            conditions: Array.isArray(initial?.conditions) ? (initial!.conditions as RuleFormValues["conditions"]) : [],
            options: {
                priority: rawOptions.priority ?? "normal",
                scheduleType: rawOptions.scheduleType ?? "immediate",
                scheduleValue: rawOptions.scheduleValue ?? "",
                includeAttachments: rawOptions.includeAttachments ?? false,
                attachmentMode: rawOptions.attachmentMode ?? "none",
                allowedFileTypes: rawOptions.allowedFileTypes ?? [],
                maxAttachmentMb: rawOptions.maxAttachmentMb ?? 10,
                replyTo: rawOptions.replyTo ?? "",
                subjectPrefix: rawOptions.subjectPrefix ?? "",
            },
        })
    }, [open, initial, form])

    useEffect(() => {
        if (!open) return
        let cancelled = false
        setIsLoadingForms(true)
        Promise.all([getWebsiteFormOptions(), getApprovalFormRegistry()])
            .then(([websiteRows, registryRows]) => {
                if (cancelled) return
                const merged = new Map<string, { formKey: string; formName: string; modulePath: string }>()
                ;(websiteRows as WebsiteFormOption[]).forEach((entry) => {
                    if (!entry.formKey || !entry.formName || !entry.modulePath) return
                    merged.set(entry.formKey, entry)
                })
                ;(registryRows as RegistryFormOption[]).forEach((entry) => {
                    if (!entry.formKey || !entry.formName || !entry.modulePath) return
                    if (merged.has(entry.formKey)) return
                    merged.set(entry.formKey, { formKey: entry.formKey, formName: entry.formName, modulePath: entry.modulePath })
                })
                setForms(Array.from(merged.values()).sort((a, b) => a.formName.localeCompare(b.formName)))
            })
            .catch((error) => {
                toast.error(error instanceof Error ? error.message : "Gagal memuat daftar form")
            })
            .finally(() => {
                if (!cancelled) setIsLoadingForms(false)
            })

        return () => { cancelled = true }
    }, [open])

    const selectedFormKey = form.watch("formKey")

    useEffect(() => {
        if (!open) return
        const selected = forms.find((entry) => entry.formKey === selectedFormKey)
        if (!selected) {
            setFieldMeta([])
            return
        }
        let cancelled = false
        setIsLoadingFields(true)
        getWebsiteFormFieldOptions(selected.modulePath)
            .then(async (res) => {
                if (cancelled) return
                if (res.success && (res.fieldMeta?.length ?? 0) > 0) {
                    setFieldMeta((res.fieldMeta as FieldMeta[]) ?? [])
                    return
                }
                const fallback = await getApprovalFormFieldOptions(selected.formKey)
                if (!fallback.success) {
                    setFieldMeta([])
                    return
                }
                setFieldMeta((fallback.fieldMeta as FieldMeta[]) ?? [])
            })
            .catch(() => setFieldMeta([]))
            .finally(() => {
                if (!cancelled) setIsLoadingFields(false)
            })
        return () => { cancelled = true }
    }, [open, selectedFormKey, forms])

    const fieldMetaMap = useMemo(() => new Map(fieldMeta.map((f) => [f.key, f])), [fieldMeta])
    const templateMap = useMemo(() => new Map(templates.map((t) => [t.id, t])), [templates])

    const addCondition = () => {
        const first = fieldMeta[0]
        const dt = first?.dataType ?? "string"
        const operator = COMPARISON_OPTIONS[dt][0]?.value ?? "eq"
        const next = [...(form.getValues("conditions") ?? [])]
        next.push({ id: randomId(), fieldKey: first?.key ?? "", operator, value: "", dataType: dt })
        form.setValue("conditions", next, { shouldDirty: true })
    }

    const removeCondition = (id: string) => {
        form.setValue("conditions", (form.getValues("conditions") ?? []).filter((item) => item.id !== id), { shouldDirty: true })
    }

    const conditionErrors = validateConditionDrafts(form.watch("conditions") ?? [])

    const onSubmit = async (values: RuleFormValues) => {
        const normalizedValues = {
            ...values,
            toEmails: normalizeRecipientList(values.toEmails, 50),
            ccEmails: normalizeRecipientList(values.ccEmails, 50),
            conditions: values.conditions.map((c) => ({
                ...c,
                dataType: (c.dataType ?? fieldMetaMap.get(c.fieldKey)?.dataType ?? "string") as FieldMeta["dataType"],
                value: typeof c.value === "string" ? c.value : (c.value ?? null),
            })),
            options: {
                ...values.options,
                scheduleValue: values.options.scheduleValue?.trim() || null,
                replyTo: values.options.replyTo?.trim() || null,
                subjectPrefix: values.options.subjectPrefix?.trim() || null,
                allowedFileTypes: normalizeRecipientList(values.options.allowedFileTypes ?? [], 20),
            },
        }

        const parsed = ruleSchema.safeParse(normalizedValues)
        if (!parsed.success) {
            const firstError = parsed.error.issues[0]?.message ?? "Data rule tidak valid"
            toast.error(firstError)
            return
        }

        if (conditionErrors.length > 0) {
            toast.error(conditionErrors[0])
            return
        }

        if (initial?.id) {
            const res = await updateEmailNotificationRule(initial.id, normalizedValues)
            if (res.success) {
                onSaved({ ...(initial as Rule), ...normalizedValues, updatedAt: new Date() } as Rule, false)
                toast.success("Rule diperbarui")
                onOpenChange(false)
                return
            }
            toast.error(res.error ?? "Gagal memperbarui rule")
            return
        }

        const res = await createEmailNotificationRule(normalizedValues)
        if (res.success && res.rule) {
            onSaved(res.rule as Rule, true)
            toast.success("Rule dibuat")
            onOpenChange(false)
            return
        }
        toast.error(res.error ?? "Gagal membuat rule")
    }

    const conditions = form.watch("conditions") ?? []

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[96vw] max-w-[1320px] max-h-[92vh] overflow-hidden p-0">
                <div className="p-6 pb-4 border-b">
                    <DialogHeader>
                        <DialogTitle className="text-2xl leading-8">{initial?.id ? "Edit Rule Notifikasi" : "Buat Rule Notifikasi"}</DialogTitle>
                        <DialogDescription className="text-base leading-7">
                            Tata letak dioptimalkan untuk desktop/tablet tanpa horizontal scroll. Atur konfigurasi di tab Umum, Kondisi, dan Lampiran.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="h-[calc(92vh-98px)] overflow-hidden">
                        <Tabs defaultValue="umum" className="h-full flex flex-col">
                            <div className="px-6 pt-4">
                                <TabsList className="grid grid-cols-3 w-full max-w-xl">
                                    <TabsTrigger value="umum">Umum</TabsTrigger>
                                    <TabsTrigger value="kondisi">Kondisi</TabsTrigger>
                                    <TabsTrigger value="lampiran">Lampiran</TabsTrigger>
                                </TabsList>
                            </div>

                            <TabsContent value="umum" className="flex-1 mt-0 px-6 pb-6 overflow-auto">
                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 text-[14px] leading-6">
                                    <FormField control={form.control} name="name" render={({ field }) => (
                                        <FormItem>
                                            <Label className="text-sm">Nama Rule</Label>
                                            <FormControl><Input {...field} className="h-11 text-base" placeholder="Contoh: Notif Status Baru" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />

                                    <FormField control={form.control} name="formKey" render={({ field }) => (
                                        <FormItem>
                                            <Label className="text-sm">Form Sistem</Label>
                                            <Select value={field.value} onValueChange={(value) => { field.onChange(value); form.setValue("conditions", [], { shouldDirty: true }) }}>
                                                <FormControl><SelectTrigger className="h-11 text-base"><SelectValue placeholder={isLoadingForms ? "Memuat form..." : "Pilih form"} /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    {forms.map((entry) => <SelectItem key={entry.formKey} value={entry.formKey}>{entry.formName}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                            <p className="text-xs text-muted-foreground">{forms.length} form terdeteksi dari sistem.</p>
                                            <FormMessage />
                                        </FormItem>
                                    )} />

                                    <FormField control={form.control} name="templateId" render={({ field }) => (
                                        <FormItem>
                                            <Label className="text-sm">Template Email</Label>
                                            <Select value={field.value} onValueChange={field.onChange}>
                                                <FormControl><SelectTrigger className="h-11 text-base"><SelectValue placeholder="Pilih template" /></SelectTrigger></FormControl>
                                                <SelectContent>{templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                                            </Select>
                                            {field.value && templateMap.get(field.value) && <p className="text-xs text-muted-foreground">Subject: {templateMap.get(field.value)?.subject}</p>}
                                            <FormMessage />
                                        </FormItem>
                                    )} />

                                    <FormField control={form.control} name="options.priority" render={({ field }) => (
                                        <FormItem>
                                            <Label className="text-sm">Prioritas</Label>
                                            <Select value={field.value} onValueChange={field.onChange}>
                                                <FormControl><SelectTrigger className="h-11"><SelectValue /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="low">Low</SelectItem>
                                                    <SelectItem value="normal">Normal</SelectItem>
                                                    <SelectItem value="high">High</SelectItem>
                                                    <SelectItem value="urgent">Urgent</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />

                                    <FormField control={form.control} name="toEmails" render={({ field }) => (
                                        <FormItem><FormControl><EmailRecipientMultiSelect label="To" value={field.value} onChange={field.onChange} placeholder="Ketik email / nama user..." /></FormControl><FormMessage /></FormItem>
                                    )} />

                                    <FormField control={form.control} name="ccEmails" render={({ field }) => (
                                        <FormItem><FormControl><EmailRecipientMultiSelect label="CC" value={field.value} onChange={field.onChange} placeholder="Ketik email / nama user..." /></FormControl><FormMessage /></FormItem>
                                    )} />

                                    <FormField control={form.control} name="options.scheduleType" render={({ field }) => (
                                        <FormItem>
                                            <Label className="text-sm">Schedule</Label>
                                            <Select value={field.value} onValueChange={field.onChange}>
                                                <FormControl><SelectTrigger className="h-11"><SelectValue /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="immediate">Immediate</SelectItem>
                                                    <SelectItem value="daily">Daily</SelectItem>
                                                    <SelectItem value="weekly">Weekly</SelectItem>
                                                    <SelectItem value="custom_cron">Custom Cron</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />

                                    <FormField control={form.control} name="options.scheduleValue" render={({ field }) => (
                                        <FormItem>
                                            <Label className="text-sm">Nilai Schedule</Label>
                                            <FormControl><Input {...field} value={field.value ?? ""} className="h-11" placeholder="Contoh: 08:00 atau 0 8 * * *" /></FormControl>
                                            <p className="text-xs text-muted-foreground">Isi jika schedule daily/weekly/custom cron.</p>
                                            <FormMessage />
                                        </FormItem>
                                    )} />

                                    <FormField control={form.control} name="isActive" render={({ field }) => (
                                        <FormItem className="flex items-center justify-between rounded-lg border p-4">
                                            <Label className="text-base">Aktif</Label>
                                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                        </FormItem>
                                    )} />
                                </div>

                                <Collapsible open={showOptionalGeneral} onOpenChange={setShowOptionalGeneral} className="mt-5 rounded-lg border p-4">
                                    <CollapsibleTrigger asChild>
                                        <Button type="button" variant="ghost" className="w-full justify-between px-0">
                                            Field Opsional
                                            <ChevronsUpDown className="h-4 w-4" />
                                        </Button>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="mt-3 grid grid-cols-1 xl:grid-cols-2 gap-4">
                                        <FormField control={form.control} name="options.replyTo" render={({ field }) => (
                                            <FormItem>
                                                <Label className="text-sm">Reply-To</Label>
                                                <FormControl><Input {...field} value={field.value ?? ""} className="h-10" placeholder="reply@company.com" /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField control={form.control} name="options.subjectPrefix" render={({ field }) => (
                                            <FormItem>
                                                <Label className="text-sm">Subject Prefix</Label>
                                                <FormControl><Input {...field} value={field.value ?? ""} className="h-10" placeholder="[PENTING]" /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                    </CollapsibleContent>
                                </Collapsible>
                            </TabsContent>

                            <TabsContent value="kondisi" className="flex-1 mt-0 px-6 pb-6 overflow-auto">
                                <div className="space-y-4 text-[14px] leading-6">
                                    <div className="flex flex-wrap items-end gap-3">
                                        <FormField control={form.control} name="combinator" render={({ field }) => (
                                            <FormItem className="w-[180px]">
                                                <Label className="text-sm">Operator Kondisi</Label>
                                                <Select value={field.value} onValueChange={field.onChange}>
                                                    <FormControl><SelectTrigger className="h-11"><SelectValue /></SelectTrigger></FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="AND">AND</SelectItem>
                                                        <SelectItem value="OR">OR</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <Button type="button" size="lg" variant="secondary" onClick={addCondition} disabled={fieldMeta.length === 0 || isLoadingFields}>
                                            <Plus className="h-4 w-4 mr-2" />
                                            Tambah Kondisi
                                        </Button>
                                        <div className="text-sm text-muted-foreground">
                                            {isLoadingFields ? "Memuat field…" : `${fieldMeta.length} field tersedia`}
                                        </div>
                                    </div>

                                    <div className="rounded-lg border p-4 min-h-[240px] text-[14px] leading-[1.5]">
                                        <div className="flex items-center gap-2 mb-3">
                                            <p className="font-semibold">Daftar Kondisi</p>
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <button type="button" className="text-muted-foreground"><HelpCircle className="h-4 w-4" /></button>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top">Klik untuk detail konfigurasi kondisi</TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </div>
                                        <p className="text-xs text-muted-foreground mb-3">Contoh sintaks valid: Status = Baru, Total &gt; 1000000, Department LIKE Finance.</p>
                                        <ScrollArea className="h-[340px] pr-2">
                                            <div className="space-y-3">
                                                {conditions.map((condition, index) => {
                                                    const dt = (condition.dataType ?? fieldMetaMap.get(condition.fieldKey)?.dataType ?? "string") as FieldMeta["dataType"]
                                                    const ops = COMPARISON_OPTIONS[dt]
                                                    const needsValue = ops.find((item) => item.value === condition.operator)?.needsValue ?? true
                                                    return (
                                                        <div key={condition.id} className="rounded-md border p-3">
                                                            <div className="flex justify-between items-center mb-2">
                                                                <p className="font-medium">Kondisi #{index + 1}</p>
                                                                <Button type="button" variant="ghost" size="sm" onClick={() => removeCondition(condition.id)}>Hapus</Button>
                                                            </div>
                                                            <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr_1fr] gap-2">
                                                                <div>
                                                                    <Label className="text-xs text-muted-foreground">Field</Label>
                                                                    <Select value={condition.fieldKey} onValueChange={(value) => {
                                                                        const meta = fieldMetaMap.get(value)
                                                                        const dataType = meta?.dataType ?? "string"
                                                                        const nextOperator = COMPARISON_OPTIONS[dataType][0]?.value ?? "eq"
                                                                        const next = [...(form.getValues("conditions") ?? [])]
                                                                        next[index] = { ...next[index], fieldKey: value, dataType, operator: nextOperator, value: "" }
                                                                        form.setValue("conditions", next, { shouldDirty: true })
                                                                    }}>
                                                                        <SelectTrigger className="h-10"><SelectValue placeholder="Pilih field" /></SelectTrigger>
                                                                        <SelectContent>{fieldMeta.map((meta) => <SelectItem key={meta.key} value={meta.key}>{meta.key}</SelectItem>)}</SelectContent>
                                                                    </Select>
                                                                </div>
                                                                <div>
                                                                    <Label className="text-xs text-muted-foreground">Operator</Label>
                                                                    <Select value={condition.operator} onValueChange={(value) => {
                                                                        const next = [...(form.getValues("conditions") ?? [])]
                                                                        next[index] = { ...next[index], operator: value }
                                                                        form.setValue("conditions", next, { shouldDirty: true })
                                                                    }}>
                                                                        <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                                                                        <SelectContent>{ops.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                                                                    </Select>
                                                                </div>
                                                                <div>
                                                                    <Label className="text-xs text-muted-foreground">Nilai</Label>
                                                                    <Input
                                                                        value={condition.value ?? ""}
                                                                        onChange={(event) => {
                                                                            const next = [...(form.getValues("conditions") ?? [])]
                                                                            next[index] = { ...next[index], value: event.target.value }
                                                                            form.setValue("conditions", next, { shouldDirty: true })
                                                                        }}
                                                                        disabled={!needsValue}
                                                                        className="h-10"
                                                                        placeholder={needsValue ? "Masukkan nilai" : "Operator tidak butuh nilai"}
                                                                    />
                                                                </div>
                                                            </div>
                                                            <p className="text-xs text-muted-foreground mt-2">Tipe data: <span className="font-mono">{dt}</span></p>
                                                        </div>
                                                    )
                                                })}
                                                {conditions.length === 0 && <p className="text-sm text-muted-foreground text-center py-10">Belum ada kondisi. Jika kosong, rule dianggap terpenuhi.</p>}
                                            </div>
                                        </ScrollArea>
                                    </div>

                                    {conditionErrors.length > 0 && <p className="text-sm text-destructive">{conditionErrors[0]}</p>}
                                </div>
                            </TabsContent>

                            <TabsContent value="lampiran" className="flex-1 mt-0 px-6 pb-6 overflow-auto">
                                <div className="space-y-4 text-[14px] leading-6">
                                    <FormField control={form.control} name="options.includeAttachments" render={({ field }) => (
                                        <FormItem className="flex items-center justify-between rounded-lg border p-4">
                                            <Label className="text-base">Aktifkan Lampiran</Label>
                                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                        </FormItem>
                                    )} />

                                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                        <FormField control={form.control} name="options.attachmentMode" render={({ field }) => (
                                            <FormItem>
                                                <Label className="text-sm">Mode Lampiran</Label>
                                                <Select value={field.value} onValueChange={field.onChange}>
                                                    <FormControl><SelectTrigger className="h-11"><SelectValue /></SelectTrigger></FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="none">None</SelectItem>
                                                        <SelectItem value="all">All Attachment</SelectItem>
                                                        <SelectItem value="filtered">Filtered</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )} />

                                        <FormField control={form.control} name="options.maxAttachmentMb" render={({ field }) => (
                                            <FormItem>
                                                <Label className="text-sm">Maksimum Size (MB)</Label>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        min={1}
                                                        max={50}
                                                        className="h-11"
                                                        value={field.value}
                                                        onChange={(event) => field.onChange(Number(event.target.value || 10))}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                    </div>

                                    <Collapsible open={showOptionalAttachment} onOpenChange={setShowOptionalAttachment} className="rounded-lg border p-4">
                                        <CollapsibleTrigger asChild>
                                            <Button type="button" variant="ghost" className="w-full justify-between px-0">
                                                Field Opsional Lampiran
                                                <ChevronsUpDown className="h-4 w-4" />
                                            </Button>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent className="mt-3 space-y-2">
                                            <FormField control={form.control} name="options.allowedFileTypes" render={({ field }) => (
                                                <FormItem>
                                                    <Label className="text-sm">Allowed File Types</Label>
                                                    <FormControl>
                                                        <Input
                                                            className="h-10"
                                                            placeholder="pdf, xlsx, csv"
                                                            value={(field.value ?? []).join(", ")}
                                                            onChange={(event) => field.onChange(event.target.value.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean))}
                                                        />
                                                    </FormControl>
                                                    <p className="text-xs text-muted-foreground">Pisahkan dengan koma. Contoh: pdf, xlsx, csv</p>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                        </CollapsibleContent>
                                    </Collapsible>
                                </div>
                            </TabsContent>
                        </Tabs>

                        <div className="border-t px-6 py-4 flex items-center justify-end gap-2">
                            <Button type="button" variant="outline" size="lg" onClick={() => onOpenChange(false)}>Batal</Button>
                            <Button type="submit" size="lg">Simpan</Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}

export function NotificationRules(props: {
    initialRules: Rule[]
    templates: Template[]
    recipientUsers: Array<{ id: string; name: string; email: string; role: string }>
    recipientRoles: string[]
}) {
    const { initialRules, templates } = props
    const [rules, setRules] = useState<Rule[]>(initialRules)
    const [editorOpen, setEditorOpen] = useState(false)
    const [editingRule, setEditingRule] = useState<Rule | null>(null)
    const [logsOpen, setLogsOpen] = useState(false)
    const [logs, setLogs] = useState<LogRow[]>([])
    const [logsLoading, setLogsLoading] = useState(false)

    const templateNameById = useMemo(() => new Map(templates.map((t) => [t.id, t.name])), [templates])

    async function handleToggle(id: string, isActive: boolean) {
        const res = await toggleEmailNotificationRule(id, isActive)
        if (!res.success) {
            toast.error(res.error ?? "Gagal mengubah status rule")
            return
        }
        setRules((prev) => prev.map((row) => row.id === id ? { ...row, isActive } : row))
    }

    async function handleDelete(id: string) {
        if (!confirm("Hapus rule ini?")) return
        const res = await deleteEmailNotificationRule(id)
        if (!res.success) {
            toast.error(res.error ?? "Gagal menghapus rule")
            return
        }
        setRules((prev) => prev.filter((row) => row.id !== id))
        toast.success("Rule dihapus")
    }

    async function handleOpenLogs(ruleId: string) {
        setLogsOpen(true)
        setLogs([])
        setLogsLoading(true)
        try {
            const rows = await getEmailNotificationRuleLogs(ruleId, 200)
            setLogs(rows as LogRow[])
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Gagal memuat logs")
        } finally {
            setLogsLoading(false)
        }
    }

    const onSaved = (next: Rule, isNew: boolean) => {
        setRules((prev) => isNew ? [...prev, next] : prev.map((row) => row.id === next.id ? next : row))
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="flex items-center gap-2">
                        <Bell className="h-5 w-5 text-primary" />
                        Notification Rules
                    </CardTitle>
                    <CardDescription>Buat aturan notifikasi email berbasis conditional logic dari seluruh form sistem.</CardDescription>
                </div>
                <Button size="sm" className="gap-2" onClick={() => { setEditingRule(null); setEditorOpen(true) }}>
                    <Plus className="h-4 w-4" />
                    New Rule
                </Button>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nama</TableHead>
                                <TableHead>Form</TableHead>
                                <TableHead>Operator</TableHead>
                                <TableHead>Kondisi</TableHead>
                                <TableHead>Template</TableHead>
                                <TableHead>To</TableHead>
                                <TableHead>Aktif</TableHead>
                                <TableHead className="w-12" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rules.map((row) => (
                                <TableRow key={row.id}>
                                    <TableCell className="font-medium">{row.name}</TableCell>
                                    <TableCell className="font-mono text-xs">{row.formKey}</TableCell>
                                    <TableCell><Badge variant="secondary">{row.combinator}</Badge></TableCell>
                                    <TableCell className="text-sm">{Array.isArray(row.conditions) ? (row.conditions as unknown[]).length : 0}</TableCell>
                                    <TableCell className="text-sm">{templateNameById.get(row.templateId) ?? row.templateId}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground max-w-[220px] truncate">
                                        {Array.isArray(row.toEmails) && (row.toEmails as string[]).length > 0 ? (row.toEmails as string[]).join(", ") : "—"}
                                    </TableCell>
                                    <TableCell><Switch checked={row.isActive} onCheckedChange={(checked) => handleToggle(row.id, checked)} /></TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => { setEditingRule(row); setEditorOpen(true) }} className="gap-2"><Pencil className="h-4 w-4" />Edit</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleOpenLogs(row.id)} className="gap-2"><History className="h-4 w-4" />Logs</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleDelete(row.id)} className="gap-2 text-destructive focus:text-destructive"><Trash2 className="h-4 w-4" />Delete</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {rules.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-10">Belum ada rule.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                <RuleEditorDialog open={editorOpen} onOpenChange={setEditorOpen} templates={templates} initial={editingRule} onSaved={onSaved} />
                <RuleLogsDialog open={logsOpen} onOpenChange={setLogsOpen} logs={logsLoading ? [] : logs} />
            </CardContent>
        </Card>
    )
}
