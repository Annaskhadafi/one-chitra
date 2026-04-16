"use client"

import { Share, PlusSquare, X } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

const DISMISS_KEY = "one-chitra-ios-pwa-install-dismissed"

function isIPhoneSafari() {
    if (typeof window === "undefined") {
        return false
    }

    const userAgent = window.navigator.userAgent
    const isIPhone = /iPhone/i.test(userAgent)
    const isWebKit = /WebKit/i.test(userAgent)
    const isOtherIosBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/i.test(userAgent)

    return isIPhone && isWebKit && !isOtherIosBrowser
}

function isStandaloneMode() {
    if (typeof window === "undefined") {
        return false
    }

    const iosNavigator = window.navigator as Navigator & { standalone?: boolean }

    return window.matchMedia("(display-mode: standalone)").matches || iosNavigator.standalone === true
}

export function PwaInstallPrompt() {
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        if (typeof window === "undefined") {
            return
        }

        const wasDismissed = window.sessionStorage.getItem(DISMISS_KEY) === "true"

        if (!wasDismissed && isIPhoneSafari() && !isStandaloneMode()) {
            setIsVisible(true)
        }
    }, [])

    if (!isVisible) {
        return null
    }

    const closePrompt = () => {
        window.sessionStorage.setItem(DISMISS_KEY, "true")
        setIsVisible(false)
    }

    return (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex justify-center px-4">
            <div className="pointer-events-auto w-full max-w-sm rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-2xl shadow-slate-900/15 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
                <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Install One Chitra</p>
                        <p className="text-xs leading-5 text-slate-600 dark:text-slate-300">
                            Buka menu <span className="inline-flex items-center gap-1 font-medium text-slate-900 dark:text-slate-50"><Share className="size-3.5" /> Share</span>,
                            lalu pilih <span className="inline-flex items-center gap-1 font-medium text-slate-900 dark:text-slate-50"><PlusSquare className="size-3.5" /> Add to Home Screen</span>.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={closePrompt}
                        aria-label="Tutup popup install PWA"
                        className="inline-flex size-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                    >
                        <X className="size-4" />
                    </button>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-slate-100/80 px-3 py-2 dark:bg-slate-900">
                    <span className="text-xs text-slate-600 dark:text-slate-300">Supaya lebih cepat dibuka seperti aplikasi.</span>
                    <Button type="button" size="sm" onClick={closePrompt}>
                        Mengerti
                    </Button>
                </div>
            </div>
        </div>
    )
}
