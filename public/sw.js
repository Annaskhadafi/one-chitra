self.addEventListener("push", (event) => {
    if (!event.data) {
        return
    }

    const payload = event.data.json()
    const title = payload.title || "One Chitra"

    event.waitUntil(self.registration.showNotification(title, {
        body: payload.body || "Ada notifikasi baru.",
        icon: "/icons/icon-192x192.png",
        badge: "/icons/icon-192x192.png",
        tag: payload.tag || "one-chitra-notification",
        data: {
            url: payload.url || "/dashboard",
            notificationId: payload.notificationId || null,
        },
    }))
})

self.addEventListener("notificationclick", (event) => {
    event.notification.close()
    const targetUrl = event.notification.data?.url || "/dashboard"

    event.waitUntil((async () => {
        const clients = await self.clients.matchAll({
            type: "window",
            includeUncontrolled: true,
        })

        for (const client of clients) {
            if ("focus" in client) {
                client.navigate(targetUrl)
                client.focus()
                return
            }
        }

        if (self.clients.openWindow) {
            await self.clients.openWindow(targetUrl)
        }
    })())
})
