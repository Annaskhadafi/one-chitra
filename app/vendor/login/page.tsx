"use client"

import React, { useState } from "react"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { signIn } from "@/lib/auth-client"
import { prepareVendorLoginAction } from "@/app/actions/vendor-invoices"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    AlertCircle,
    CheckCircle2,
    Lock,
    Loader2,
    Building2,
    KeyRound,
    Eye,
    EyeOff,
    ShieldCheck,
    FileCheck,
    ArrowRight,
} from "lucide-react"

function VendorLoginForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const isActivated = searchParams.get("activated") === "1"

    const [identifier, setIdentifier] = useState("")
    const [password, setPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setErrorMessage(null)
        setIsLoading(true)

        try {
            // 1. Siapkan/Verifikasi Akun Vendor (Mendukung Kode Vendor SAP & Email Resmi)
            const prep = await prepareVendorLoginAction(identifier.trim())
            if (!prep.success || !prep.email) {
                setErrorMessage(prep.error || "Identitas vendor tidak ditemukan.")
                setIsLoading(false)
                return
            }

            // 2. Lakukan Autentikasi Better-Auth
            const { error } = await signIn.email({
                email: prep.email.toLowerCase(),
                password,
            })

            if (error) {
                setErrorMessage(
                    error.message ||
                    "Kata sandi tidak sesuai. Jika ini login pertama dengan Kode SAP, gunakan 'Password123!'."
                )
                setIsLoading(false)
                return
            }

            router.push("/vendor/dashboard")
        } catch (err: any) {
            setErrorMessage(err.message || "Gagal masuk ke sistem portal vendor.")
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-700 flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
            {/* Background Decorative Waves & Dot Patterns matching reference */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {/* Top-Right Dot Matrix */}
                <div className="absolute top-6 right-8 grid grid-cols-6 gap-2.5 opacity-25">
                    {Array.from({ length: 36 }).map((_, i) => (
                        <div key={i} className="size-1.5 rounded-full bg-white" />
                    ))}
                </div>

                {/* Bottom-Left Dot Matrix */}
                <div className="absolute bottom-10 left-8 grid grid-cols-5 gap-3 opacity-20">
                    {Array.from({ length: 25 }).map((_, i) => (
                        <div key={i} className="size-2 rounded-full bg-white" />
                    ))}
                </div>

                {/* Soft ambient gradient orbs */}
                <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-purple-400/30 blur-3xl" />
                <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-indigo-300/25 blur-3xl" />
            </div>

            {/* Main Split-Layout Card Container */}
            <div className="relative z-10 max-w-5xl w-full bg-white dark:bg-slate-900 rounded-[28px] shadow-2xl shadow-indigo-950/40 overflow-hidden grid grid-cols-1 lg:grid-cols-12 border border-white/20">
                {/* ========================================================= */}
                {/* LEFT COLUMN: BRANDING & 3D ISOMETRIC ILLUSTRATION        */}
                {/* ========================================================= */}
                <div className="lg:col-span-5 bg-gradient-to-br from-indigo-50/80 via-purple-50/50 to-blue-50/70 dark:from-slate-800/80 dark:to-slate-900 p-8 sm:p-10 flex flex-col justify-between relative border-b lg:border-b-0 lg:border-r border-slate-100 dark:border-slate-800">
                    {/* Official Company Logo */}
                    <div>
                        <div className="bg-white dark:bg-slate-950 p-3 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800 inline-block">
                            <Image
                                src="/chitra-paratama-logo.jpg"
                                alt="PT Chitra Paratama - Total Tire Solution"
                                width={180}
                                height={60}
                                className="h-12 w-auto object-contain"
                                priority
                            />
                        </div>
                    </div>

                    {/* 3D Isometric Security & Invoice Illustration (Custom Vector) */}
                    <div className="my-8 flex items-center justify-center">
                        <svg
                            viewBox="0 0 400 320"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-full max-w-[320px] drop-shadow-xl"
                        >
                            <defs>
                                <linearGradient id="isoBase" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="#e0e7ff" stopOpacity="0.8" />
                                    <stop offset="100%" stopColor="#ede9fe" stopOpacity="0.4" />
                                </linearGradient>
                                <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="#6366f1" />
                                    <stop offset="100%" stopColor="#818cf8" />
                                </linearGradient>
                                <linearGradient id="padlockGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="#06b6d4" />
                                    <stop offset="100%" stopColor="#3b82f6" />
                                </linearGradient>
                                <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="#f43f5e" />
                                    <stop offset="100%" stopColor="#fb7185" />
                                </linearGradient>
                            </defs>

                            {/* Floating Isometric Diamonds / Floor Tiles */}
                            <path d="M 40 200 L 70 185 L 100 200 L 70 215 Z" fill="#e0e7ff" opacity="0.6" />
                            <path d="M 120 230 L 145 218 L 170 230 L 145 242 Z" fill="#c7d2fe" opacity="0.7" />
                            <path d="M 330 140 L 355 128 L 380 140 L 355 152 Z" fill="#e0e7ff" opacity="0.7" />
                            <path d="M 350 220 L 380 205 L 410 220 L 380 235 Z" fill="#ede9fe" opacity="0.6" />

                            {/* Base Isometric Shadow & Platform */}
                            <ellipse cx="200" cy="240" rx="140" ry="45" fill="#cbd5e1" opacity="0.3" />

                            {/* Main Screen / ID Portal Card (Isometric Angle) */}
                            <g transform="translate(60, 60)">
                                {/* Card Body */}
                                <path
                                    d="M 50 30 L 190 -40 L 190 110 L 50 180 Z"
                                    fill="url(#cardGrad)"
                                    opacity="0.95"
                                />
                                {/* Left Side Thickness */}
                                <path d="M 45 35 L 50 30 L 50 180 L 45 185 Z" fill="#4f46e5" />
                                {/* Bottom Thickness */}
                                <path d="M 45 185 L 50 180 L 190 110 L 185 115 Z" fill="#4338ca" />

                                {/* Avatar Circle in Screen */}
                                <circle cx="85" cy="85" r="18" fill="white" opacity="0.9" />
                                <circle cx="85" cy="80" r="7" fill="#6366f1" />
                                <path
                                    d="M 74 96 C 74 90, 96 90, 96 96 Z"
                                    fill="#6366f1"
                                />

                                {/* Profile Data Lines */}
                                <rect x="115" y="55" width="55" height="6" rx="3" fill="white" opacity="0.9" transform="skewY(-27)" />
                                <rect x="115" y="70" width="40" height="4" rx="2" fill="white" opacity="0.75" transform="skewY(-27)" />
                                <rect x="115" y="80" width="48" height="4" rx="2" fill="white" opacity="0.75" transform="skewY(-27)" />
                                <rect x="115" y="90" width="30" height="4" rx="2" fill="white" opacity="0.6" transform="skewY(-27)" />

                                {/* Top Verified Badge */}
                                <circle cx="50" cy="40" r="16" fill="#10b981" />
                                <path
                                    d="M 44 40 L 48 44 L 56 36"
                                    stroke="white"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </g>

                            {/* Floating Document / Invoice with Folded Corner */}
                            <g transform="translate(100, 160)">
                                <path
                                    d="M 10 20 L 45 0 L 45 65 L 10 85 Z"
                                    fill="#ffffff"
                                    filter="drop-shadow(0px 8px 12px rgba(0,0,0,0.1))"
                                />
                                <path d="M 10 20 L 22 28 L 10 32 Z" fill="#e2e8f0" />
                                {/* Doc content lines */}
                                <rect x="18" y="32" width="18" height="3" rx="1.5" fill="#0284c7" transform="skewY(-30)" />
                                <rect x="18" y="40" width="20" height="2" rx="1" fill="#94a3b8" transform="skewY(-30)" />
                                <rect x="18" y="46" width="15" height="2" rx="1" fill="#94a3b8" transform="skewY(-30)" />
                                <rect x="18" y="52" width="20" height="2" rx="1" fill="#10b981" transform="skewY(-30)" />
                            </g>

                            {/* Floating Security Padlock (Cyan-Blue) */}
                            <g transform="translate(230, 130)">
                                {/* Shackle */}
                                <path
                                    d="M 22 10 C 22 -6, 38 -6, 38 10 L 38 18 L 22 18 Z"
                                    fill="none"
                                    stroke="#94a3b8"
                                    strokeWidth="5"
                                    strokeLinecap="round"
                                />
                                {/* Body */}
                                <rect
                                    x="14"
                                    y="16"
                                    width="32"
                                    height="36"
                                    rx="6"
                                    fill="url(#padlockGrad)"
                                    filter="drop-shadow(0px 6px 10px rgba(6,182,212,0.3))"
                                />
                                {/* Keyhole */}
                                <circle cx="30" cy="30" r="4" fill="#0f172a" />
                                <path d="M 28.5 31 L 31.5 31 L 32 40 L 28 40 Z" fill="#0f172a" />
                            </g>

                            {/* Floating Mini ID Card (Pink/Red Accent) */}
                            <g transform="translate(195, 195)">
                                <path
                                    d="M 10 15 L 45 0 L 45 35 L 10 50 Z"
                                    fill="url(#badgeGrad)"
                                    filter="drop-shadow(0px 4px 8px rgba(244,63,94,0.25))"
                                />
                                <circle cx="28" cy="18" r="6" fill="white" opacity="0.9" />
                                <rect x="18" y="32" width="20" height="2" rx="1" fill="white" opacity="0.8" transform="skewY(-23)" />
                            </g>
                        </svg>
                    </div>

                    {/* Left Column Bottom Tagline & Trust Points */}
                    <div className="space-y-2 pt-2">
                        <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 block">
                            One Chitra Partner Portal &bull; Sistem Terpadu
                        </span>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                            Integrasi otomatis SAP One Chitra untuk verifikasi faktur, goods receipt, dan pencairan pembayaran mitra vendor.
                        </p>
                        <div className="pt-2 flex flex-wrap gap-2 text-[10px] font-medium text-indigo-700 dark:text-indigo-300">
                            <span className="bg-indigo-100/70 dark:bg-indigo-950 px-2.5 py-1 rounded-md">
                                ✓ 1.122 Rekanan SAP
                            </span>
                            <span className="bg-indigo-100/70 dark:bg-indigo-950 px-2.5 py-1 rounded-md">
                                ✓ Verifikasi 5 Dokumen
                            </span>
                        </div>
                    </div>
                </div>

                {/* ========================================================= */}
                {/* RIGHT COLUMN: LOGIN FORM (STYLE MATCHING REFERENCE)       */}
                {/* ========================================================= */}
                <div className="lg:col-span-7 p-8 sm:p-12 flex flex-col justify-between bg-white dark:bg-slate-900">
                    {/* Top Right Header Action / Portal Pill */}
                    <div className="flex items-center justify-end gap-2 text-xs text-slate-500">
                        <span className="hidden sm:inline">Mitra Rekanan PT Chitra Paratama?</span>
                        <span className="px-3 py-1 rounded-full border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold uppercase tracking-wider text-[10px]">
                            PORTAL LOGIN
                        </span>
                    </div>

                    {/* Main Form Content */}
                    <div className="my-auto py-6 max-w-md w-full mx-auto space-y-6">
                        {/* Heading */}
                        <div className="space-y-1">
                            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                                Welcome to One Chitra!
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                                Masuk ke portal penagihan &amp; monitoring invoice vendor
                            </p>
                        </div>

                        {/* Activation Success Alert */}
                        {isActivated && (
                            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2.5">
                                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                                <span>Akun berhasil diaktifkan! Silakan login menggunakan kata sandi Anda.</span>
                            </div>
                        )}

                        {/* Error Alert */}
                        {errorMessage && (
                            <div className="p-3.5 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center gap-2.5">
                                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                                <span>{errorMessage}</span>
                            </div>
                        )}

                        {/* Info Banner: Master Vendor SAP Login Instruction */}
                        <div className="p-3.5 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-2xl text-xs text-indigo-950 dark:text-indigo-200 space-y-1.5">
                            <div className="flex items-center gap-1.5 font-bold text-indigo-800 dark:text-indigo-300">
                                <Building2 className="w-4 h-4 text-indigo-600" />
                                <span>Login Mitra Master Vendor SAP</span>
                            </div>
                            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                                Rekanan terdaftar dapat langsung masuk menggunakan <strong>Kode Vendor SAP</strong> (misal: <code className="font-mono bg-indigo-100 dark:bg-indigo-900 px-1 py-0.5 rounded text-[11px]">2000001</code>) atau Email resmi perusahaan, dengan kata sandi awal:
                            </p>
                            <div className="flex items-center gap-1.5 font-mono font-bold text-indigo-700 dark:text-indigo-400 text-xs bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-700 w-fit">
                                <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                                Password123!
                            </div>
                        </div>

                        {/* Login Form */}
                        <form onSubmit={handleLogin} className="space-y-4">
                            {/* Input 1: Kode Vendor SAP / Email */}
                            <div className="space-y-1.5">
                                <Label htmlFor="identifier" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                    Kode Vendor SAP atau Email Perusahaan
                                </Label>
                                <Input
                                    id="identifier"
                                    type="text"
                                    placeholder="Contoh: 2000001 atau nama@vendor.com"
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                    required
                                    className="h-11 rounded-xl border-slate-300 dark:border-slate-700 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-sm font-medium transition-all"
                                />
                            </div>

                            {/* Input 2: Password with Show/Hide Toggle */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="password" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                        Kata Sandi
                                    </Label>
                                </div>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="8+ characters"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="h-11 rounded-xl pr-10 border-slate-300 dark:border-slate-700 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-sm transition-all"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                    >
                                        {showPassword ? (
                                            <EyeOff className="w-4 h-4" />
                                        ) : (
                                            <Eye className="w-4 h-4" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Submit Button: Pill shape matching reference */}
                            <div className="pt-2">
                                <Button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full sm:w-auto min-w-[160px] h-12 bg-gradient-to-r from-indigo-600 via-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold px-8 rounded-full shadow-lg shadow-indigo-500/30 transition-all text-sm flex items-center justify-center gap-2"
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Memverifikasi...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Login</span>
                                            <ArrowRight className="w-4 h-4" />
                                        </>
                                    )}
                                </Button>
                            </div>
                        </form>
                    </div>

                    {/* Bottom Help Text */}
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-center sm:text-left text-[11px] text-slate-400">
                        Butuh bantuan login atau reset kata sandi? Hubungi Tim Finance &amp; Procurement PT Chitra Paratama.
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function VendorLoginPage() {
    return (
        <React.Suspense
            fallback={
                <div className="min-h-screen flex items-center justify-center bg-slate-900">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                </div>
            }
        >
            <VendorLoginForm />
        </React.Suspense>
    )
}
