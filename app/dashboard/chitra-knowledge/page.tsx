import { getHelpDeskKnowledgeDashboard } from "@/app/actions/helpdesk-ai"
import { getMemoryFactsAction, getRagSessionsAction } from "@/app/actions/rag-growth"
import { getRagInfo, listRagDocuments } from "@/lib/raray-rag"
import { ChitraKnowledgeManager } from "./_components/chitra-knowledge-manager"

export const dynamic = "force-dynamic"

export default async function ChitraKnowledgePage() {
    const [dashboard, ragDocumentsRes, ragInfoRes, memoryFactsRes, sessionsRes] = await Promise.all([
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
        getMemoryFactsAction().catch((err) => {
            console.error("[ChitraKnowledgePage] getMemoryFactsAction error:", err)
            return { status: "error" as const, total_facts: 0, facts: [] }
        }),
        getRagSessionsAction().catch((err) => {
            console.error("[ChitraKnowledgePage] getRagSessionsAction error:", err)
            return { status: "error" as const, total_sessions: 0, sessions: [] }
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
            initialMemoryFacts={memoryFactsRes.facts || []}
            initialTotalMemoryFacts={memoryFactsRes.total_facts || 0}
            initialSessions={sessionsRes.sessions || []}
        />
    )
}
