import { NextRequest } from "next/server";

interface TokenPayload {
    userId: string;
    email: string;
    exp: number;
}

/**
 * Verifikasi token mobile sederhana (Base64 encoded JSON)
 * Return userId jika valid, null jika tidak valid / expired
 */
export async function verifyMobileToken(req: NextRequest): Promise<string | null> {
    try {
        const authHeader = req.headers.get("authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return null;
        }

        const token = authHeader.substring(7);
        const decoded = Buffer.from(token, "base64").toString("utf-8");
        const payload: TokenPayload = JSON.parse(decoded);

        // Cek expiry
        if (payload.exp < Date.now()) {
            return null;
        }

        return payload.userId;
    } catch {
        return null;
    }
}
