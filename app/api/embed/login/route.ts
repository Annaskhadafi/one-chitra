import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { embedTokens, verification, user as userTable } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

function generateRandomString(length: number): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    const bytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
        result += chars[bytes[i] % chars.length];
    }
    return result;
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
        return new NextResponse("Missing embed token", { status: 400 });
    }

    try {
        // 1. Cari token di database
        const [tokenData] = await db
            .select()
            .from(embedTokens)
            .where(
                and(
                    eq(embedTokens.token, token),
                    eq(embedTokens.isActive, true)
                )
            )
            .limit(1);

        if (!tokenData) {
            console.warn("[Embed API] Token not found or inactive:", token);
            return new NextResponse("Invalid or revoked embed token", { status: 401 });
        }

        // Cek kedaluwarsa jika di-set
        if (tokenData.expiresAt && new Date(tokenData.expiresAt) < new Date()) {
            console.warn("[Embed API] Token has expired:", tokenData.expiresAt);
            return new NextResponse("Embed token has expired", { status: 401 });
        }

        // 2. Dapatkan data user (email) dari database
        const [userData] = await db
            .select()
            .from(userTable)
            .where(eq(userTable.id, tokenData.userId))
            .limit(1);

        if (!userData) {
            console.warn("[Embed API] User not found for token:", tokenData.userId);
            return new NextResponse("Associated service user not found", { status: 404 });
        }

        // 3. Buat verification record baru di database Drizzle untuk magic-link Better-Auth
        const magicToken = generateRandomString(32);
        const verificationId = generateRandomString(32);
        const expiresAt = new Date(Date.now() + 1000 * 60 * 5); // 5 menit token validity

        await db.insert(verification).values({
            id: verificationId,
            identifier: userData.email,
            value: magicToken,
            expiresAt,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        console.log("[Embed API] Verification token generated successfully. Redirecting via Better-Auth magicLink.");

        // 4. Redirect ke endpoint verifikasi magic link Better-Auth resmi
        // Endpoint: /api/auth/magic-link/verify?token=MAGIC_TOKEN&callbackURL=TARGET_PAGE
        const targetUrl = new URL("/api/auth/magic-link/verify", request.url);
        targetUrl.searchParams.set("token", magicToken);
        targetUrl.searchParams.set("callbackURL", tokenData.pagePath);

        // Tambahan: set cookie is_embed di response redirect untuk bypass layout sidebar/header
        const response = NextResponse.redirect(targetUrl);
        
        response.cookies.set("is_embed", "true", {
            httpOnly: false,
            secure: request.nextUrl.protocol === "https:",
            sameSite: "lax",
            path: "/",
            expires: new Date(Date.now() + 1000 * 60 * 60 * 24), // 24 jam penanda layout
        });

        return response;
    } catch (error) {
        console.error("Embed login magic-link error:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
