import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { betterFetch } from "@better-fetch/fetch"

type Session = {
    user: {
        id: string
        email: string
        name: string
        role?: string
    }
    session: {
        id: string
        expiresAt: string
    }
}

// Routes that don't require authentication
const PUBLIC_ROUTES = ["/sign-in", "/sign-up", "/api/auth", "/api/health"]

// Routes that should be completely public (static files etc.)
const PUBLIC_PREFIXES = ["/_next", "/favicon", "/logo", "/public", "/brand"]

function isPublicRoute(pathname: string): boolean {
    if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true
    if (PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(route + "/"))) return true
    return false
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    // Allow public routes and static assets through without auth check
    if (isPublicRoute(pathname)) {
        return NextResponse.next()
    }

    // Only protect dashboard routes and other authenticated areas
    if (!pathname.startsWith("/dashboard")) {
        return NextResponse.next()
    }

    try {
        // Determine the base URL for internal session check:
        // 1. Use BETTER_AUTH_URL env var (works in production/Dokploy)
        // 2. Fall back to localhost with PORT (for local dev)
        // NOTE: DO NOT use request.nextUrl.origin — on Dokploy it resolves to
        // an internal 0.0.0.0 or unreachable address behind the reverse proxy.
        const port = process.env.PORT ?? "3000"
        const envBaseURL = process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_BETTER_AUTH_URL
        const internalBaseURL = envBaseURL
            ? (envBaseURL.startsWith("http") ? envBaseURL : `https://${envBaseURL}`)
            : `http://localhost:${port}`

        const { data: session } = await betterFetch<Session>("/api/auth/get-session", {
            baseURL: internalBaseURL,
            headers: {
                cookie: request.headers.get("cookie") ?? "",
            },
        })

        if (!session?.user?.id) {
            const signInUrl = new URL("/sign-in", request.url)
            signInUrl.searchParams.set("callbackUrl", pathname)
            return NextResponse.redirect(signInUrl)
        }

        return NextResponse.next()
    } catch (err) {
        // Log the error so we can debug in production logs
        console.error("[middleware] Session check failed:", err)
        // If session check fails, redirect to sign-in for safety
        const signInUrl = new URL("/sign-in", request.url)
        signInUrl.searchParams.set("callbackUrl", pathname)
        return NextResponse.redirect(signInUrl)
    }
}

export const config = {
    matcher: [
        /*
         * Match all routes except:
         * - _next/static (static files)
         * - _next/image (image optimization)
         * - favicon.ico
         * - public folder files
         */
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
}
