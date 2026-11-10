"use client"

import React, { useState } from "react"
import { changeVendorPasswordAction } from "@/app/actions/vendor-invoices"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, CheckCircle2, KeyRound, Loader2, Lock } from "lucide-react"

export function VendorChangePasswordCard() {
    const [currentPassword, setCurrentPassword] = useState("")
    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setErrorMessage(null)
        setSuccessMessage(null)

        if (!currentPassword) {
            setErrorMessage("Kata sandi saat ini wajib diisi.")
            return
        }

        if (newPassword.length < 8) {
            setErrorMessage("Kata sandi baru minimal harus 8 karakter.")
            return
        }

        if (newPassword !== confirmPassword) {
            setErrorMessage("Konfirmasi kata sandi baru tidak cocok.")
            return
        }

        setIsLoading(true)

        try {
            const res = await changeVendorPasswordAction({
                currentPassword,
                newPassword,
            })

            if (!res.success) {
                setErrorMessage(res.error || "Gagal mengubah kata sandi.")
                setIsLoading(false)
                return
            }

            setSuccessMessage("Kata sandi Anda berhasil diperbarui! Gunakan kata sandi baru ini untuk login berikutnya.")
            setCurrentPassword("")
            setNewPassword("")
            setConfirmPassword("")
        } catch (err: any) {
            setErrorMessage(err.message || "Terjadi kesalahan saat menyimpan kata sandi baru.")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Card className="shadow-xs border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-cyan-600" />
                    Keamanan Akun &amp; Pengaturan Kata Sandi
                </CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4 text-xs max-w-xl">
                    <p className="text-[11px] text-slate-500">
                        Untuk keamanan akun mitra vendor Anda, ganti kata sandi default secara berkala dengan kombinasi huruf dan angka minimal 8 karakter.
                    </p>

                    {errorMessage && (
                        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg text-red-700 dark:text-red-300 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                            <span>{errorMessage}</span>
                        </div>
                    )}

                    {successMessage && (
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-lg text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                            <span>{successMessage}</span>
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <Label htmlFor="currPass">Kata Sandi Saat Ini / Default *</Label>
                        <div className="relative">
                            <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                            <Input
                                id="currPass"
                                type="password"
                                placeholder="Masukkan kata sandi saat ini..."
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className="pl-9 text-xs h-9"
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="newPass">Kata Sandi Baru *</Label>
                            <div className="relative">
                                <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                                <Input
                                    id="newPass"
                                    type="password"
                                    placeholder="Minimal 8 karakter..."
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="pl-9 text-xs h-9"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="confPass">Konfirmasi Kata Sandi Baru *</Label>
                            <div className="relative">
                                <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                                <Input
                                    id="confPass"
                                    type="password"
                                    placeholder="Ulangi kata sandi baru..."
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="pl-9 text-xs h-9"
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-2">
                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="bg-cyan-600 hover:bg-cyan-700 text-white font-semibold text-xs h-9 px-5 rounded-lg shadow-xs transition-colors"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                    Menyimpan...
                                </>
                            ) : (
                                "Simpan Kata Sandi Baru"
                            )}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}
