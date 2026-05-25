import { Suspense } from "react"
import {
    getCampaignById,
    getCampaignContracts,
    getCampaignContractDetails,
    getCampaignDashboardData,
    getCampaignProducts,
    getCampaignCustomerCategories,
} from "@/app/actions/campaigns"
import { CampaignDetailClient } from "./_components/campaign-detail-client"
import { notFound } from "next/navigation"

export const metadata = {
    title: "Campaign Dashboard | One Chitra",
}

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const campaignId = parseInt(id, 10)
    if (isNaN(campaignId)) return notFound()

    const campaignRes = await getCampaignById(campaignId)
    if (!campaignRes.success || !campaignRes.data) return notFound()

    const [dashboardRes, productsRes, contractsRes, customerCategoriesRes] = await Promise.all([
        getCampaignDashboardData(campaignId),
        getCampaignProducts(campaignId),
        getCampaignContracts(campaignId),
        getCampaignCustomerCategories(campaignId),
    ])

    const contracts = contractsRes.success && contractsRes.data ? contractsRes.data : []
    const detailsResponses = await Promise.all(contracts.map((contract) => getCampaignContractDetails(contract.id)))
    const contractDetails = detailsResponses.flatMap((res) => (res.success && res.data ? res.data : []))

    return (
        <div className="flex-1 space-y-4 px-3 py-4 sm:px-4 sm:py-5 lg:p-8 lg:pt-6">
            <Suspense fallback={<div>Loading Dashboard...</div>}>
                <CampaignDetailClient
                    campaign={campaignRes.data}
                    dashboardData={dashboardRes.success ? dashboardRes.data : null}
                    products={productsRes.success && productsRes.data ? productsRes.data : []}
                    contracts={contracts}
                    contractDetails={contractDetails}
                    customerCategories={customerCategoriesRes.success && customerCategoriesRes.data ? customerCategoriesRes.data : []}
                />
            </Suspense>
        </div>
    )
}