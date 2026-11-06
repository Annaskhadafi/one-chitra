"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { acceptVendorInvitationAction } from "@/app/actions/vendor-invoices"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react"

type TenantInfo = {
    id: string
    code: string
    name: string
    email: string
    phone?: string | null
    address?: string | null
    npwp?: string | null
    isPkp: boolean
    bankName?: string | null
    bankAccountNo?: string | null
    bankAccountHolder?: string | null
}

export function VendorActivationForm({
    tenant,
    token,
}: {
    tenant: TenantInfo
    token: string
}) {
    const router = useRouter()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)
    const [showPassword, setShowPassword] = useState(false)

    const [formData, setFormData] = useState({
        contactName: "",
        password: "",
        confirmPassword: "",
        phone: tenant.phone || "",
        bankName: tenant.bankName || "BCA",
        bankAccountNo: tenant.bankAccountNo || "",
        bankAccountHolder: tenant.bankAccountHolder || tenant.name,
        npwp: tenant.npwp || "",
        address: tenant.address || "",
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setErrorMessage(null)

        if (!formData.contactName.trim()) {
            setErrorMessage("Nama PIC / Penanggung jawab wajib diisi.")
            return
        }

        if (formData.password.length < 8) {
            setErrorMessage("Password minimal 8 karakter.")
            return
        }

        if (formData.password !== formData.confirmPassword) {
            setErrorMessage("Konfirmasi password tidak cocok.")
            return
        }

        if (!formData.bankName.trim() || !formData.bankAccountNo.trim() || !formData.bankAccountHolder.trim()) {
            setErrorMessage("Data rekening bank (Nama Bank, No Rekening, dan Atas Nama) wajib diisi untuk pencairan pembayaran.")
            return
        }

        setIsSubmitting(true)

        try {
            const res = await acceptVendorInvitationAction({
                token,
                password: formData.password,
                contactName: formData.contactName,
                phone: formData.phone,
                bankName: formData.bankName,
                bankAccountNo: formData.bankAccountNo,
                bankAccountHolder: formData.bankAccountHolder,
                npwp: formData.npwp,
                address: formData.address,
            })

            if (!res.success) {
                setErrorMessage(res.error || "Gagal mengaktifkan akun. Silakan coba lagi.")
                setIsSubmitting(false)
                return
            }

            setSuccessMessage("Akun berhasil diaktifkan! Mengarahkan ke halaman login...")
            setTimeout(() => {
                router.push("/vendor/login?activated=1")
            }, 1500)
        } catch (err: any) {
            setErrorMessage(err.message || "Terjadi kesalahan sistem saat aktivasi.")
            setIsSubmitting(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {errorMessage && (
                <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                </div>
            )}

            {successMessage && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 rounded-lg text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{successMessage}</span>
                </div>
            )}

            {/* Bagian Akun Login */}
            <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 border-b pb-1">
                    1. Pengaturan Akun & PIC Vendor
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="contactName">Nama Lengkap PIC / Penanggung Jawab *</Label>
                        <Input
                            id="contactName"
                            placeholder="Contoh: Budi Santoso"
                            value={formData.contactName}
                            onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                            required
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="phone">Nomor Telepon / WhatsApp *</Label>
                        <Input
                            id="phone"
                            placeholder="Contoh: 08123456789"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            required
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="password">Buat Kata Sandi (Password) *</Label>
                        <div className="relative">
                            <Input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                placeholder="Minimal 8 karakter"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                required
                            />
                            <button
                                type="button"
                                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="confirmPassword">Konfirmasi Kata Sandi *</Label>
                        <Input
                            id="confirmPassword"
                            type={showPassword ? "text" : "password"}
                            placeholder="Ulangi kata sandi"
                            value={formData.confirmPassword}
                            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                            required
                        />
                    </div>
                </div>
            </div>

            {/* Bagian Rekening Bank & Pajak */}
            <div className="space-y-4 pt-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 border-b pb-1">
                    2. Rekening Bank Pembayaran & Perpajakan
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="bankName">Nama Bank *</Label>
                        <Input
                            id="bankName"
                            placeholder="Contoh: BCA / Mandiri / BRI"
                            value={formData.bankName}
                            onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                            required
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="bankAccountNo">Nomor Rekening *</Label>
                        <Input
                            id="bankAccountNo"
                            placeholder="Nomor rekening transfer"
                            value={formData.bankAccountNo}
                            onChange={(e) => setFormData({ ...formData, bankAccountNo: e.target.value })}
                            required
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="bankAccountHolder">Nama Pemilik Rekening *</Label>
                        <Input
                            id="bankAccountHolder"
                            placeholder="Sesuai buku tabungan"
                            value={formData.bankAccountHolder}
                            onChange={(e) => setFormData({ ...formData, bankAccountHolder: e.target.value })}
                            required
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="npwp">NPWP Perusahaan</Label>
                        <Input
                            id="npwp"
                            placeholder="Nomor Pokok Wajib Pajak"
                            value={formData.npwp}
                            onChange={(e) => setFormData({ ...formData, npwp: e.target.value })}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="address">Alamat Perusahaan</Label>
                        <Textarea
                            id="address"
                            rows={2}
                            placeholder="Alamat kantor resmi"
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        />
                    </div>
                </div>
            </div>

            <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-2.5 rounded-lg shadow-sm"
            >
                {isSubmitting ? (
                    <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Mengaktifkan Akun...
                    </>
                ) : (
                    "Aktivasi Akun & Simpan Profil"
                )}
            </Button>
        </form>
    )
}
