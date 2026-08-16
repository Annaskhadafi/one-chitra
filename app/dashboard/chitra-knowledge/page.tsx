import { getHelpDeskKnowledgeDashboard } from "@/app/actions/helpdesk-ai"
import { getRagInfo, listRagDocuments } from "@/lib/raray-rag"
import { ChitraKnowledgeManager } from "./_components/chitra-knowledge-manager"

export const dynamic = "force-dynamic"

export default async function ChitraKnowledgePage() {
    const [dashboard, ragDocumentsRes, ragInfoRes] = await Promise.all([
        getHelpDeskKnowledgeDashboard().catch((err) => {
            console.error("[ChitraKnowledgePage] getHelpDeskKnowledgeDashboard error:", err)
            return {
                summary: { totalSources: 0, activeSources: 0, inactiveSources: 0, totalChunks: 0 },
                sources: [],
                logs: [],
            }
        }),
        listRagDocuments().catch((err) => {
            console.error("[ChitraKnowledgePage] listRagDocuments error:", err)
            return { status: "error" as const, total_documents: 0, total_chunks: 0, documents: [] }
        }),
        getRagInfo().catch((err) => {
            console.error("[ChitraKnowledgePage] getRagInfo error:", err)
            return { status: "error" as const }
        }),
    ])

    return (
        <ChitraKnowledgeManager
            summary={dashboard.summary}
            sources={dashboard.sources}
            logs={dashboard.logs}
            ragDocuments={ragDocumentsRes.documents || []}
            ragTotalDocuments={ragDocumentsRes.total_documents || 0}
            ragTotalChunks={ragDocumentsRes.total_chunks || 0}
            ragInfo={ragInfoRes.status === "success" ? ragInfoRes.data : undefined}
        />
    )
}
