import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { Truck, Route, BadgeDollarSign } from "lucide-react"
import { auth } from "@/lib/auth"
import { getLogisticsMasterPrices } from "@/app/actions/logistics-master-price"
import { LogisticsMasterPriceClient } from "@/app/dashboard/logistics-costs/master-price/_components/logistics-master-price-client"
import { Badge } from "@/components/ui/badge"

export const metadata = {
    title: "Master Price Delivery | One Chitra",
    description: "Tampilan modal master price delivery tanpa sidebar dashboard.",
}

export default async function MasterPriceDeliveryModalPage() {
    const requestHeaders = await headers()
    const session = await auth.api.getSession({
        headers: requestHeaders,
    })

    if (!session?.user?.id) {
        redirect("/sign-in")
    }

    const data = await getLogisticsMasterPrices()

    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-orange-50 p-4 md:p-6">
            <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1680px] flex-col rounded-[28px] border border-slate-200 bg-white/95 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.10)] backdrop-blur md:min-h-[calc(100vh-3rem)] md:p-6">
                <section className="relative overflow-hidden rounded-[24px] border border-orange-200 bg-gradient-to-br from-slate-950 via-orange-950 to-amber-800 px-6 py-6 text-white shadow-[0_20px_60px_rgba(15,23,42,0.24)] md:px-8 md:py-8">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.24),transparent_30%),radial-gradient(circle_at_left,rgba(249,115,22,0.16),transparent_28%)]" />
                    <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-3xl space-y-4">
                            <Badge className="w-fit border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-100 shadow-none hover:bg-white/10">
                                Delivery Pricing
                            </Badge>
                            <div className="flex items-start gap-4">
                                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15 backdrop-blur">
                                    <Truck className="h-7 w-7 text-amber-200" />
                                </div>
                                <div className="space-y-2">
                                    <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                                        Master Price Delivery
                                    </h1>
                                    <p className="max-w-2xl text-sm leading-7 text-slate-200 md:text-base">
                                        Kelola tarif delivery per rute, truck type, kapasitas ring, dan product type agar tim quotation bisa cek ongkir tanpa keluar dari form.
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-3 text-sm text-slate-100">
                                <div className="flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-2">
                                    <Route className="h-4 w-4 text-amber-200" />
                                    Mapping rute From dan To lebih cepat
                                </div>
                                <div className="flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-2">
                                    <BadgeDollarSign className="h-4 w-4 text-orange-200" />
                                    Cocok untuk cek price delivery saat buat quotation
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="mt-5 flex-1 overflow-hidden">
                    <LogisticsMasterPriceClient initialRows={data} />
                </div>
            </div>
        </main>
    )
}
