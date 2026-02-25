import { ExternalLink } from "lucide-react"

interface SearchParams {
    url?: string
    title?: string
}

export default async function ExternalFramePage({
    searchParams,
}: {
    searchParams: Promise<SearchParams>
}) {
    const params = await searchParams
    const rawUrl = params.url ?? ""

    const normalizedUrl =
        rawUrl.startsWith("http://") || rawUrl.startsWith("https://")
            ? rawUrl
            : `https://${rawUrl.replace(/^\/+/, "")}`

    const title = params.title?.trim() || "External Website"

    const isValid = /^https?:\/\//i.test(normalizedUrl)

    if (!isValid) {
        return (
            <div className="p-6">
                <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                    URL external tidak valid.
                </div>
            </div>
        )
    }

    return (
        <div className="flex h-[calc(100vh-5rem)] flex-col gap-3 p-4">
            <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                <ExternalLink className="h-4 w-4" />
                <p className="truncate text-sm font-medium">{title}</p>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden rounded-md border">
                <iframe
                    src={normalizedUrl}
                    title={title}
                    className="h-full w-full border-0"
                    loading="lazy"
                    referrerPolicy="strict-origin-when-cross-origin"
                    sandbox="allow-forms allow-modals allow-popups allow-same-origin allow-scripts allow-downloads"
                />
            </div>
        </div>
    )
}
