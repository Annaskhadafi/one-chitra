import { createAuthClient } from "better-auth/react";
import { adminClient, magicLinkClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
    // Always use the current domain so it works in production without env var changes
    baseURL: typeof window !== "undefined"
        ? window.location.origin
        : (process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? "http://localhost:3000"),
    plugins: [
        adminClient(),
        magicLinkClient(),
    ],
});

export const {
    signIn,
    signUp,
    signOut,
    useSession,
    getSession,
} = authClient;