import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, magicLink } from "better-auth/plugins";
import { db } from "@/db"; // your drizzle instance
import { account, session, user, verification } from "@/db/schema/auth";
import { sendMagicLinkEmail, sendTemplatedEmail } from "@/lib/email";
import bcrypt from "bcryptjs";

// Ensure URL has protocol prefix
function normalizeUrl(url?: string): string {
    if (!url) return "http://localhost:3000";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `https://${url}`;
}

// Use BETTER_AUTH_URL; if it's still localhost but NEXT_PUBLIC var is production, prefer that
function resolveBaseURL(): string {
    const primary = process.env.BETTER_AUTH_URL;
    const fallback = process.env.NEXT_PUBLIC_BETTER_AUTH_URL;

    const primaryNorm = normalizeUrl(primary);
    const fallbackNorm = normalizeUrl(fallback);

    // If primary is localhost but fallback is a real domain, use fallback
    if (
        (primaryNorm.includes("localhost") || !primary) &&
        fallback &&
        !fallbackNorm.includes("localhost")
    ) {
        return fallbackNorm;
    }
    return primaryNorm;
}

const baseURL = resolveBaseURL();

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
        password: {
            hash: async (password) => {
                return await bcrypt.hash(password, 10);
            },
            verify: async ({ hash, password }) => {
                return await bcrypt.compare(password, hash);
            },
        },
        sendResetPassword: async ({ user: u, url }) => {
            await sendTemplatedEmail(u.email, "password_reset", {
                resetUrl: url,
                userName: u.name ?? u.email,
                appName: "One Chitra",
                expiresIn: "1 hour",
            });
        },
    },
    plugins: [
        admin({
            defaultRole: "staff",
        }),
        magicLink({
            sendMagicLink: async ({ email, url }) => {
                // Try to get user name from DB for personalisation
                const dbUser = await db.query.user.findFirst({
                    where: (u, { eq }) => eq(u.email, email),
                });
                await sendMagicLinkEmail(email, url, dbUser?.name ?? undefined);
            },
        }),
    ],
    trustedOrigins: [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:3003",
        "http://localhost:3004",
        "http://localhost:3005",
        "https://satu.chitraparatama.com",
        baseURL,
        process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
    ].filter(Boolean) as string[],
});