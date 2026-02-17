import { getCustomers } from "@/app/actions/customer"
import { CustomerTable } from "./_components/customer-table"

export default async function CustomersPage() {
    const data = await getCustomers()

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold tracking-tight">Customer Management</h1>
                <p className="text-muted-foreground">
                    Manage your customer database, contact information, and shipping addresses.
                </p>
            </div>

            <div className="flex-1">
                <CustomerTable customers={data} />
            </div>
        </div>
    )
}
