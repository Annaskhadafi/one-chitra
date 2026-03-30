"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { useEffect } from "react"

function makeQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 60 * 1000,
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

    navigator.serviceWorker.register("/sw.js")
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
            <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
    )
}
