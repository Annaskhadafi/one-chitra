"use server"

import { db } from "@/db"
import { salesDocuments } from "@/db/schema"
import { eq, desc } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { deleteFile } from "./upload"

export async function getSalesDocuments() {
    return await db.query.salesDocuments.findMany({
        with: {
            uploadedBy: true,
        },
        orderBy: [desc(salesDocuments.createdAt)],
    })
}

export async function createSalesDocument(data: {
    title: string
    description?: string | null
    fileUrl: string
    fileName: string
    fileType: string
}) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        })
        const userId = session?.user?.id

        if (!userId) {
            return { success: false, error: "Unauthorized" }
        }

        const [newDoc] = await db.insert(salesDocuments)
            .values({
                title: data.title,
                description: data.description,
                fileUrl: data.fileUrl,
                fileName: data.fileName,
                fileType: data.fileType,
                uploadedById: userId,
            })
            .returning()

        revalidatePath("/dashboard/sales-documents")
        return { success: true, data: newDoc }
    } catch (error) {
        console.error("Failed to create sales document:", error)
        return { success: false, error: "Failed to create sales document" }
    }
}

export async function updateSalesDocument(id: string, data: {
    title: string
    description?: string | null
}) {
    try {
        await db.update(salesDocuments)
            .set({
                title: data.title,
                description: data.description,
                updatedAt: new Date(),
            })
            .where(eq(salesDocuments.id, id))

        revalidatePath("/dashboard/sales-documents")
        return { success: true }
    } catch (error) {
        console.error("Failed to update sales document:", error)
        return { success: false, error: "Failed to update sales document" }
    }
}

export async function deleteSalesDocument(id: string) {
    try {
        const doc = await db.query.salesDocuments.findFirst({
            where: eq(salesDocuments.id, id),
        })

        if (!doc) {
            return { success: false, error: "Document not found" }
        }

        // Physically delete from database
        await db.delete(salesDocuments).where(eq(salesDocuments.id, id))

        // Delete file from storage
        await deleteFile(doc.fileUrl)

        revalidatePath("/dashboard/sales-documents")
        return { success: true }
    } catch (error) {
        console.error("Failed to delete sales document:", error)
        return { success: false, error: "Failed to delete sales document" }
    }
}
