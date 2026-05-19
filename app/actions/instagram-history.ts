"use server"

import { db } from "@/db"
import { instagramImageHistory } from "@/db/schema/instagram-history"
import { getAuthenticatedSession } from "@/lib/rbac"
import { and, desc, eq, count } from "drizzle-orm"
import { uploadBase64Image } from "@/lib/upload-storage"
import { checkRateLimit } from "@/lib/rate-limiter"

export async function saveInstagramHistory(data: {
  prompt: string
  enhancedPrompt?: string
  format: string
  contentType: string
  visualStyle: string
  width: number
  height: number
  mimeType?: string
  imageBase64: string // format: data:image/png;base64,...
}) {
  const session = await getAuthenticatedSession()
  if (!session?.user?.id) throw new Error("Unauthorized")

  // Upload image to object storage
  const filename = `instagram-gen-${session.user.id}-${Date.now()}.png`
  const uploadResult = await uploadBase64Image(data.imageBase64, filename)
  if (!uploadResult?.url) throw new Error("Failed to save image to storage")

  // Calculate size
  const base64Data = data.imageBase64.split(",")[1] || data.imageBase64
  const sizeBytes = Math.round(base64Data.length * 0.75)

  // Transaction for enforcing limit and inserting new entry
  const result = await db.transaction(async (tx) => {
    const userHistoryCount = await tx
      .select({ value: count() })
      .from(instagramImageHistory)
      .where(eq(instagramImageHistory.userId, session.user.id))

    if (userHistoryCount[0].value >= 50) {
      // Delete oldest entries if exceeding limit
      const oldestEntries = await tx
        .select({ id: instagramImageHistory.id })
        .from(instagramImageHistory)
        .where(eq(instagramImageHistory.userId, session.user.id))
        .orderBy(instagramImageHistory.createdAt)
        .limit(userHistoryCount[0].value - 49) // Leave room for 1 new

      if (oldestEntries.length > 0) {
        for (const entry of oldestEntries) {
          await tx.delete(instagramImageHistory).where(eq(instagramImageHistory.id, entry.id))
        }
      }
    }

    // Insert new entry
    return await tx.insert(instagramImageHistory).values({
      userId: session.user.id,
      prompt: data.prompt,
      enhancedPrompt: data.enhancedPrompt || null,
      format: data.format,
      contentType: data.contentType,
      visualStyle: data.visualStyle,
      width: data.width,
      height: data.height,
      mimeType: data.mimeType || "image/png",
      sizeBytes,
      imageUrl: uploadResult.url,
    }).returning()
  })

  return result[0]
}

export async function getInstagramHistory() {
  const session = await getAuthenticatedSession()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const history = await db
    .select()
    .from(instagramImageHistory)
    .where(eq(instagramImageHistory.userId, session.user.id))
    .orderBy(desc(instagramImageHistory.createdAt))
    .limit(50)

  return history
}

export async function deleteInstagramHistory(id: string) {
  const session = await getAuthenticatedSession()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const result = await db
    .delete(instagramImageHistory)
    .where(
      and(
        eq(instagramImageHistory.id, id),
        eq(instagramImageHistory.userId, session.user.id)
      )
    )
    .returning()

  if (result.length === 0) {
    throw new Error("History not found or unauthorized")
  }

  return { success: true }
}

export async function clearInstagramHistory() {
  const session = await getAuthenticatedSession()
  if (!session?.user?.id) throw new Error("Unauthorized")

  await db
    .delete(instagramImageHistory)
    .where(eq(instagramImageHistory.userId, session.user.id))

  return { success: true }
}

export async function incrementDownloadCount(id: string) {
  const session = await getAuthenticatedSession()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const rateLimit = checkRateLimit(`history:download:${session.user.id}`, 60, 60_000)
  if (!rateLimit.allowed) throw new Error("Terlalu banyak unduhan ulang. Coba lagi sebentar.")

  const entry = await db
    .select({ downloadCount: instagramImageHistory.downloadCount, userId: instagramImageHistory.userId })
    .from(instagramImageHistory)
    .where(eq(instagramImageHistory.id, id))
    .limit(1)

  if (entry.length === 0 || entry[0].userId !== session.user.id) {
    return { success: false }
  }

  await db
    .update(instagramImageHistory)
    .set({ downloadCount: entry[0].downloadCount + 1 })
    .where(eq(instagramImageHistory.id, id))

  return { success: true }
}
