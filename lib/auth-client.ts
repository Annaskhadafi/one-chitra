import { createAuthClient } from "better-auth/react";

function normalizeUrl(url?: string): string {
    if (!url) return "http://localhost:3000";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `https://${url}`;
}

export const authClient = createAuthClient({
    baseURL: normalizeUrl(process.env.NEXT_PUBLIC_BETTER_AUTH_URL),
});

export const {
    signIn,
    signUp,
    signOut,
    useSession,
    getSession,
} = authClient;