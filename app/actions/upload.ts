"use server"

import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { v4 as uuidv4 } from "uuid"

export async function uploadImage(formData: FormData) {
    try {
        const file = formData.get("file") as File
        if (!file) {
            return { success: false, error: "No file uploaded" }
        }

        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        // Ensure directory exists
        const uploadDir = join(process.cwd(), "public", "uploads")
        await mkdir(uploadDir, { recursive: true })

        // Generate unique filename
        const ext = file.name.split(".").pop()
        const filename = `${uuidv4()}.${ext}`
        const filepath = join(uploadDir, filename)

        await writeFile(filepath, buffer)

        return { success: true, url: `/uploads/${filename}` }
    } catch (error) {
        console.error("Upload error:", error)
        return { success: false, error: "Failed to upload image" }
    }
}
