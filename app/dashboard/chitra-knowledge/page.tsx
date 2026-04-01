import { getHelpDeskKnowledgeDashboard } from "@/app/actions/helpdesk-ai"
import { ChitraKnowledgeManager } from "./_components/chitra-knowledge-manager"

export default async function ChitraKnowledgePage() {
    const dashboard = await getHelpDeskKnowledgeDashboard()

    return (
        <ChitraKnowledgeManager
            summary={dashboard.summary}
            sources={dashboard.sources}
            logs={dashboard.logs}
        />
    )
}
