import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { user } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcryptjs from "bcryptjs";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { email, password } = body;

        if (!email || !password) {
            return NextResponse.json({ error: "Email dan password wajib diisi" }, { status: 400 });
        }

        // Cari user berdasarkan email
        const users = await db.select().from(user).where(eq(user.email, email)).limit(1);

        if (users.length === 0) {
            return NextResponse.json({ error: "Email atau password salah" }, { status: 401 });
        }

        const foundUser = users[0];

        // Verifikasi password
        const isValid = await bcryptjs.compare(password, foundUser.password ?? "");
        if (!isValid) {
            return NextResponse.json({ error: "Email atau password salah" }, { status: 401 });
        }

        // Buat session token sederhana (base64 user id + timestamp)
        const tokenPayload = {
            userId: foundUser.id,
            email: foundUser.email,
            exp: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 hari
        };
        const token = Buffer.from(JSON.stringify(tokenPayload)).toString("base64");

        return NextResponse.json({
            token,
            user: {
                id: foundUser.id,
                name: foundUser.name,
                email: foundUser.email,
            },
        });
    } catch (error) {
        console.error("[mobile/auth] Error:", error);
        return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
    }
}
