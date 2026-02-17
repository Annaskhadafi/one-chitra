import { getCustomers } from "@/app/actions/customer"
import { getProducts } from "@/app/actions/product"
import { getUsers } from "@/app/actions/users"
import { QuotationForm } from "../_components/quotation-form"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"

export default async function CreateQuotationPage() {
    const session = await auth.api.getSession({
        headers: await headers()
    })

    const [customers, products, users] = await Promise.all([
        getCustomers(),
        getProducts(),
        getUsers(),
    ])

    return <QuotationForm customers={customers} products={products} users={users} currentUserId={session?.user.id} />
}
