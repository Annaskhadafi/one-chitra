import { NextRequest, NextResponse } from "next/server"
import { eq, or, desc, sql, count } from "drizzle-orm"
import { v7 as uuidv7 } from "uuid"

import { db } from "@/db"
import { rfidDamagePhotos, rfidScans } from "@/db/schema"
import { saveManagedUpload } from "@/lib/upload-storage"
import { toAbsoluteUploadDocumentUrl } from "@/lib/upload-url"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB per file

function getRequestOrigin(req: NextRequest | Request): string {
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host")
    const proto = req.headers.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https")
    if (host) {
        return `${proto}://${host}`
    }
    if ("nextUrl" in req && (req as NextRequest).nextUrl?.origin) {
        return (req as NextRequest).nextUrl.origin
    }
    try {
        if (req.url) {
            return new URL(req.url).origin
        }
    } catch {}
    return "http://localhost:3000"
}

function normalizeFileExtension(filename: string, mimeType?: string): string {
    const ext = filename.split(".").pop()?.trim().toLowerCase()
    if (ext && ["jpg", "jpeg", "png", "webp", "gif", "heic"].includes(ext)) {
        return ext === "jpeg" ? "jpg" : ext
    }
    if (mimeType?.includes("png")) return "png"
    if (mimeType?.includes("webp")) return "webp"
    return "jpg"
}

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData()
        const rawSn = formData.get("sn")?.toString().trim()

        if (!rawSn) {
            return NextResponse.json(
                {
                    status: "ERROR",
                    message: "Field 'sn' wajib diisi",
                },
                { status: 400 },
            )
        }

        const cleanSn = rawSn.trim().toUpperCase()

        // Gather all image files from possible keys
        const candidateKeys = ["images", "images[]", "image", "file", "files", "files[]"]
        const uploadedFiles: File[] = []

        for (const key of candidateKeys) {
            const items = formData.getAll(key)
            for (const item of items) {
                if (item instanceof File && item.size > 0) {
                    uploadedFiles.push(item)
                }
            }
        }

        if (uploadedFiles.length === 0) {
            return NextResponse.json(
                {
                    status: "ERROR",
                    message: "File gambar wajib diunggah",
                },
                { status: 400 },
            )
        }

        // Validate file size (10 MB limit)
        for (const file of uploadedFiles) {
            if (file.size > MAX_FILE_SIZE) {
                return NextResponse.json(
                    {
                        status: "ERROR",
                        message: "File terlalu besar",
                    },
                    { status: 400 },
                )
            }
        }

        const origin = getRequestOrigin(req)

        // Find existing scan in rfid_scans if already registered
        const existingScan = await db.query.rfidScans.findFirst({
            where: or(
                eq(rfidScans.serialNumber, cleanSn),
                eq(rfidScans.epc, cleanSn),
                eq(rfidScans.tagId, cleanSn),
            ),
        })

        // Count existing photos for this SN to calculate sequential damage index
        const existingPhotosForSn = await db.query.rfidDamagePhotos.findMany({
            where: eq(rfidDamagePhotos.sn, cleanSn),
        })
        let snDamageCounter = existingPhotosForSn.length

        // Get total count of damage photos to generate pretty sequential IDs (e.g. ph_001, ph_002)
        const [countResult] = await db.select({ total: count() }).from(rfidDamagePhotos)
        let globalCounter = Number(countResult?.total || 0)

        const results: Array<{
            id: string
            filename: string
            url: string
        }> = []

        const newPhotoIds: string[] = []

        for (const file of uploadedFiles) {
            snDamageCounter += 1
            globalCounter += 1

            const ext = normalizeFileExtension(file.name, file.type)
            const displayFilename = `${cleanSn}_damage_${snDamageCounter}.${ext}`
            const uniqueStorageFilename = `${cleanSn}_damage_${snDamageCounter}_${uuidv7().slice(0, 8)}.${ext}`

            const fileBytes = await file.arrayBuffer()
            const fileBuffer = Buffer.from(fileBytes)

            // Save to S3 / persistent managed upload storage
            const savedUpload = await saveManagedUpload({
                filename: uniqueStorageFilename,
                buffer: fileBuffer,
                contentType: file.type || `image/${ext}`,
            })

            // Format sequential ID (e.g. ph_001, ph_002) with unique fallback check
            let candidateId = `ph_${String(globalCounter).padStart(3, "0")}`
            const duplicateCheck = await db.query.rfidDamagePhotos.findFirst({
                where: eq(rfidDamagePhotos.photoId, candidateId),
            })
            if (duplicateCheck) {
                candidateId = `ph_${String(globalCounter).padStart(3, "0")}_${uuidv7().slice(0, 4)}`
            }

            const publicUrl = `${origin}/api/uploads/${savedUpload.filename}`

            // Insert into rfid_damage_photos table
            await db.insert(rfidDamagePhotos).values({
                photoId: candidateId,
                sn: cleanSn,
                filename: displayFilename,
                url: publicUrl,
                fileSize: file.size,
                mimeType: file.type || `image/${ext}`,
                rfidScanId: existingScan?.id ?? null,
                createdAt: new Date(),
            })

            newPhotoIds.push(candidateId)
            results.push({
                id: candidateId,
                filename: displayFilename,
                url: publicUrl,
            })
        }

        // If existing scan found, update damage_photos array in rfid_scans
        if (existingScan) {
            const currentDamagePhotos: string[] = Array.isArray(existingScan.damagePhotos)
                ? (existingScan.damagePhotos as string[])
                : []
            const combinedDamagePhotos = Array.from(new Set([...currentDamagePhotos, ...newPhotoIds]))

            await db
                .update(rfidScans)
                .set({
                    damagePhotos: combinedDamagePhotos,
                })
                .where(eq(rfidScans.id, existingScan.id))
        }

        return NextResponse.json({
            status: "OK",
            sn: cleanSn,
            result: results,
        })
    } catch (error) {
        console.error("Failed to upload RFID damage photo:", error)
        return NextResponse.json(
            {
                status: "ERROR",
                message: error instanceof Error ? error.message : "Gagal mengunggah foto kerusakan",
            },
            { status: 500 },
        )
    }
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const snParam = searchParams.get("sn")?.trim()

        if (!snParam) {
            // Return latest 100 uploaded damage photos if sn is omitted
            const allPhotos = await db.query.rfidDamagePhotos.findMany({
                orderBy: [desc(rfidDamagePhotos.createdAt)],
                limit: 100,
            })

            return NextResponse.json({
                status: "OK",
                count: allPhotos.length,
                result: allPhotos.map((p: typeof rfidDamagePhotos.$inferSelect) => ({
                    id: p.photoId,
                    sn: p.sn,
                    filename: p.filename,
                    url: p.url,
                    createdAt: p.createdAt,
                })),
            })
        }

        const cleanSn = snParam.toUpperCase()
        const photos = await db.query.rfidDamagePhotos.findMany({
            where: eq(rfidDamagePhotos.sn, cleanSn),
            orderBy: [desc(rfidDamagePhotos.id)],
        })

        return NextResponse.json({
            status: "OK",
            sn: cleanSn,
            count: photos.length,
            result: photos.map((p: typeof rfidDamagePhotos.$inferSelect) => ({
                id: p.photoId,
                filename: p.filename,
                url: p.url,
            })),
        })
    } catch (error) {
        console.error("Failed to fetch RFID damage photos:", error)
        return NextResponse.json(
            {
                status: "ERROR",
                message: "Gagal mengambil data foto kerusakan",
            },
            { status: 500 },
        )
    }
}
