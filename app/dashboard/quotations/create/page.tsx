import { getCustomers } from "@/app/actions/customer"
import { getProducts } from "@/app/actions/product"
import { getUsers } from "@/app/actions/users"
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
        getProducts(),
        getUsers(),
        getVendorQuotations(),
    ])

    return <QuotationForm customers={customers} products={products} users={users} vendorQuotations={vendorQuotations} currentUserId={session?.user.id} />
}
