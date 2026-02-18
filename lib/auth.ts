import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { db } from "@/db"; // your drizzle instance
import { account, session, user, verification } from "@/db/schema/auth";

// Ensure URL has protocol prefix
function normalizeUrl(url?: string): string {
    if (!url) return "http://localhost:3000";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `https://${url}`;
}

const baseURL = normalizeUrl(process.env.BETTER_AUTH_URL);

export const auth = betterAuth({
    baseURL,
    database: drizzleAdapter(db, {
        provider: "pg",
        schema: {
            user: user,
            account: account,
            session: session,
            verification: verification,
        }
    }),
    emailAndPassword: {
        enabled: true,
    },
    plugins: [
        admin({
            defaultRole: "staff",
        }),
    ],
    trustedOrigins: [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:3003",
        "http://localhost:3004",
        "http://localhost:3005",
        baseURL,
    ].filter(Boolean),
});