export function isServiceWorkerEnabled() {
    if (typeof window === "undefined") {
        return false
    }

    const hostname = window.location.hostname.toLowerCase()
    const isLocalhost =
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "::1" ||
        hostname.endsWith(".local")

    return !isLocalhost
}

export async function unregisterServiceWorkers() {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
        return
    }

    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map((registration) => registration.unregister()))
}
