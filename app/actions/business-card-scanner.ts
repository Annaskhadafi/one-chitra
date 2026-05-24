"use server"

import { db } from "@/db"
import { businessCards } from "@/db/schema/business-cards"
import { uploadFile } from "@/app/actions/upload"
import { extractBusinessCardViaOllama } from "@/lib/ollama-business-card"
import { revalidatePath } from "next/cache"
import { desc } from "drizzle-orm"

export async function scanAndSaveBusinessCard(formData: FormData) {
    try {
        const file = formData.get("file") as File
        if (!file) {
            return { success: false, error: "No file uploaded" }
        }

        // 1. Upload the file using the centralized action
        const uploadResult = await uploadFile(formData)
        if (!uploadResult.success || !uploadResult.url) {
            return { success: false, error: uploadResult.error || "Failed to upload file" }
        }

        const imageUrl = uploadResult.url

        // 2. Perform OCR via Ollama Vision
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        const ocrResult = await extractBusinessCardViaOllama({
            fileBuffer: buffer,
            filename: file.name,
        })

        const { data } = ocrResult

        // 3. Save to database
        const inserted = await db.insert(businessCards).values({
            name: data.name || "Unknown",
            company: data.company,
            jobTitle: data.jobTitle,
            phone: data.phone,
            email: data.email,
            address: data.address,
            businessCategory: data.businessCategory,
            imageUrl: imageUrl,
        }).returning()

        revalidatePath("/dashboard/business-cards")

        return { 
            success: true, 
            data: inserted[0]
        }
    } catch (error) {
        console.error("Failed to scan business card:", error)
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
    }
}

export async function getBusinessCards() {
    try {
        const cards = await db.select().from(businessCards).orderBy(desc(businessCards.createdAt))
        return { success: true, data: cards }
    } catch (error) {
        return { success: false, error: "Failed to fetch business cards" }
    }
}
