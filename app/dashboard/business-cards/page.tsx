import { getBusinessCards } from "@/app/actions/business-card-scanner"
import { ClientBusinessCardDashboard } from "./client-page"
import { PermissionGuard } from "@/components/permission-guard"

export const metadata = {
    title: "Business Card Scanner",
}

export default async function BusinessCardsPage() {
    const response = await getBusinessCards()
    const cards = response.success ? response.data : []

    return (
        <PermissionGuard resource="business-cards" action="view">
            <ClientBusinessCardDashboard initialCards={cards || []} />
        </PermissionGuard>
    )
}
