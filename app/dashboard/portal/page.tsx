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
        <div className="space-y-0 -m-1 md:-m-6">
            {/* Hero Section */}
            <div className="relative overflow-hidden bg-slate-950 px-6 py-16 md:py-24 text-white">
                {/* Decorative gradients */}
                <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
                <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl" />

                <div className="relative z-10 max-w-4xl mx-auto text-center space-y-6">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 backdrop-blur-md text-sm font-medium text-blue-200 mb-2">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                        </span>
                        Enterprise Ecosystem
                    </div>

                    <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-100 to-slate-400">
                        Digital Ecosystem
                    </h1>

                    <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
                        Akses seluruh internal sistem dan aplikasi One Chitra dalam satu platform terintegrasi.
                    </p>
                </div>
            </div>

            <div className="p-6 md:p-10 max-w-[1600px] mx-auto">
                <PortalClient initialItems={items} />
            </div>
        </div>
    )
}
