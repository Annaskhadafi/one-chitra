import { Suspense } from "react"
import { getApiKeysAction } from "@/app/actions/api-keys"
import { ApiKeysClient } from "./_components/api-keys-client"
import { PageHeader } from "@/components/page-header"
import { KeyRound } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function ApiKeysPage() {
    const apiKeys = await getApiKeysAction()

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            <div className="min-w-0 w-full">
                <PageHeader
                    title="API Keys Management"
                    subtitle="Hasilkan dan kelola API Key untuk integrasi sistem eksternal, handheld scanner RFID, ekspor data otomatis, dan akses Swagger / Redoc."
                    icon={KeyRound}
                />
            </div>

            <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Memuat data API Keys...</div>}>
                <ApiKeysClient initialApiKeys={apiKeys} />
            </Suspense>
        </div>
    )
}
