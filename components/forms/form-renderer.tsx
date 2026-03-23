"use client"

import { useState, useTransition } from "react"
import Image from "next/image"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { submitSurveyResponse } from "@/app/actions/forms-surveys"
import { uploadFile } from "@/app/actions/upload"
import { cn } from "@/lib/utils"
import { type FormBuilderSchema } from "@/lib/forms-surveys"

type RenderableForm = {
    id: string
    title: string
    description?: string | null
    schema: FormBuilderSchema
}

interface FormRendererProps {
    form: RenderableForm
    mode?: "public" | "preview"
}

export function FormRenderer({ form, mode = "public" }: FormRendererProps) {
    const [answers, setAnswers] = useState<Record<string, unknown>>({})
    const [respondentName, setRespondentName] = useState("")
    const [respondentEmail, setRespondentEmail] = useState("")
    const [submittedMessage, setSubmittedMessage] = useState<{ title: string; message: string } | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    const { fields, settings, theme } = form.schema
    const totalRequired = fields.filter((field) => field.required).length
    const completedRequired = fields.filter((field) => {
        if (!field.required) {
            return false
        }

        const value = answers[field.id]
        if (Array.isArray(value)) {
            return value.length > 0
        }

        return value !== undefined && value !== null && String(value).trim() !== ""
    }).length
    const progressValue = totalRequired > 0 ? (completedRequired / totalRequired) * 100 : 100

    const updateAnswer = (fieldId: string, value: unknown) => {
        setAnswers((current) => ({
            ...current,
            [fieldId]: value,
        }))
    }

    const toggleCheckbox = (fieldId: string, option: string, checked: boolean) => {
        const current = Array.isArray(answers[fieldId]) ? (answers[fieldId] as string[]) : []
        const next = checked ? [...current, option] : current.filter((item) => item !== option)
        updateAnswer(fieldId, next)
    }

    const handleUploadAnswerFile = (fieldId: string, file: File | null) => {
        if (!file) {
            return
        }

        setError(null)
        startTransition(async () => {
            try {
                const formData = new FormData()
                formData.append("file", file)
                const result = await uploadFile(formData)

                if (!result.success) {
                    throw new Error(result.error || "Upload file gagal")
                }

                updateAnswer(fieldId, result.url)
            } catch (uploadError) {
                setError(uploadError instanceof Error ? uploadError.message : "Upload file gagal")
            }
        })
    }

    const handleSubmit = () => {
        if (mode === "preview") {
            return
        }

        setError(null)

        startTransition(async () => {
            try {
                const result = await submitSurveyResponse({
                    formId: form.id,
                    respondentName,
                    respondentEmail,
                    answers,
                })
                setSubmittedMessage({
                    title: result.title,
                    message: result.message,
                })
            } catch (submitError) {
                setError(submitError instanceof Error ? submitError.message : "Gagal mengirim jawaban")
            }
        })
    }

    if (submittedMessage) {
        return (
            <Card className="overflow-hidden border-0 shadow-2xl">
                <div className="h-2 w-full" style={{ backgroundColor: theme.accentColor }} />
                <CardHeader>
                    <CardTitle>{submittedMessage.title}</CardTitle>
                    <CardDescription>{submittedMessage.message}</CardDescription>
                </CardHeader>
            </Card>
        )
    }

    return (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <Card
                className="overflow-hidden border-0 shadow-2xl bg-cover bg-center"
                style={{
                    backgroundColor: theme.surfaceColor,
                    color: theme.textColor,
                    backgroundImage: theme.backgroundImageUrl
                        ? `linear-gradient(rgba(255,255,255,0.88), rgba(255,255,255,0.92)), url(${theme.backgroundImageUrl})`
                        : undefined,
                }}
            >
                <div
                    className="relative px-6 py-8 md:px-8"
                    style={{
                        background: `linear-gradient(135deg, ${theme.accentColor}22 0%, ${theme.surfaceColor} 65%)`,
                    }}
                >
                    <div
                        className="absolute right-6 top-6 h-24 w-24 rounded-full blur-3xl"
                        style={{ backgroundColor: `${theme.accentColor}55` }}
                    />
                    <div
                        className="mb-4 h-2 w-28 rounded-full"
                        style={{ backgroundColor: theme.accentColor }}
                    />
                    <CardTitle className="text-3xl">{form.title}</CardTitle>
                    {form.description ? <CardDescription className="mt-3 max-w-2xl text-base">{form.description}</CardDescription> : null}
                    {theme.headerImageUrl ? (
                        <div className="relative mt-6 h-48 overflow-hidden rounded-3xl border">
                            <Image
                                src={theme.headerImageUrl}
                                alt="Form header"
                                fill
                                className="object-cover"
                            />
                        </div>
                    ) : null}
                </div>
                <CardHeader className="space-y-3">
                    {settings.showProgress ? (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm text-muted-foreground">
                                <span>Progress</span>
                                <span>{Math.round(progressValue)}%</span>
                            </div>
                            <Progress value={progressValue} />
                        </div>
                    ) : null}
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="respondent-name">Nama</Label>
                            <Input
                                id="respondent-name"
                                value={respondentName}
                                onChange={(event) => setRespondentName(event.target.value)}
                                placeholder="Nama lengkap"
                            />
                        </div>
                        {settings.collectEmail ? (
                            <div className="space-y-2">
                                <Label htmlFor="respondent-email">Email</Label>
                                <Input
                                    id="respondent-email"
                                    type="email"
                                    value={respondentEmail}
                                    onChange={(event) => setRespondentEmail(event.target.value)}
                                    placeholder="nama@email.com"
                                />
                            </div>
                        ) : null}
                    </div>

                    {fields.map((field, index) => (
                        <div key={field.id} className="space-y-3 rounded-2xl border p-4">
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-muted-foreground">Pertanyaan {index + 1}</p>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Label className="text-base font-semibold">{field.label}</Label>
                                    {field.required ? (
                                        <span
                                            className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                                            style={{ backgroundColor: theme.accentColor }}
                                        >
                                            Wajib
                                        </span>
                                    ) : null}
                                </div>
                                {field.description ? <p className="text-sm text-muted-foreground">{field.description}</p> : null}
                            </div>

                            {field.type === "short-text" ? (
                                <Input
                                    value={String(answers[field.id] ?? "")}
                                    onChange={(event) => updateAnswer(field.id, event.target.value)}
                                    placeholder={field.placeholder || "Tulis jawaban Anda"}
                                />
                            ) : null}

                            {field.type === "long-text" ? (
                                <Textarea
                                    value={String(answers[field.id] ?? "")}
                                    onChange={(event) => updateAnswer(field.id, event.target.value)}
                                    placeholder={field.placeholder || "Tulis jawaban Anda"}
                                    rows={5}
                                />
                            ) : null}

                            {field.type === "email" ? (
                                <Input
                                    type="email"
                                    value={String(answers[field.id] ?? "")}
                                    onChange={(event) => updateAnswer(field.id, event.target.value)}
                                    placeholder={field.placeholder || "nama@email.com"}
                                />
                            ) : null}

                            {field.type === "number" ? (
                                <Input
                                    type="number"
                                    value={String(answers[field.id] ?? "")}
                                    onChange={(event) => updateAnswer(field.id, event.target.value)}
                                    placeholder={field.placeholder || "0"}
                                />
                            ) : null}

                            {field.type === "select" ? (
                                <Select value={String(answers[field.id] ?? "")} onValueChange={(value) => updateAnswer(field.id, value)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Pilih jawaban" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(field.options ?? []).map((option) => (
                                            <SelectItem key={option.id} value={option.label}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : null}

                            {field.type === "radio" ? (
                                <RadioGroup
                                    value={String(answers[field.id] ?? "")}
                                    onValueChange={(value) => updateAnswer(field.id, value)}
                                    className="space-y-3"
                                >
                                    {(field.options ?? []).map((option) => (
                                        <div key={option.id} className="flex items-center gap-3 rounded-xl border p-3">
                                            <RadioGroupItem value={option.label} id={`${field.id}-${option.id}`} />
                                            <Label htmlFor={`${field.id}-${option.id}`}>{option.label}</Label>
                                        </div>
                                    ))}
                                </RadioGroup>
                            ) : null}

                            {field.type === "checkbox" ? (
                                <div className="space-y-3">
                                    {(field.options ?? []).map((option) => {
                                        const values = Array.isArray(answers[field.id]) ? (answers[field.id] as string[]) : []
                                        const checked = values.includes(option.label)
                                        return (
                                            <div key={option.id} className="flex items-center gap-3 rounded-xl border p-3">
                                                <Checkbox
                                                    id={`${field.id}-${option.id}`}
                                                    checked={checked}
                                                    onCheckedChange={(value) => toggleCheckbox(field.id, option.label, Boolean(value))}
                                                />
                                                <Label htmlFor={`${field.id}-${option.id}`}>{option.label}</Label>
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : null}

                            {field.type === "image-choice" ? (
                                <div className="grid gap-3 md:grid-cols-2">
                                    {(field.options ?? []).map((option) => {
                                        const active = String(answers[field.id] ?? "") === option.label
                                        return (
                                            <button
                                                key={option.id}
                                                type="button"
                                                onClick={() => updateAnswer(field.id, option.label)}
                                                className={cn(
                                                    "overflow-hidden rounded-2xl border text-left transition",
                                                    active ? "shadow-lg" : "hover:border-primary/50",
                                                )}
                                                style={active ? { borderColor: theme.accentColor } : undefined}
                                            >
                                                {option.imageUrl ? (
                                                    <div className="relative h-40 w-full">
                                                        <Image
                                                            src={option.imageUrl}
                                                            alt={option.label}
                                                            fill
                                                            className="object-cover"
                                                        />
                                                    </div>
                                                ) : null}
                                                <div className="p-4">
                                                    <p className="font-medium">{option.label}</p>
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            ) : null}

                            {field.type === "file-upload" ? (
                                <div className="space-y-3">
                                    <Input
                                        type="file"
                                        onChange={(event) => handleUploadAnswerFile(field.id, event.target.files?.[0] ?? null)}
                                    />
                                    {typeof answers[field.id] === "string" && String(answers[field.id]).length > 0 ? (
                                        <a
                                            href={String(answers[field.id])}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-sm text-primary underline"
                                        >
                                            File uploaded, lihat file
                                        </a>
                                    ) : null}
                                </div>
                            ) : null}

                            {field.type === "rating" ? (
                                <div className="flex flex-wrap gap-3">
                                    {[1, 2, 3, 4, 5].map((value) => {
                                        const active = String(answers[field.id] ?? "") === String(value)
                                        return (
                                            <button
                                                key={value}
                                                type="button"
                                                onClick={() => updateAnswer(field.id, String(value))}
                                                className={cn(
                                                    "flex h-12 w-12 items-center justify-center rounded-2xl border text-sm font-semibold transition",
                                                    active ? "text-white shadow-lg" : "bg-background",
                                                )}
                                                style={active ? { backgroundColor: theme.accentColor } : undefined}
                                            >
                                                {value}
                                            </button>
                                        )
                                    })}
                                </div>
                            ) : null}
                        </div>
                    ))}

                    {error ? <p className="text-sm text-destructive">{error}</p> : null}

                    <Button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isPending || mode === "preview"}
                        className="w-full h-12 text-base font-semibold"
                        style={{ backgroundColor: theme.accentColor }}
                    >
                        {mode === "preview" ? "Preview Mode" : isPending ? "Mengirim..." : "Kirim Jawaban"}
                    </Button>
                </CardContent>
            </Card>

            <div className="space-y-4">
                <Card className="border-0 shadow-xl">
                    <CardHeader>
                        <CardTitle className="text-lg">Form Summary</CardTitle>
                        <CardDescription>Ringkasan cepat sebelum responden mengirim jawaban</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="rounded-2xl border p-4">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Questions</p>
                            <p className="mt-1 text-2xl font-bold">{fields.length}</p>
                        </div>
                        <div className="rounded-2xl border p-4">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Required</p>
                            <p className="mt-1 text-2xl font-bold">{totalRequired}</p>
                        </div>
                        <div className="rounded-2xl border p-4">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Type</p>
                            <p className="mt-1 text-lg font-semibold">{mode === "preview" ? "Builder Preview" : "Live Public Form"}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-0 shadow-xl">
                    <CardHeader>
                        <CardTitle className="text-lg">Why This Feels Better</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm text-muted-foreground">
                        <p>Layout dibuat lebih editorial dengan hero, summary rail, dan kartu pertanyaan yang rapi.</p>
                        <p>Warna aksen mengikuti branding form supaya tiap survey terasa punya identitas sendiri.</p>
                        <p>Progress dan hierarchy pertanyaan dibuat jelas agar completion rate lebih tinggi.</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
