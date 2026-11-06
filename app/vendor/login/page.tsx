"use client"

import React, { useState } from "react"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import logo from "@/public/logo.png"
import { signIn } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, CheckCircle2, Lock, Mail, Loader2, ShieldCheck } from "lucide-react"

export default function VendorLoginPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const isActivated = searchParams.get("activated") === "1"

    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setErrorMessage(null)
        setIsLoading(true)

        try {
            const { error } = await signIn.email({
                email: email.trim().toLowerCase(),
                password,
            })

            if (error) {
                setErrorMessage(error.message || "Email atau kata sandi tidak sesuai.")
                setIsLoading(false)
                return
            }

            router.push("/vendor/dashboard")
        } catch (err: any) {
            setErrorMessage(err.message || "Gagal masuk ke sistem.")
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-[75vh] flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-sm border border-slate-200 dark:border-slate-800">
                <div className="text-center mb-6">
                    <div className="inline-flex aspect-square size-12 items-center justify-center rounded-xl bg-white shadow-sm border border-slate-200 p-2 mb-3">
                        <Image
                            src={logo}
                            alt="One Chitra Logo"
                            width={40}
                            height={40}
                            className="object-contain"
                        />
                    </div>
                    <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                        Masuk Portal Vendor
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Sistem Penagihan & Manajemen Faktur PT Chitra Paratama
                    </p>
                </div>

                {isActivated && (
                    <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 rounded-lg text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                        <span>Akun berhasil diaktifkan! Silakan masuk menggunakan kata sandi Anda.</span>
                    </div>
                )}

                {errorMessage && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                        <span>{errorMessage}</span>
                    </div>
                )}

                <div className="mb-6 p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-lg text-xs text-blue-800 dark:text-blue-300 flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 shrink-0 text-blue-600 mt-0.5" />
                    <div>
                        <span className="font-semibold">Akses Khusus Undangan (Invite-Only):</span>
                        <p className="mt-0.5 text-slate-600 dark:text-slate-400">
                            Hanya vendor yang telah menerima email undangan resmi dari Admin One Chitra yang dapat mengakses portal ini.
                        </p>
                    </div>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="email">Email Perusahaan / Vendor</Label>
                        <div className="relative">
                            <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                            <Input
                                id="email"
                                type="email"
                                placeholder="nama@vendor.com"
                                className="pl-9"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="password">Kata Sandi</Label>
                        <div className="relative">
                            <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                className="pl-9"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <Button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-2.5 rounded-lg shadow-sm mt-2"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Memverifikasi...
                            </>
                        ) : (
                            "Masuk ke Portal Vendor"
                        )}
                    </Button>
                </form>
            </div>
        </div>
    )
}
