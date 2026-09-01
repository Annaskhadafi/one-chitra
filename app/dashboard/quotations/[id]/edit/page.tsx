import { getQuotation } from "@/app/actions/quotation"
import { getCustomers } from "@/app/actions/customer"
import { getProductsForQuotation } from "@/app/actions/product"
import { getQuotationUsers } from "@/app/actions/users"
import { getVendorQuotations } from "@/app/actions/vendor-quotation"
import { notFound } from "next/navigation"
import { QuotationForm } from "../../_components/quotation-form"

export default async function EditQuotationPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    if (!/^\d+$/.test(id)) {
        notFound()
    }

    const [quotation, customers, products, users, vendorQuotations] = await Promise.all([
        getQuotation(id),
        getCustomers(),
        getProductsForQuotation(),
        getQuotationUsers(),
        getVendorQuotations(50),
    ])

    if (!quotation) {
        notFound()
    }

    return (
        <QuotationForm
            customers={customers}
            products={products}
            users={users as any}
            vendorQuotations={vendorQuotations}
            initialData={quotation as Parameters<typeof QuotationForm>[0]["initialData"]}
        />
    )
}
