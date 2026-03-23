import type { Metadata } from "next"
import { ClipboardList } from "lucide-react"

import { getSurveyAnalytics, getSurveyFormById, listSurveyForms } from "@/app/actions/forms-surveys"
import { PageHeader } from "@/components/page-header"

import { FormBuilderClient } from "./_components/form-builder-client"

export const metadata: Metadata = {
    title: "Form & Survey Builder | One Chitra",
    description: "Builder form dan survey interaktif yang bisa dipublish dan dianalisis.",
}

export default async function FormsBuilderPage() {
    const forms = await listSurveyForms()
    const firstForm = forms[0] ?? null
    const [selectedForm, analytics] = firstForm
        ? await Promise.all([getSurveyFormById(firstForm.id), getSurveyAnalytics(firstForm.id)])
        : [null, null]

    return (
        <div className="space-y-6 p-6">
            <PageHeader
                title="Form & Survey Builder"
                subtitle="Bangun form seperti SurveyMonkey, publish ke publik, kumpulkan jawaban, lalu lihat analytics dan grafiknya."
                icon={ClipboardList}
            />
            <FormBuilderClient
                initialForms={forms}
                initialSelectedForm={selectedForm}
                initialAnalytics={analytics}
            />
        </div>
    )
}
