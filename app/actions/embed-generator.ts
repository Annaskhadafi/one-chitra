"use server";

import { db } from "@/db";
import { embedTokens } from "@/db/schema";
import { user as userTable } from "@/db/schema/auth";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

// Cek permission admin atau role tertentu
async function checkAdminOrThrow() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });
    if (!session?.user?.id) {
        throw new Error("Unauthorized");
    }
    // Dapatkan role terbaru user
    const dbUser = await db.query.user.findFirst({
        where: (u, { eq }) => eq(u.id, session.user.id),
    });
    const roleLower = dbUser?.role?.toLowerCase() ?? "";
    if (roleLower !== "admin" && roleLower !== "superuser") {
        throw new Error("Forbidden: Admin access required");
    }
    return dbUser;
}

export async function getEmbedTokensAction() {
    await checkAdminOrThrow();
    
    return await db
        .select({
            id: embedTokens.id,
            name: embedTokens.name,
            token: embedTokens.token,
            pagePath: embedTokens.pagePath,
            userId: embedTokens.userId,
            userName: userTable.name,
            userEmail: userTable.email,
            expiresAt: embedTokens.expiresAt,
            isActive: embedTokens.isActive,
            createdAt: embedTokens.createdAt,
        })
        .from(embedTokens)
        .leftJoin(userTable, eq(embedTokens.userId, userTable.id))
        .orderBy(desc(embedTokens.createdAt));
}

export async function getEmbedUsersAction() {
    await checkAdminOrThrow();
    
    return await db
        .select({
            id: userTable.id,
            name: userTable.name,
            email: userTable.email,
            role: userTable.role,
        })
        .from(userTable)
        .where(eq(userTable.banned, false))
        .orderBy(userTable.name);
}

export async function createEmbedTokenAction(data: {
    name: string;
    pagePath: string;
    userId: string;
    expiresAt: Date | null;
}) {
    await checkAdminOrThrow();

    if (!data.name.trim()) throw new Error("Name is required");
    if (!data.pagePath.trim()) throw new Error("Target page path is required");
    if (!data.userId) throw new Error("Target user is required");

    const id = crypto.randomUUID();
    const token = crypto.randomBytes(32).toString("hex");

    await db.insert(embedTokens).values({
        id,
        name: data.name,
        token,
        pagePath: data.pagePath,
        userId: data.userId,
        expiresAt: data.expiresAt,
        isActive: true,
    });

    revalidatePath("/dashboard/settings/embed-generator");
    return { success: true, token };
}

export async function deleteEmbedTokenAction(id: string) {
    await checkAdminOrThrow();

    // Permanent Deletion
    await db.delete(embedTokens).where(eq(embedTokens.id, id));

    revalidatePath("/dashboard/settings/embed-generator");
    return { success: true };
}
