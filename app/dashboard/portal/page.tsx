import { getPortalItems } from "@/app/actions/portal"
import { PortalClient } from "./_components/portal-client"
import { Metadata } from "next"

export const metadata: Metadata = {
    title: "Digital Ecosystem | One Chitra",
    description: "Silakan pilih sistem yang ingin diakses.",
}

export default async function PortalPage() {
    const items = await getPortalItems()

    return (
        <div className="space-y-8 p-1 md:p-6">
            <div className="space-y-1">
                <h1 className="text-3xl font-bold tracking-tight">Digital Ecosystem</h1>
                <p className="text-muted-foreground">
                    Silakan pilih sistem yang ingin diakses.
                </p>
            </div>

            <PortalClient initialItems={items} />
        </div>
    )
}
