import { notFound } from "next/navigation"
import type { Metadata } from "next"

import { getPublicSurveyFormBySlug } from "@/app/actions/forms-surveys"
import { FormRenderer } from "@/components/forms/form-renderer"

type PageProps = {
    params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { slug } = await params
    const form = await getPublicSurveyFormBySlug(slug)

    if (!form) {
        return {
            title: "Form Not Found | One Chitra",
        }
    }

    return {
        title: `${form.title} | One Chitra`,
        description: form.description ?? "Form publik One Chitra",
    }
}

export default async function PublicFormPage({ params }: PageProps) {
    const { slug } = await params
    const form = await getPublicSurveyFormBySlug(slug)

    if (!form) {
        notFound()
    }

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(29,78,216,0.16),_transparent_35%),linear-gradient(180deg,#eff6ff_0%,#f8fafc_35%,#ffffff_100%)] px-4 py-12 md:px-8">
            <div className="mx-auto max-w-4xl">
                <div className="mb-8 text-center">
                    <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">One Chitra</p>
                    <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900">Published Form</h1>
                    <p className="mt-2 text-slate-600">Silakan isi form berikut dan kirimkan jawaban Anda.</p>
                </div>
                <FormRenderer form={form} />
            </div>
        </div>
    )
}
