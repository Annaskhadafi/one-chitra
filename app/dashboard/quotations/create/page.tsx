import { getCustomers } from "@/app/actions/customer"
import { getProductsForQuotation } from "@/app/actions/product"
import { getQuotationUsers } from "@/app/actions/users"
import { getVendorQuotations } from "@/app/actions/vendor-quotation"
import { QuotationForm } from "../_components/quotation-form"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"

export default async function CreateQuotationPage() {
    const session = await auth.api.getSession({
        headers: await headers()
    })

    const [customers, products, users, vendorQuotations] = await Promise.all([
        getCustomers(),
        getProductsForQuotation(),
        getQuotationUsers(),
        getVendorQuotations(50),
    ])

    return <QuotationForm customers={customers} products={products} users={users as any} vendorQuotations={vendorQuotations} currentUserId={session?.user.id} />
}
