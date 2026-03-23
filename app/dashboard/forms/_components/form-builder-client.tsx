"use client"

import { useMemo, useState, useTransition } from "react"
import { format } from "date-fns"
import {
    BarChart3,
    Copy,
    CopyPlus,
    Download,
    Edit3,
    Eye,
    FileBarChart,
    Filter,
    Globe,
    Loader2,
    Plus,
    Save,
    Search,
    Settings2,
    Sparkles,
    Trash2,
} from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { toast } from "sonner"

import {
    createSurveyForm,
    createSurveyFormFromTemplate,
    deleteSurveyForm,
    duplicateSurveyForm,
    exportSurveyResponsesCsv,
    getSurveyAnalytics,
    getSurveyFormById,
    saveSurveyForm,
} from "@/app/actions/forms-surveys"
import { FormRenderer } from "@/components/forms/form-renderer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
    fieldSupportsOptions,
    fieldSupportsPlaceholder,
    formTemplates,
    slugifyFormTitle,
    type FormBuilderSchema,
    type FormFieldDefinition,
    type FormFieldType,
    type FormKind,
    type FormStatus,
} from "@/lib/forms-surveys"

type FormSummary = {
    id: string
    title: string
    slug: string
    description: string | null
    kind: FormKind
    status: FormStatus
    isPublished: boolean
    updatedAt: Date
    publishedAt: Date | null
    responseCount: number | string
}

type FormDetail = {
    id: string
    title: string
    slug: string
    description: string | null
    kind: FormKind
    status: FormStatus
    isPublished: boolean
    schema: FormBuilderSchema
}

type FormAnalytics = {
    totalResponses: number
    publishedAt: Date | null
    completionRate: number
    choiceBreakdown: { fieldId: string; label: string; data: { name: string; total: number }[] }[]
    recentResponses: {
        id: string
        submittedAt: Date
        respondentName: string | null
        respondentEmail: string | null
        answers: Record<string, unknown>
    }[]
}

const fieldTemplates: Array<{ type: FormFieldType; label: string }> = [
    { type: "short-text", label: "Short Text" },
    { type: "long-text", label: "Paragraph" },
    { type: "email", label: "Email" },
    { type: "number", label: "Number" },
    { type: "select", label: "Dropdown" },
    { type: "radio", label: "Single Choice" },
    { type: "checkbox", label: "Multiple Choice" },
    { type: "rating", label: "Rating" },
]

function makeField(type: FormFieldType): FormFieldDefinition {
    const base: FormFieldDefinition = {
        id: crypto.randomUUID(),
        type,
        label: "New Question",
        description: "",
        placeholder: "",
        required: false,
    }

    if (fieldSupportsOptions(type)) {
        base.options = [
            { id: crypto.randomUUID(), label: "Option 1", value: "option-1" },
            { id: crypto.randomUUID(), label: "Option 2", value: "option-2" },
        ]
    }

    return base
}

export function FormBuilderClient({
    initialForms,
    initialSelectedForm,
    initialAnalytics,
}: {
    initialForms: FormSummary[]
    initialSelectedForm: FormDetail | null
    initialAnalytics: FormAnalytics | null
}) {
    const [forms, setForms] = useState(initialForms)
    const [selectedFormId, setSelectedFormId] = useState(initialSelectedForm?.id ?? null)
    const [draft, setDraft] = useState<FormDetail | null>(initialSelectedForm)
    const [analytics, setAnalytics] = useState<FormAnalytics | null>(initialAnalytics)
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState<"all" | FormStatus>("all")
    const [isPending, startTransition] = useTransition()

    const publicPath = draft ? `/forms/${draft.slug}` : ""

    const filteredForms = useMemo(() => {
        return forms.filter((form) => {
            const matchesSearch =
                search === ""
                || form.title.toLowerCase().includes(search.toLowerCase())
                || (form.description ?? "").toLowerCase().includes(search.toLowerCase())
            const matchesStatus = statusFilter === "all" || form.status === statusFilter
            return matchesSearch && matchesStatus
        })
    }, [forms, search, statusFilter])

    const refreshSelection = (id: string) => {
        startTransition(async () => {
            const [formDetail, analyticsDetail] = await Promise.all([getSurveyFormById(id), getSurveyAnalytics(id)])
            setSelectedFormId(id)
            setDraft(formDetail as FormDetail | null)
            setAnalytics(analyticsDetail as FormAnalytics | null)
        })
    }

    const selectCreatedForm = (created: FormDetail & { updatedAt?: Date; publishedAt?: Date | null }) => {
        setForms((current) => [
            {
                id: created.id,
                title: created.title,
                slug: created.slug,
                description: created.description ?? "",
                kind: created.kind,
                status: created.status,
                isPublished: created.isPublished,
                updatedAt: created.updatedAt ?? new Date(),
                publishedAt: created.publishedAt ?? null,
                responseCount: 0,
            },
            ...current,
        ])
        setDraft(created)
        setSelectedFormId(created.id)
        setAnalytics({
            totalResponses: 0,
            publishedAt: null,
            completionRate: 0,
            choiceBreakdown: [],
            recentResponses: [],
        })
    }

    const updateDraft = (patch: Partial<FormDetail>) => {
        setDraft((current) => (current ? { ...current, ...patch } : current))
    }

    const updateSchema = (updater: (schema: FormBuilderSchema) => FormBuilderSchema) => {
        setDraft((current) => (current ? { ...current, schema: updater(current.schema) } : current))
    }

    const handleCreateScratch = () => {
        startTransition(async () => {
            try {
                const created = (await createSurveyForm()) as FormDetail & { updatedAt?: Date; publishedAt?: Date | null }
                selectCreatedForm(created)
                toast.success("Form baru dari scratch berhasil dibuat")
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Gagal membuat form")
            }
        })
    }

    const handleCreateFromTemplate = (templateKey: "feedback" | "registration" | "event-rsvp") => {
        startTransition(async () => {
            try {
                const created = (await createSurveyFormFromTemplate(templateKey)) as FormDetail & {
                    updatedAt?: Date
                    publishedAt?: Date | null
                }
                selectCreatedForm(created)
                toast.success("Form dari template berhasil dibuat")
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Gagal membuat template")
            }
        })
    }

    const handleSave = (nextStatus?: FormStatus) => {
        if (!draft) {
            return
        }

        const payload = {
            ...draft,
            status: nextStatus ?? draft.status,
            slug: slugifyFormTitle(draft.slug || draft.title),
            description: draft.description ?? undefined,
        }

        startTransition(async () => {
            try {
                const saved = (await saveSurveyForm(payload)) as FormDetail & { updatedAt?: Date; publishedAt?: Date | null }
                setDraft(saved)
                setForms((current) =>
                    current.map((item) =>
                        item.id === saved.id
                            ? {
                                ...item,
                                title: saved.title,
                                slug: saved.slug,
                                description: saved.description ?? "",
                                kind: saved.kind,
                                status: saved.status,
                                isPublished: saved.isPublished,
                                updatedAt: saved.updatedAt ?? new Date(),
                                publishedAt: saved.publishedAt ?? null,
                            }
                            : item,
                    ),
                )
                toast.success(saved.status === "published" ? "Form berhasil dipublish" : "Form berhasil disimpan")
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Gagal menyimpan form")
            }
        })
    }

    const handleDelete = (target?: { id: string; title: string }) => {
        const active = target ?? (draft ? { id: draft.id, title: draft.title } : null)
        if (!active) {
            return
        }

        if (!window.confirm(`Hapus form "${active.title}"?`)) {
            return
        }

        startTransition(async () => {
            try {
                await deleteSurveyForm(active.id)
                const remaining = forms.filter((item) => item.id !== active.id)
                setForms(remaining)

                if (selectedFormId === active.id) {
                    if (remaining[0]) {
                        refreshSelection(remaining[0].id)
                    } else {
                        setDraft(null)
                        setSelectedFormId(null)
                        setAnalytics(null)
                    }
                }

                toast.success("Form berhasil dihapus")
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Gagal menghapus form")
            }
        })
    }

    const handleDuplicate = (target?: { id: string }) => {
        const activeId = target?.id ?? draft?.id
        if (!activeId) {
            return
        }

        startTransition(async () => {
            try {
                const created = (await duplicateSurveyForm(activeId)) as FormDetail & {
                    updatedAt?: Date
                    publishedAt?: Date | null
                }
                selectCreatedForm(created)
                toast.success("Form berhasil diduplikasi")
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Gagal menduplikasi form")
            }
        })
    }

    const handleExportCsv = () => {
        if (!draft) {
            return
        }

        startTransition(async () => {
            try {
                const result = await exportSurveyResponsesCsv(draft.id)
                const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" })
                const url = URL.createObjectURL(blob)
                const link = document.createElement("a")
                link.href = url
                link.download = result.fileName
                link.click()
                URL.revokeObjectURL(url)
                toast.success("CSV response berhasil diunduh")
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Gagal export response")
            }
        })
    }

    return (
        <div className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
                <Card className="overflow-hidden">
                    <CardHeader className="border-b bg-muted/30">
                        <CardTitle>Create New Form</CardTitle>
                        <CardDescription>Mulai dari scratch atau pakai template yang sudah siap edit.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 p-6">
                        <button
                            type="button"
                            onClick={handleCreateScratch}
                            className="w-full rounded-3xl border border-dashed p-5 text-left transition hover:border-primary/40 hover:bg-primary/5"
                        >
                            <div className="flex items-center gap-3">
                                <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                                    <Plus className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="font-semibold">Start From Scratch</p>
                                    <p className="text-sm text-muted-foreground">Buat form kosong dan susun semua field sendiri.</p>
                                </div>
                            </div>
                        </button>

                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm font-semibold">
                                <Sparkles className="h-4 w-4 text-primary" />
                                Templates
                            </div>
                            <div className="grid gap-3">
                                {formTemplates.map((template) => (
                                    <button
                                        key={template.key}
                                        type="button"
                                        onClick={() => handleCreateFromTemplate(template.key as "feedback" | "registration" | "event-rsvp")}
                                        className="rounded-2xl border p-4 text-left transition hover:border-primary/40 hover:bg-primary/5"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="font-semibold">{template.name}</p>
                                                <p className="mt-1 text-sm text-muted-foreground">{template.description}</p>
                                            </div>
                                            <Badge variant="outline">{template.kind}</Badge>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="overflow-hidden">
                    <CardHeader className="border-b bg-muted/30">
                        <CardTitle>List Form</CardTitle>
                        <CardDescription>Kelola form yang sudah ada secara terpisah: edit, duplicate, delete, dan pilih untuk dibuka.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 p-6">
                        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    className="pl-9"
                                    placeholder="Cari form atau deskripsi..."
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <Filter className="h-4 w-4 text-muted-foreground" />
                                <Select value={statusFilter} onValueChange={(value: "all" | FormStatus) => setStatusFilter(value)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Semua status</SelectItem>
                                        <SelectItem value="draft">Draft</SelectItem>
                                        <SelectItem value="published">Published</SelectItem>
                                        <SelectItem value="closed">Closed</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="overflow-x-auto rounded-2xl border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Title</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Responses</TableHead>
                                        <TableHead>Updated</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredForms.map((form) => (
                                        <TableRow key={form.id} data-state={selectedFormId === form.id ? "selected" : undefined}>
                                            <TableCell className="max-w-[280px] align-top">
                                                <div className="space-y-1">
                                                    <p className="font-semibold">{form.title}</p>
                                                    <p className="truncate text-xs text-muted-foreground">
                                                        {form.description || "Tanpa deskripsi"}
                                                    </p>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={form.status === "published" ? "default" : "secondary"}>{form.status}</Badge>
                                            </TableCell>
                                            <TableCell>{form.kind}</TableCell>
                                            <TableCell>{Number(form.responseCount)}</TableCell>
                                            <TableCell>{format(new Date(form.updatedAt), "dd MMM yyyy")}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button size="sm" variant="outline" onClick={() => refreshSelection(form.id)}>
                                                        <Edit3 className="mr-2 h-4 w-4" />
                                                        Edit
                                                    </Button>
                                                    <Button size="sm" variant="outline" onClick={() => handleDuplicate({ id: form.id })}>
                                                        <CopyPlus className="mr-2 h-4 w-4" />
                                                        Duplicate
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        onClick={() => handleDelete({ id: form.id, title: form.title })}
                                                    >
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        Delete
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {filteredForms.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                                                Belum ada form yang cocok dengan filter saat ini.
                                            </TableCell>
                                        </TableRow>
                                    ) : null}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {draft ? (
                <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription>Selected Form</CardDescription>
                                <CardTitle className="text-lg">{draft.title}</CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm text-muted-foreground">{draft.slug}</CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription>Status</CardDescription>
                                <CardTitle className="flex items-center gap-2 text-xl">
                                    <Globe className="h-5 w-5 text-primary" />
                                    {draft.status}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm text-muted-foreground">
                                {analytics?.publishedAt
                                    ? `Dipublish ${format(new Date(analytics.publishedAt), "dd MMM yyyy HH:mm")}`
                                    : "Belum dipublish"}
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription>Total Responses</CardDescription>
                                <CardTitle className="flex items-center gap-2 text-xl">
                                    <FileBarChart className="h-5 w-5 text-primary" />
                                    {analytics?.totalResponses ?? 0}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm text-muted-foreground">Live dari data masuk</CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription>Public Link</CardDescription>
                                <CardTitle className="text-base">{draft.slug}</CardTitle>
                            </CardHeader>
                            <CardContent className="flex gap-2">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => {
                                        navigator.clipboard.writeText(`${window.location.origin}${publicPath}`)
                                        toast.success("Link berhasil disalin")
                                    }}
                                >
                                    <Copy className="mr-2 h-4 w-4" />
                                    Copy
                                </Button>
                                <Button variant="outline" asChild>
                                    <a href={publicPath} target="_blank" rel="noreferrer">
                                        <Eye className="mr-2 h-4 w-4" />
                                        Open
                                    </a>
                                </Button>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription>Quick Actions</CardDescription>
                                <CardTitle className="text-base">Manage</CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-wrap gap-2">
                                <Button size="sm" variant="outline" onClick={() => handleDuplicate()} disabled={isPending}>
                                    <CopyPlus className="mr-2 h-4 w-4" />
                                    Duplicate
                                </Button>
                                <Button size="sm" variant="outline" onClick={handleExportCsv} disabled={isPending}>
                                    <Download className="mr-2 h-4 w-4" />
                                    CSV
                                </Button>
                            </CardContent>
                        </Card>
                    </div>

                    <Tabs defaultValue="builder" className="space-y-4">
                        <TabsList>
                            <TabsTrigger value="builder">
                                <Settings2 className="h-4 w-4" />
                                Builder
                            </TabsTrigger>
                            <TabsTrigger value="preview">
                                <Eye className="h-4 w-4" />
                                Preview
                            </TabsTrigger>
                            <TabsTrigger value="analytics">
                                <BarChart3 className="h-4 w-4" />
                                Analytics
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="builder" className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Form Setup</CardTitle>
                                    <CardDescription>Edit form yang dipilih dari List Form di atas.</CardDescription>
                                </CardHeader>
                                <CardContent className="grid gap-5 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label>Title</Label>
                                        <Input value={draft.title} onChange={(event) => updateDraft({ title: event.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Slug</Label>
                                        <Input
                                            value={draft.slug}
                                            onChange={(event) => updateDraft({ slug: slugifyFormTitle(event.target.value) })}
                                        />
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                        <Label>Description</Label>
                                        <Textarea
                                            rows={3}
                                            value={draft.description ?? ""}
                                            onChange={(event) => updateDraft({ description: event.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Type</Label>
                                        <Select value={draft.kind} onValueChange={(value: FormKind) => updateDraft({ kind: value })}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="form">Form</SelectItem>
                                                <SelectItem value="survey">Survey</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Accent Color</Label>
                                        <Input
                                            type="color"
                                            value={draft.schema.theme.accentColor}
                                            onChange={(event) =>
                                                updateSchema((schema) => ({
                                                    ...schema,
                                                    theme: { ...schema.theme, accentColor: event.target.value },
                                                }))
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Surface Color</Label>
                                        <Input
                                            type="color"
                                            value={draft.schema.theme.surfaceColor}
                                            onChange={(event) =>
                                                updateSchema((schema) => ({
                                                    ...schema,
                                                    theme: { ...schema.theme, surfaceColor: event.target.value },
                                                }))
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Text Color</Label>
                                        <Input
                                            type="color"
                                            value={draft.schema.theme.textColor}
                                            onChange={(event) =>
                                                updateSchema((schema) => ({
                                                    ...schema,
                                                    theme: { ...schema.theme, textColor: event.target.value },
                                                }))
                                            }
                                        />
                                    </div>
                                    <div className="flex items-center justify-between rounded-2xl border p-4">
                                        <div>
                                            <p className="font-medium">Collect Email</p>
                                            <p className="text-sm text-muted-foreground">Simpan email responden</p>
                                        </div>
                                        <Switch
                                            checked={draft.schema.settings.collectEmail}
                                            onCheckedChange={(checked) =>
                                                updateSchema((schema) => ({
                                                    ...schema,
                                                    settings: { ...schema.settings, collectEmail: checked },
                                                }))
                                            }
                                        />
                                    </div>
                                    <div className="flex items-center justify-between rounded-2xl border p-4">
                                        <div>
                                            <p className="font-medium">Multiple Submissions</p>
                                            <p className="text-sm text-muted-foreground">Izinkan submit berulang</p>
                                        </div>
                                        <Switch
                                            checked={draft.schema.settings.allowMultipleSubmissions}
                                            onCheckedChange={(checked) =>
                                                updateSchema((schema) => ({
                                                    ...schema,
                                                    settings: { ...schema.settings, allowMultipleSubmissions: checked },
                                                }))
                                            }
                                        />
                                    </div>
                                    <div className="flex items-center justify-between rounded-2xl border p-4">
                                        <div>
                                            <p className="font-medium">Show Progress</p>
                                            <p className="text-sm text-muted-foreground">Tampilkan progress pengisian</p>
                                        </div>
                                        <Switch
                                            checked={draft.schema.settings.showProgress}
                                            onCheckedChange={(checked) =>
                                                updateSchema((schema) => ({
                                                    ...schema,
                                                    settings: { ...schema.settings, showProgress: checked },
                                                }))
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                        <Label>Success Title</Label>
                                        <Input
                                            value={draft.schema.settings.successTitle}
                                            onChange={(event) =>
                                                updateSchema((schema) => ({
                                                    ...schema,
                                                    settings: { ...schema.settings, successTitle: event.target.value },
                                                }))
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                        <Label>Success Message</Label>
                                        <Textarea
                                            rows={3}
                                            value={draft.schema.settings.successMessage}
                                            onChange={(event) =>
                                                updateSchema((schema) => ({
                                                    ...schema,
                                                    settings: { ...schema.settings, successMessage: event.target.value },
                                                }))
                                            }
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Questions</CardTitle>
                                    <CardDescription>Tambahkan atau edit pertanyaan untuk form yang sedang dipilih.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="flex flex-wrap gap-2">
                                        {fieldTemplates.map((template) => (
                                            <Button
                                                key={template.type}
                                                type="button"
                                                variant="outline"
                                                onClick={() =>
                                                    updateSchema((schema) => ({
                                                        ...schema,
                                                        fields: [...schema.fields, makeField(template.type)],
                                                    }))
                                                }
                                            >
                                                <Plus className="mr-2 h-4 w-4" />
                                                {template.label}
                                            </Button>
                                        ))}
                                    </div>

                                    {draft.schema.fields.map((field, index) => (
                                        <div key={field.id} className="space-y-4 rounded-3xl border p-5">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-sm text-muted-foreground">Question {index + 1}</p>
                                                    <p className="font-semibold">{field.label || "New Question"}</p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        disabled={index === 0}
                                                        onClick={() =>
                                                            updateSchema((schema) => {
                                                                const fields = [...schema.fields]
                                                                ;[fields[index - 1], fields[index]] = [fields[index], fields[index - 1]]
                                                                return { ...schema, fields }
                                                            })
                                                        }
                                                    >
                                                        Up
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        disabled={index === draft.schema.fields.length - 1}
                                                        onClick={() =>
                                                            updateSchema((schema) => {
                                                                const fields = [...schema.fields]
                                                                ;[fields[index], fields[index + 1]] = [fields[index + 1], fields[index]]
                                                                return { ...schema, fields }
                                                            })
                                                        }
                                                    >
                                                        Down
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        onClick={() =>
                                                            updateSchema((schema) => ({
                                                                ...schema,
                                                                fields: schema.fields.filter((item) => item.id !== field.id),
                                                            }))
                                                        }
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="grid gap-4 md:grid-cols-2">
                                                <div className="space-y-2">
                                                    <Label>Question Label</Label>
                                                    <Input
                                                        value={field.label}
                                                        onChange={(event) =>
                                                            updateSchema((schema) => ({
                                                                ...schema,
                                                                fields: schema.fields.map((item) =>
                                                                    item.id === field.id ? { ...item, label: event.target.value } : item,
                                                                ),
                                                            }))
                                                        }
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Field Type</Label>
                                                    <Select
                                                        value={field.type}
                                                        onValueChange={(value: FormFieldType) =>
                                                            updateSchema((schema) => ({
                                                                ...schema,
                                                                fields: schema.fields.map((item) =>
                                                                    item.id === field.id
                                                                        ? {
                                                                            ...item,
                                                                            type: value,
                                                                            options: fieldSupportsOptions(value)
                                                                                ? item.options && item.options.length > 0
                                                                                    ? item.options
                                                                                    : [{
                                                                                        id: crypto.randomUUID(),
                                                                                        label: "Option 1",
                                                                                        value: "option-1",
                                                                                    }]
                                                                                : undefined,
                                                                        }
                                                                        : item,
                                                                ),
                                                            }))
                                                        }
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {fieldTemplates.map((template) => (
                                                                <SelectItem key={template.type} value={template.type}>
                                                                    {template.label}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2 md:col-span-2">
                                                    <Label>Description</Label>
                                                    <Textarea
                                                        rows={2}
                                                        value={field.description ?? ""}
                                                        onChange={(event) =>
                                                            updateSchema((schema) => ({
                                                                ...schema,
                                                                fields: schema.fields.map((item) =>
                                                                    item.id === field.id ? { ...item, description: event.target.value } : item,
                                                                ),
                                                            }))
                                                        }
                                                    />
                                                </div>
                                                {fieldSupportsPlaceholder(field.type) ? (
                                                    <div className="space-y-2 md:col-span-2">
                                                        <Label>Placeholder</Label>
                                                        <Input
                                                            value={field.placeholder ?? ""}
                                                            onChange={(event) =>
                                                                updateSchema((schema) => ({
                                                                    ...schema,
                                                                    fields: schema.fields.map((item) =>
                                                                        item.id === field.id ? { ...item, placeholder: event.target.value } : item,
                                                                    ),
                                                                }))
                                                            }
                                                        />
                                                    </div>
                                                ) : null}
                                                <div className="flex items-center justify-between rounded-2xl border p-4 md:col-span-2">
                                                    <div>
                                                        <p className="font-medium">Required</p>
                                                        <p className="text-sm text-muted-foreground">Wajib diisi responden</p>
                                                    </div>
                                                    <Switch
                                                        checked={field.required}
                                                        onCheckedChange={(checked) =>
                                                            updateSchema((schema) => ({
                                                                ...schema,
                                                                fields: schema.fields.map((item) =>
                                                                    item.id === field.id ? { ...item, required: checked } : item,
                                                                ),
                                                            }))
                                                        }
                                                    />
                                                </div>
                                            </div>

                                            {fieldSupportsOptions(field.type) ? (
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <Label>Options</Label>
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() =>
                                                                updateSchema((schema) => ({
                                                                    ...schema,
                                                                    fields: schema.fields.map((item) =>
                                                                        item.id === field.id
                                                                            ? {
                                                                                ...item,
                                                                                options: [
                                                                                    ...(item.options ?? []),
                                                                                    {
                                                                                        id: crypto.randomUUID(),
                                                                                        label: `Option ${(item.options?.length ?? 0) + 1}`,
                                                                                        value: `option-${(item.options?.length ?? 0) + 1}`,
                                                                                    },
                                                                                ],
                                                                            }
                                                                            : item,
                                                                    ),
                                                                }))
                                                            }
                                                        >
                                                            Add Option
                                                        </Button>
                                                    </div>
                                                    {(field.options ?? []).map((option) => (
                                                        <div key={option.id} className="flex gap-2">
                                                            <Input
                                                                value={option.label}
                                                                onChange={(event) =>
                                                                    updateSchema((schema) => ({
                                                                        ...schema,
                                                                        fields: schema.fields.map((item) =>
                                                                            item.id === field.id
                                                                                ? {
                                                                                    ...item,
                                                                                    options: (item.options ?? []).map((currentOption) =>
                                                                                        currentOption.id === option.id
                                                                                            ? {
                                                                                                ...currentOption,
                                                                                                label: event.target.value,
                                                                                                value: slugifyFormTitle(event.target.value),
                                                                                            }
                                                                                            : currentOption,
                                                                                    ),
                                                                                }
                                                                                : item,
                                                                        ),
                                                                    }))
                                                                }
                                                            />
                                                            <Button
                                                                type="button"
                                                                size="icon"
                                                                variant="ghost"
                                                                onClick={() =>
                                                                    updateSchema((schema) => ({
                                                                        ...schema,
                                                                        fields: schema.fields.map((item) =>
                                                                            item.id === field.id
                                                                                ? {
                                                                                    ...item,
                                                                                    options: (item.options ?? []).filter(
                                                                                        (currentOption) => currentOption.id !== option.id,
                                                                                    ),
                                                                                }
                                                                                : item,
                                                                        ),
                                                                    }))
                                                                }
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : null}
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>

                            <div className="flex flex-wrap gap-3">
                                <Button onClick={() => handleSave("draft")} disabled={isPending}>
                                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    Save Draft
                                </Button>
                                <Button onClick={() => handleSave("published")} disabled={isPending}>
                                    <Globe className="mr-2 h-4 w-4" />
                                    Publish Form
                                </Button>
                                {draft.status === "published" ? (
                                    <Button variant="outline" onClick={() => handleSave("closed")} disabled={isPending}>
                                        Close Form
                                    </Button>
                                ) : null}
                                {draft.status === "closed" ? (
                                    <Button variant="outline" onClick={() => handleSave("draft")} disabled={isPending}>
                                        Reopen Draft
                                    </Button>
                                ) : null}
                            </div>
                        </TabsContent>

                        <TabsContent value="preview">
                            <div className="mx-auto max-w-6xl">
                                <FormRenderer form={draft} mode="preview" />
                            </div>
                        </TabsContent>

                        <TabsContent value="analytics" className="space-y-6">
                            <div className="grid gap-4 md:grid-cols-2">
                                {(analytics?.choiceBreakdown ?? []).length === 0 ? (
                                    <Card className="md:col-span-2">
                                        <CardHeader>
                                            <CardTitle>Belum ada chart</CardTitle>
                                            <CardDescription>Grafik akan muncul saat form sudah menerima response.</CardDescription>
                                        </CardHeader>
                                    </Card>
                                ) : null}

                                {(analytics?.choiceBreakdown ?? []).map((chart) => (
                                    <Card key={chart.fieldId}>
                                        <CardHeader>
                                            <CardTitle className="text-base">{chart.label}</CardTitle>
                                            <CardDescription>Distribusi jawaban responden</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <ChartContainer
                                                className="h-[260px] w-full"
                                                config={{ total: { label: "Responses", color: "hsl(var(--primary))" } }}
                                            >
                                                <BarChart data={chart.data}>
                                                    <CartesianGrid vertical={false} />
                                                    <XAxis dataKey="name" tickLine={false} axisLine={false} />
                                                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                                                    <ChartTooltip content={<ChartTooltipContent />} />
                                                    <Bar dataKey="total" fill="var(--color-total)" radius={8} />
                                                </BarChart>
                                            </ChartContainer>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Recent Responses</CardTitle>
                                    <CardDescription>Jawaban terbaru dari form yang dipilih.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {(analytics?.recentResponses ?? []).length === 0 ? (
                                        <p className="text-sm text-muted-foreground">Belum ada jawaban yang masuk.</p>
                                    ) : null}

                                    {(analytics?.recentResponses ?? []).map((response) => (
                                        <div key={response.id} className="rounded-2xl border p-4">
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <div>
                                                    <p className="font-semibold">{response.respondentName || "Anonim"}</p>
                                                    <p className="text-sm text-muted-foreground">{response.respondentEmail || "Tanpa email"}</p>
                                                </div>
                                                <Badge variant="outline">
                                                    {format(new Date(response.submittedAt), "dd MMM yyyy HH:mm")}
                                                </Badge>
                                            </div>
                                            <div className="mt-4 grid gap-3 md:grid-cols-2">
                                                {draft.schema.fields.map((field) => (
                                                    <div key={field.id} className="rounded-xl bg-muted/40 p-3">
                                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{field.label}</p>
                                                        <p className="mt-1 text-sm font-medium">
                                                            {Array.isArray(response.answers[field.id])
                                                                ? (response.answers[field.id] as string[]).join(", ")
                                                                : String(response.answers[field.id] ?? "-")}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle>No Form Selected</CardTitle>
                        <CardDescription>Pilih form dari List Form atau buat yang baru dari panel Create New.</CardDescription>
                    </CardHeader>
                </Card>
            )}
        </div>
    )
}
