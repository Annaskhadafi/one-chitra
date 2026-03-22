import { getQuotation } from "@/app/actions/quotation"
import { getCustomers } from "@/app/actions/customer"
import { getProducts } from "@/app/actions/product"
import { getUsers } from "@/app/actions/users"
import { notFound } from "next/navigation"
import { QuotationForm } from "../../_components/quotation-form"

export default async function EditQuotationPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    if (!/^\d+$/.test(id)) {
        notFound()
    }

    const [quotation, customers, products, users] = await Promise.all([
        getQuotation(id),
        getCustomers(),
        getProducts(),
        getUsers(),
    ])

    if (!quotation) {
        notFound()
    }

    return (
        <QuotationForm
            customers={customers}
            products={products}
            users={users}
            initialData={quotation as Parameters<typeof QuotationForm>[0]["initialData"]}
        />
    )
}
