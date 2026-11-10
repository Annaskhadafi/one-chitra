import { redirect } from "next/navigation"
import { getVendorTenantForCurrentUser } from "@/app/actions/vendor-invoices"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2, CreditCard, Mail, MapPin, Phone, ShieldCheck, User } from "lucide-react"
import { VendorChangePasswordCard } from "./_components/change-password-card"

export const dynamic = "force-dynamic"

export const metadata = {
    title: "Profil Perusahaan Vendor | One Chitra Partner Portal",
    description: "Data profil legal dan rekening pembayaran resmi mitra vendor One Chitra.",
}

export default async function VendorProfilePage() {
    const tenant = await getVendorTenantForCurrentUser()

    if (!tenant) {
        redirect("/vendor/login")
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 py-4">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Building2 className="w-6 h-6 text-primary" />
                    Profil Perusahaan Mitra Vendor
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                    Data master perusahaan, perpajakan, dan rekening pencairan pembayaran resmi PT Chitra Paratama.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Data Perusahaan & Legalitas */}
                <Card className="shadow-xs border-slate-200 dark:border-slate-800">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-primary" />
                            Identitas Legalitas Perusahaan
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3.5 text-xs">
                        <div>
                            <span className="text-slate-400 block mb-0.5">Kode Mitra Vendor:</span>
                            <span className="font-mono font-bold text-sm text-primary">{tenant.code}</span>
                        </div>
                        <div>
                            <span className="text-slate-400 block mb-0.5">Nama Perusahaan:</span>
                            <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{tenant.name}</span>
                        </div>
                        <div>
                            <span className="text-slate-400 block mb-0.5">Status Perpajakan:</span>
                            {tenant.isPkp ? (
                                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">
                                    Pengusaha Kena Pajak (PKP) - Wajib e-Faktur
                                </Badge>
                            ) : (
                                <Badge variant="secondary">Non-PKP</Badge>
                            )}
                        </div>
                        <div>
                            <span className="text-slate-400 block mb-0.5">NPWP Perusahaan:</span>
                            <span className="font-mono font-semibold">{tenant.npwp || "-"}</span>
                        </div>
                        <div>
                            <span className="text-slate-400 block mb-0.5">Alamat Kantor:</span>
                            <span className="text-slate-700 dark:text-slate-300 flex items-start gap-1">
                                <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
                                {tenant.address || "-"}
                            </span>
                        </div>
                    </CardContent>
                </Card>

                {/* Rekening Pembayaran Bank */}
                <Card className="shadow-xs border-slate-200 dark:border-slate-800">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-primary" />
                            Rekening Bank Pencairan Dana
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3.5 text-xs">
                        <div className="p-4 bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl space-y-2">
                            <div>
                                <span className="text-blue-600 dark:text-blue-400 font-semibold block text-[11px] uppercase tracking-wider">
                                    Bank Tujuan Pembayaran
                                </span>
                                <span className="font-bold text-base text-slate-900 dark:text-slate-100">
                                    {tenant.bankName || "Belum Diatur"}
                                </span>
                            </div>
                            <div>
                                <span className="text-slate-400 block text-[11px]">Nomor Rekening:</span>
                                <span className="font-mono font-bold text-lg text-slate-900 dark:text-slate-100">
                                    {tenant.bankAccountNo || "-"}
                                </span>
                            </div>
                            <div>
                                <span className="text-slate-400 block text-[11px]">Atas Nama Rekening:</span>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                    {tenant.bankAccountHolder || "-"}
                                </span>
                            </div>
                        </div>

                        <div className="pt-2">
                            <span className="text-slate-400 block mb-0.5">Term of Payment (TOP) Standar:</span>
                            <span className="font-bold text-slate-900 dark:text-slate-100">{tenant.defaultTopDays} Hari Kalender</span>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                                Terhitung sejak invoice dinyatakan tervalidasi secara sah oleh Finance PT Chitra Paratama.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Pengaturan Ganti Kata Sandi */}
            <VendorChangePasswordCard />
        </div>
    )
}
