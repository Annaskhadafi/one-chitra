import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, PencilLine } from "lucide-react"

import { getGoodReceiveManualById } from "@/app/actions/good-receive-manual"
import { GoodReceiveManualEditForm } from "../../_components/good-receive-manual-edit-form"
import { Button } from "@/components/ui/button"

type EditGoodReceiveManualPageProps = {
    params: Promise<{
        id: string
    }>
}

export default async function EditGoodReceiveManualPage({ params }: EditGoodReceiveManualPageProps) {
    const { id } = await params
    const recordId = Number(id)

    if (!Number.isFinite(recordId) || recordId <= 0) {
        notFound()
    }

    const record = await getGoodReceiveManualById(recordId)
    if (!record) {
        notFound()
    }

    return (
        <div className="space-y-5 p-4 sm:space-y-6 sm:p-6">
            <Button asChild variant="ghost" size="sm" className="w-fit text-muted-foreground hover:text-foreground -ml-2 h-8 gap-1.5">
                <Link href="/dashboard/good-receive-manual">
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to Good Receive Manual
                </Link>
            </Button>

            <div className="flex items-start gap-3">
                <div className="rounded-lg bg-indigo-100 dark:bg-indigo-950/50 p-2 mt-0.5 sm:p-2.5">
                    <PencilLine className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Edit Good Receive Manual</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        Update reference document, delivery metadata, vendor DO upload, dan notes item.
                    </p>
                </div>
            </div>

            <GoodReceiveManualEditForm record={record} />
        </div>
    )
}
