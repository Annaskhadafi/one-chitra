import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { getVendorQuotations } from "@/app/actions/vendor-quotation"
import { VendorQuotationsClient } from "@/app/dashboard/vendor-quotations/vendor-quotations-client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowUpRight, FileSearch, ShieldCheck, Sparkles } from "lucide-react"
import { auth } from "@/lib/auth"

export const metadata = {
    title: "Vendor Quotation Database | One Chitra",
    description: "Tampilan modal vendor quotation tanpa sidebar dan navbar dashboard.",
}

export default async function VendorQuotationsModalPage() {
    const requestHeaders = await headers()
    const session = await auth.api.getSession({
        headers: requestHeaders,
    })

    if (!session?.user?.id) {
        redirect("/sign-in")
    }

    const data = await getVendorQuotations()

    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4 md:p-6">
            <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1600px] flex-col rounded-[28px] border border-slate-200 bg-white/95 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.10)] backdrop-blur md:min-h-[calc(100vh-3rem)] md:p-6">
                <section className="relative overflow-hidden rounded-[24px] border border-slate-200 bg-gradient-to-br from-slate-950 via-indigo-950 to-blue-900 px-6 py-6 text-white shadow-[0_20px_60px_rgba(15,23,42,0.24)] md:px-8 md:py-8">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.22),transparent_30%),radial-gradient(circle_at_left,rgba(129,140,248,0.18),transparent_28%)]" />
                    <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-3xl space-y-4">
                            <Badge className="w-fit border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100 shadow-none hover:bg-white/10">
                                Vendor Intelligence
                            </Badge>
                            <div className="flex items-start gap-4">
                                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15 backdrop-blur">
                                    <FileSearch className="h-7 w-7 text-cyan-200" />
                                </div>
                                <div className="space-y-2">
                                    <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                                        Vendor Quotation Database
                                    </h1>
                                    <p className="max-w-2xl text-sm leading-7 text-slate-200 md:text-base">
                                        Cari referensi harga vendor lebih cepat, lalu gunakan hasilnya sebagai bahan negosiasi dan pembanding sebelum quotation disubmit ke customer.
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-3 text-sm text-slate-100">
                                <div className="flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-2">
                                    <Sparkles className="h-4 w-4 text-cyan-200" />
                                    Auto-expand hasil pencarian item vendor
                                </div>
                                <div className="flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-2">
                                    <ShieldCheck className="h-4 w-4 text-emerald-200" />
                                    Tetap validasi stok dan harga terakhir ke vendor
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col gap-3 rounded-2xl border border-white/12 bg-white/10 p-4 backdrop-blur md:min-w-[280px]">
                            <p className="text-sm font-medium text-white/90">Panduan cepat</p>
                            <p className="text-sm leading-6 text-slate-200">
                                Gunakan pencarian untuk cek histori item. Jika tidak ditemukan, minta bantuan tim Product Accessories atau Procurement.
                            </p>
                            <Button
                                asChild
                                variant="secondary"
                                className="w-full justify-between rounded-xl border-0 bg-white text-slate-900 hover:bg-slate-100"
                            >
                                <a href="/dashboard/epr-integrasi" target="_blank" rel="noreferrer">
                                    Buka EPR Integration
                                    <ArrowUpRight className="h-4 w-4" />
                                </a>
                            </Button>
                        </div>
                    </div>
                </section>

                <div className="mt-5 flex-1 overflow-hidden">
                    <VendorQuotationsClient initialData={data} standalone />
                </div>
            </div>
        </main>
    )
}
