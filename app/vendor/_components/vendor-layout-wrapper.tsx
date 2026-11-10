"use client"

import React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import logo from "@/public/logo.png"
import { Building2, Home, LogOut, PlusCircle } from "lucide-react"

export function VendorLayoutWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const isLoginPage = pathname === "/vendor/login"

    // Jika di halaman login vendor, render halaman penuh tanpa navbar dan footer dashboard
    if (isLoginPage) {
        return <div className="min-h-screen font-sans">{children}</div>
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans">
            {/* Top Navbar */}
            <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="max-w-[1700px] w-full mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/vendor/dashboard" className="flex items-center gap-2">
                            <div className="flex aspect-square size-9 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm overflow-hidden border border-slate-200 p-1">
                                <Image
                                    src={logo}
                                    alt="One Chitra Logo"
                                    width={32}
                                    height={32}
                                    className="object-contain"
                                />
                            </div>
                            <div className="flex flex-col">
                                <span className="font-bold text-base leading-tight text-slate-900 dark:text-slate-100">
                                    One Chitra <span className="text-primary font-normal text-xs uppercase px-1.5 py-0.5 bg-primary/10 rounded">Partner Portal</span>
                                </span>
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                    Vendor Invoice Management
                                </span>
                            </div>
                        </Link>
                    </div>

                    {/* Navigation Links */}
                    <nav className="hidden md:flex items-center gap-1">
                        <Link
                            href="/vendor/dashboard"
                            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                        >
                            <Home className="w-4 h-4 text-slate-500" />
                            Dashboard
                        </Link>
                        <Link
                            href="/vendor/invoices/new"
                            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10 rounded-md transition-colors"
                        >
                            <PlusCircle className="w-4 h-4" />
                            Ajukan Invoice
                        </Link>
                        <Link
                            href="/vendor/profile"
                            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                        >
                            <Building2 className="w-4 h-4 text-slate-500" />
                            Profil Perusahaan
                        </Link>
                    </nav>

                    {/* Right side actions */}
                    <div className="flex items-center gap-2">
                        <Link
                            href="/vendor/invoices/new"
                            className="md:hidden inline-flex items-center justify-center p-2 rounded-md bg-primary text-white hover:bg-primary/90 text-sm font-medium"
                        >
                            <PlusCircle className="w-4 h-4" />
                        </Link>
                        <Link
                            href="/api/auth/sign-out"
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50 rounded-md border border-slate-200 dark:border-slate-800 transition-colors"
                        >
                            <LogOut className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Keluar</span>
                        </Link>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 max-w-[1700px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
                {children}
            </main>

            {/* Footer */}
            <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-4 text-center text-xs text-slate-500 dark:text-slate-400">
                <div className="max-w-7xl mx-auto px-4">
                    &copy; {new Date().getFullYear()} PT Chitra Paratama. One Chitra Vendor Portal &bull; Sistem Terintegrasi Penagihan &amp; Pembayaran Faktur.
                </div>
            </footer>
        </div>
    )
}
