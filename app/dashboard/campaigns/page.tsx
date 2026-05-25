import { Suspense } from "react"
import { getCampaigns, getCampaignProducts, getCampaignContracts, getCampaignContractDetails,
    getCampaignCustomerCategories, getMasterCustomers, getMasterProducts } from "@/app/actions/campaigns"
import { CampaignsClient } from "./_components/campaigns-client"

export const metadata = {
    title: "GP Campign | One Chitra",
    description: "Manage sales incentive campaigns and contracts",
}

export default async function CampaignsPage() {
    const [campaignsResponse, customersResponse, productsResponse] = await Promise.all([getCampaigns(), getMasterCustomers(), getMasterProducts()]);
    const campaignsData = campaignsResponse.success && campaignsResponse.data ? campaignsResponse.data : [];
    const customersData = customersResponse.success && customersResponse.data ? customersResponse.data : [];
    const productsData = productsResponse.success && productsResponse.data ? productsResponse.data : [];
    const campaignProductsResponses = await Promise.all(campaignsData.map((campaign) => getCampaignProducts(campaign.id)));
    const campaignProductsData = campaignProductsResponses.flatMap((res) => (res.success && res.data ? res.data : []));
    const campaignContractsResponses = await Promise.all(campaignsData.map((campaign) => getCampaignContracts(campaign.id)));
    const campaignContractsData = campaignContractsResponses.flatMap((res) => (res.success && res.data ? res.data : []));
    const campaignContractDetailsResponses = await Promise.all(campaignContractsData.map((contract) => getCampaignContractDetails(contract.id)));
    const campaignContractDetailsData = campaignContractDetailsResponses.flatMap((res) => (res.success && res.data ? res.data : []));
    const campaignCustomerCategoryResponses = await Promise.all(campaignsData.map((campaign) => getCampaignCustomerCategories(campaign.id)));
    const campaignCustomerCategoriesData = campaignCustomerCategoryResponses.flatMap((res) => (res.success && res.data ? res.data : []));

    return (
        <div className="flex-1 space-y-4 px-3 py-4 sm:px-4 sm:py-5 lg:p-8 lg:pt-6">
            <Suspense fallback={<div>Loading Campaigns...</div>}>
                <CampaignsClient initialData={campaignsData} masterCustomers={customersData} masterProducts={productsData} campaignProducts={campaignProductsData} campaignContracts={campaignContractsData} campaignContractDetails={campaignContractDetailsData} campaignCustomerCategories={campaignCustomerCategoriesData} />
            </Suspense>
        </div>
    )
}

