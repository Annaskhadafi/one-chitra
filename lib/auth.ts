import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, magicLink } from "better-auth/plugins";
import { db } from "@/db"; // your drizzle instance
import { account, session, user, verification } from "@/db/schema/auth";
import { sendMagicLinkEmail, sendPasswordResetEmail } from "@/lib/email";
import { getCanonicalAppUrl } from "@/lib/app-url";
import bcrypt from "bcryptjs";

const MIN_AUTH_SECRET_LENGTH = 32;

function shouldEnforceStrictAuthSecret(): boolean {
    const value = process.env.BETTER_AUTH_ENFORCE_STRICT_SECRET?.toLowerCase().trim();
    return value === "1" || value === "true" || value === "yes";
}

function validateBetterAuthSecret(): void {
    if (!shouldEnforceStrictAuthSecret()) {
        return;
    }

    const secret = process.env.BETTER_AUTH_SECRET?.trim() ?? "";
    const isPlaceholder = [
        "your_secret_key_here",
        "generate-a-very-secure-32-character-key",
    ].includes(secret);
    const isWeak = !secret || secret.length < MIN_AUTH_SECRET_LENGTH || isPlaceholder;

    if (!isWeak) {
        return;
    }

    const message =
        `BETTER_AUTH_SECRET must be set to a high-entropy value with at least ${MIN_AUTH_SECRET_LENGTH} characters.` +
        " Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"";

    throw new Error(message);
}

// Ensure URL has protocol prefix
function normalizeUrl(url?: string): string {
    if (!url) return getCanonicalAppUrl();
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
validateBetterAuthSecret();

export const auth = betterAuth({
    secret: process.env.BETTER_AUTH_SECRET,
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
            await sendPasswordResetEmail(u.email, url, u.name ?? u.email);
        },
    },
    plugins: [
        admin({
            defaultRole: "staff",
        }),
        magicLink({
            expiresIn: 60 * 15,
            disableSignUp: true,
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
        getCanonicalAppUrl(),
        "https://satu.chitraparatama.com",
        baseURL,
        process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
    ].filter(Boolean) as string[],
});
