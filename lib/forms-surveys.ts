export type FormFieldType =
    | "short-text"
    | "long-text"
    | "email"
    | "number"
    | "select"
    | "radio"
    | "checkbox"
    | "rating"

export type FormFieldOption = {
    id: string
    label: string
    value: string
}

export type FormFieldDefinition = {
    id: string
    type: FormFieldType
    label: string
    description?: string
    placeholder?: string
    required: boolean
    options?: FormFieldOption[]
}

export type FormTheme = {
    accentColor: string
    surfaceColor: string
    textColor: string
}

export type FormSettings = {
    collectEmail: boolean
    showProgress: boolean
    allowMultipleSubmissions: boolean
    successTitle: string
    successMessage: string
}

export type FormBuilderSchema = {
    fields: FormFieldDefinition[]
    theme: FormTheme
    settings: FormSettings
}

export type FormTemplate = {
    key: string
    name: string
    description: string
    kind: FormKind
    schema: FormBuilderSchema
}

export type FormStatus = "draft" | "published" | "closed"
export type FormKind = "form" | "survey"

export const defaultFormTheme: FormTheme = {
    accentColor: "#1d4ed8",
    surfaceColor: "#ffffff",
    textColor: "#0f172a",
}

export const defaultFormSettings: FormSettings = {
    collectEmail: true,
    showProgress: true,
    allowMultipleSubmissions: true,
    successTitle: "Terima kasih",
    successMessage: "Jawaban Anda sudah kami terima.",
}

export const defaultFormSchema = (): FormBuilderSchema => ({
    fields: [
        {
            id: crypto.randomUUID(),
            type: "short-text",
            label: "Nama Lengkap",
            description: "Masukkan nama Anda",
            placeholder: "Contoh: Budi Santoso",
            required: true,
        },
        {
            id: crypto.randomUUID(),
            type: "radio",
            label: "Bagaimana pengalaman Anda?",
            description: "Pilih satu jawaban yang paling sesuai",
            required: true,
            options: [
                { id: crypto.randomUUID(), label: "Sangat Baik", value: "sangat-baik" },
                { id: crypto.randomUUID(), label: "Baik", value: "baik" },
                { id: crypto.randomUUID(), label: "Cukup", value: "cukup" },
                { id: crypto.randomUUID(), label: "Perlu Ditingkatkan", value: "perlu-ditingkatkan" },
            ],
        },
        {
            id: crypto.randomUUID(),
            type: "long-text",
            label: "Masukan Tambahan",
            description: "Tuliskan feedback Anda",
            placeholder: "Ceritakan pengalaman Anda di sini...",
            required: false,
        },
    ],
    theme: defaultFormTheme,
    settings: defaultFormSettings,
})

export function slugifyFormTitle(value: string) {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80)
}

export function ensureFormSchema(value: unknown): FormBuilderSchema {
    if (!value || typeof value !== "object") {
        return defaultFormSchema()
    }

    const candidate = value as Partial<FormBuilderSchema>

    return {
        fields: Array.isArray(candidate.fields)
            ? candidate.fields.map((field) => ({
                id: field.id || crypto.randomUUID(),
                type: field.type || "short-text",
                label: field.label || "Untitled question",
                description: field.description || "",
                placeholder: field.placeholder || "",
                required: Boolean(field.required),
                options: Array.isArray(field.options)
                    ? field.options.map((option) => ({
                        id: option.id || crypto.randomUUID(),
                        label: option.label || "Option",
                        value: option.value || slugifyFormTitle(option.label || "option"),
                    }))
                    : undefined,
            }))
            : defaultFormSchema().fields,
        theme: {
            accentColor: candidate.theme?.accentColor || defaultFormTheme.accentColor,
            surfaceColor: candidate.theme?.surfaceColor || defaultFormTheme.surfaceColor,
            textColor: candidate.theme?.textColor || defaultFormTheme.textColor,
        },
        settings: {
            collectEmail: candidate.settings?.collectEmail ?? defaultFormSettings.collectEmail,
            showProgress: candidate.settings?.showProgress ?? defaultFormSettings.showProgress,
            allowMultipleSubmissions:
                candidate.settings?.allowMultipleSubmissions ?? defaultFormSettings.allowMultipleSubmissions,
            successTitle: candidate.settings?.successTitle || defaultFormSettings.successTitle,
            successMessage: candidate.settings?.successMessage || defaultFormSettings.successMessage,
        },
    }
}

export function fieldSupportsOptions(type: FormFieldType) {
    return type === "select" || type === "radio" || type === "checkbox"
}

export function fieldSupportsPlaceholder(type: FormFieldType) {
    return type !== "radio" && type !== "checkbox" && type !== "select" && type !== "rating"
}

export function buildTemplateSchema(template: "feedback" | "registration" | "event-rsvp"): FormBuilderSchema {
    if (template === "registration") {
        return {
            fields: [
                {
                    id: crypto.randomUUID(),
                    type: "short-text",
                    label: "Nama Lengkap",
                    description: "Nama peserta sesuai identitas",
                    placeholder: "Masukkan nama lengkap",
                    required: true,
                },
                {
                    id: crypto.randomUUID(),
                    type: "email",
                    label: "Email Aktif",
                    description: "Email untuk konfirmasi",
                    placeholder: "nama@email.com",
                    required: true,
                },
                {
                    id: crypto.randomUUID(),
                    type: "number",
                    label: "Nomor WhatsApp",
                    description: "Gunakan format aktif",
                    placeholder: "0812xxxx",
                    required: true,
                },
                {
                    id: crypto.randomUUID(),
                    type: "select",
                    label: "Divisi / Kategori Peserta",
                    description: "Pilih kategori yang sesuai",
                    required: true,
                    options: [
                        { id: crypto.randomUUID(), label: "Sales", value: "sales" },
                        { id: crypto.randomUUID(), label: "Marketing", value: "marketing" },
                        { id: crypto.randomUUID(), label: "Finance", value: "finance" },
                    ],
                },
            ],
            theme: {
                accentColor: "#0f766e",
                surfaceColor: "#ffffff",
                textColor: "#0f172a",
            },
            settings: {
                collectEmail: true,
                showProgress: true,
                allowMultipleSubmissions: false,
                successTitle: "Registrasi Berhasil",
                successMessage: "Data Anda sudah kami simpan. Tim kami akan menghubungi Anda bila perlu.",
            },
        }
    }

    if (template === "event-rsvp") {
        return {
            fields: [
                {
                    id: crypto.randomUUID(),
                    type: "short-text",
                    label: "Nama Tamu",
                    description: "Masukkan nama lengkap tamu",
                    placeholder: "Nama Anda",
                    required: true,
                },
                {
                    id: crypto.randomUUID(),
                    type: "radio",
                    label: "Konfirmasi Kehadiran",
                    description: "Apakah Anda akan hadir?",
                    required: true,
                    options: [
                        { id: crypto.randomUUID(), label: "Hadir", value: "hadir" },
                        { id: crypto.randomUUID(), label: "Tidak Hadir", value: "tidak-hadir" },
                        { id: crypto.randomUUID(), label: "Masih Tentatif", value: "tentatif" },
                    ],
                },
                {
                    id: crypto.randomUUID(),
                    type: "number",
                    label: "Jumlah Tamu",
                    description: "Masukkan total tamu yang hadir",
                    placeholder: "1",
                    required: true,
                },
                {
                    id: crypto.randomUUID(),
                    type: "long-text",
                    label: "Catatan Khusus",
                    description: "Contoh: preferensi makanan, kebutuhan khusus",
                    placeholder: "Tuliskan catatan tambahan",
                    required: false,
                },
            ],
            theme: {
                accentColor: "#be123c",
                surfaceColor: "#fffaf5",
                textColor: "#1f2937",
            },
            settings: {
                collectEmail: true,
                showProgress: true,
                allowMultipleSubmissions: false,
                successTitle: "RSVP Terkirim",
                successMessage: "Terima kasih, konfirmasi kehadiran Anda sudah kami terima.",
            },
        }
    }

    return defaultFormSchema()
}

export const formTemplates: FormTemplate[] = [
    {
        key: "feedback",
        name: "Customer Feedback",
        description: "Template survey kepuasan pelanggan",
        kind: "survey",
        schema: buildTemplateSchema("feedback"),
    },
    {
        key: "registration",
        name: "Registration Form",
        description: "Template pendaftaran event atau program",
        kind: "form",
        schema: buildTemplateSchema("registration"),
    },
    {
        key: "event-rsvp",
        name: "Event RSVP",
        description: "Template konfirmasi kehadiran dengan jumlah tamu",
        kind: "form",
        schema: buildTemplateSchema("event-rsvp"),
    },
]
