"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import dynamic from "next/dynamic"

const ReactQueryDevtools = dynamic(
    () => import("@tanstack/react-query-devtools").then((mod) => mod.ReactQueryDevtools),
    { ssr: false }
)
import { useEffect } from "react"
import { PwaInstallPrompt } from "@/components/pwa-install-prompt"
import { isServiceWorkerEnabled, unregisterServiceWorkers } from "@/lib/service-worker"

function makeQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 60 * 1000,
                refetchOnWindowFocus: false,
                refetchOnMount: false,
                retry: 1,
            },
        },
    })
}

let browserQueryClient: QueryClient | undefined = undefined

function getQueryClient() {
    if (typeof window === "undefined") {
        return makeQueryClient()
    }

    if (!browserQueryClient) {
        browserQueryClient = makeQueryClient()
    }

    return browserQueryClient
}

function syncServiceWorkerRegistration() {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
        return
    }

    if (!isServiceWorkerEnabled()) {
        void unregisterServiceWorkers()
        return
    }

    fetch("/sw.js", {
        method: "HEAD",
        cache: "no-store",
    })
        .then((response) => {
            if (!response.ok) {
                return
            }

            return navigator.serviceWorker.register("/sw.js")
        })
        .catch((error) => {
            console.error("Failed to register service worker:", error)
        })
}

export function Providers({ children }: { children: React.ReactNode }) {
    const queryClient = getQueryClient()

    useEffect(() => {
        syncServiceWorkerRegistration()
    }, [])

    return (
        <QueryClientProvider client={queryClient}>
            {children}
            <PwaInstallPrompt />
            <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
    )
}
