import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getWarehouses } from "@/app/actions/warehouse"
import { EvhsMasterPriceTable } from "@/app/dashboard/evhs/_components/evhs-master-price-table"
import { Badge } from "@/components/ui/badge"
import { Providers } from "@/components/providers"
import { Boxes, Search, ShieldCheck } from "lucide-react"

export const metadata = {
    title: "Master Price CK | One Chitra",
    description: "Tampilan modal master price CK tanpa sidebar dashboard.",
}

export default async function EvhsMasterPriceModalPage() {
    const requestHeaders = await headers()
    const session = await auth.api.getSession({
        headers: requestHeaders,
    })

    if (!session?.user?.id) {
        redirect("/sign-in")
    }

    const warehouses = await getWarehouses()

    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-cyan-50 p-4 md:p-6">
            <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1680px] flex-col rounded-[28px] border border-slate-200 bg-white/95 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.10)] backdrop-blur md:min-h-[calc(100vh-3rem)] md:p-6">
                <section className="relative overflow-hidden rounded-[24px] border border-cyan-200 bg-gradient-to-br from-slate-950 via-cyan-950 to-blue-900 px-6 py-6 text-white shadow-[0_20px_60px_rgba(15,23,42,0.24)] md:px-8 md:py-8">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.22),transparent_30%),radial-gradient(circle_at_left,rgba(59,130,246,0.18),transparent_28%)]" />
                    <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-3xl space-y-4">
                            <Badge className="w-fit border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100 shadow-none hover:bg-white/10">
                                EVHS Pricing
                            </Badge>
                            <div className="flex items-start gap-4">
                                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15 backdrop-blur">
                                    <Boxes className="h-7 w-7 text-cyan-200" />
                                </div>
                                <div className="space-y-2">
                                    <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                                        Master Price CK
                                    </h1>
                                    <p className="max-w-2xl text-sm leading-7 text-slate-200 md:text-base">
                                        Cek dan kelola master price PT. Cipta Kridatama untuk material EVHS tanpa keluar dari form quotation.
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-3 text-sm text-slate-100">
                                <div className="flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-2">
                                    <Search className="h-4 w-4 text-cyan-200" />
                                    Search material CP, CK, warehouse, dan description
                                </div>
                                <div className="flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-2">
                                    <ShieldCheck className="h-4 w-4 text-emerald-200" />
                                    Cocok untuk crosscheck harga CK lebih cepat
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="mt-5 flex-1 overflow-hidden">
                    <Providers>
                        <EvhsMasterPriceTable warehouses={warehouses} />
                    </Providers>
                </div>
            </div>
        </main>
    )
}
