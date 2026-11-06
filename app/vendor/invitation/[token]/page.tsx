import { getVendorInvitationDetailsAction } from "@/app/actions/vendor-invoices"
import { VendorActivationForm } from "./_components/activation-form"
import { AlertCircle, Building2, CheckCircle2 } from "lucide-react"
import Link from "next/link"

export const metadata = {
    title: "Aktivasi Akun Vendor | One Chitra Partner Portal",
    description: "Aktivasi akun mitra vendor One Chitra melalui tautan undangan resmi.",
}

export default async function VendorInvitationPage({
    params,
}: {
    params: Promise<{ token: string }>
}) {
    const { token } = await params
    const result = await getVendorInvitationDetailsAction(token)

    if (!result || "error" in result) {
        return (
            <div className="min-h-[70vh] flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-xl p-8 shadow-lg border border-red-200 dark:border-red-900/50 text-center">
                    <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center text-red-600 mx-auto mb-4">
                        <AlertCircle className="w-6 h-6" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                        Tautan Undangan Tidak Valid
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                        {(result as any)?.error || "Token undangan tidak ditemukan atau telah kedaluwarsa. Silakan hubungi tim Admin Procurement / Finance PT Chitra Paratama."}
                    </p>
                    <Link
                        href="/vendor/login"
                        className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm"
                    >
                        Ke Halaman Login Vendor
                    </Link>
                </div>
            </div>
        )
    }

    const { tenant } = result

    return (
        <div className="max-w-2xl mx-auto py-8">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-8 py-6 text-white">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-white/10 backdrop-blur">
                            <Building2 className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <span className="text-xs font-semibold tracking-wider uppercase text-blue-200">
                                Selamat Datang Rekan Vendor
                            </span>
                            <h1 className="text-xl font-bold leading-tight">
                                Aktivasi Akun: {tenant.name}
                            </h1>
                        </div>
                    </div>
                    <p className="text-xs text-blue-100">
                        Kode Vendor: <span className="font-mono font-semibold">{tenant.code}</span> &bull; Email Terdaftar: <span className="font-semibold">{tenant.email}</span>
                    </p>
                </div>

                <div className="p-8">
                    <div className="mb-6 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 p-4 rounded-xl text-xs text-blue-800 dark:text-blue-300">
                        <p className="font-semibold mb-1 flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            Akses Eksklusif Mitra Resmi (Invite-Only)
                        </p>
                        Silakan lengkapi informasi penanggung jawab (PIC), kata sandi akun, serta nomor rekening pembayaran resmi perusahaan Anda untuk memulai proses penagihan faktur.
                    </div>

                    <VendorActivationForm tenant={tenant} token={token} />
                </div>
            </div>
        </div>
    )
}
