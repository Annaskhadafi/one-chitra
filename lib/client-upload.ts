"use client"

import { uploadFile } from "@/app/actions/upload"

type UploadResponse = {
    success: boolean
    url?: string
    filename?: string
    error?: string
}

const MAX_MANUAL_GR_DOCUMENT_SIZE = 30 * 1024 * 1024 // 30 MB
const IMAGE_FILE_EXTENSION = /\.(?:avif|bmp|gif|heic|heif|jpe?g|png|svg|tiff?|webp)$/i

export function validateManualGrDocument(file: File) {
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name)
    const isImage = file.type.startsWith("image/") || IMAGE_FILE_EXTENSION.test(file.name)

    if (!isPdf && !isImage) {
        return "Dokumen harus berupa PDF atau gambar."
    }

    if (file.size > MAX_MANUAL_GR_DOCUMENT_SIZE) {
        return "Ukuran dokumen maksimal 30 MB."
    }

    return null
}

function replaceFileExtension(filename: string, nextExtension: string) {
    const normalized = filename.replace(/\.[^.]+$/, "")
    return `${normalized}.${nextExtension}`
}

export async function optimizeImageForUpload(file: File): Promise<File> {
    if (!file.type.startsWith("image/")) {
        return file
    }

    // Skip GIFs, SVGs, or already small images (< 1MB)
    if (file.type === "image/gif" || file.type === "image/svg+xml" || file.size < 1_000_000) {
        return file
    }

    // 1. Try modern createImageBitmap (fast, background thread, handles EXIF orientation)
    if (typeof window !== "undefined" && typeof window.createImageBitmap === "function") {
        try {
            const bitmap = await window.createImageBitmap(file)
            const maxDimension = 1920
            const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
            const width = Math.max(1, Math.round(bitmap.width * scale))
            const height = Math.max(1, Math.round(bitmap.height * scale))

            const canvas = document.createElement("canvas")
            canvas.width = width
            canvas.height = height

            const ctx = canvas.getContext("2d")
            if (ctx) {
                ctx.drawImage(bitmap, 0, 0, width, height)
                bitmap.close()

                const blob = await new Promise<Blob | null>((resolve) => {
                    canvas.toBlob(resolve, "image/jpeg", 0.82)
                })

                if (blob && blob.size < file.size * 0.95) {
                    return new File([blob], replaceFileExtension(file.name, "jpg"), {
                        type: "image/jpeg",
                        lastModified: Date.now(),
                    })
                }
            } else {
                bitmap.close()
            }
        } catch {
            // Fall through to HTMLImageElement fallback
        }
    }

    // 2. Fallback: HTMLImageElement with safe object URL lifecycle
    return new Promise<File>((resolve) => {
        const objectUrl = URL.createObjectURL(file)
        const img = new Image()

        img.onload = () => {
            try {
                const maxDimension = 1920
                const scale = Math.min(1, maxDimension / Math.max(img.width, img.height))
                const width = Math.max(1, Math.round(img.width * scale))
                const height = Math.max(1, Math.round(img.height * scale))

                const canvas = document.createElement("canvas")
                canvas.width = width
                canvas.height = height

                const ctx = canvas.getContext("2d")
                if (!ctx) {
                    URL.revokeObjectURL(objectUrl)
                    resolve(file)
                    return
                }

                ctx.drawImage(img, 0, 0, width, height)
                URL.revokeObjectURL(objectUrl)

                canvas.toBlob((blob) => {
                    if (blob && blob.size < file.size * 0.95) {
                        resolve(
                            new File([blob], replaceFileExtension(file.name, "jpg"), {
                                type: "image/jpeg",
                                lastModified: Date.now(),
                            })
                        )
                    } else {
                        resolve(file)
                    }
                }, "image/jpeg", 0.82)
            } catch {
                URL.revokeObjectURL(objectUrl)
                resolve(file)
            }
        }

        img.onerror = () => {
            URL.revokeObjectURL(objectUrl)
            resolve(file)
        }

        img.src = objectUrl
    })
}

/**
 * Resilient upload function that:
 * 1. Attempts XHR upload to /api/uploads for smooth progress feedback (0 - 90%).
 * 2. Automatically falls back to Next.js Server Action (uploadFile) if XHR fails
 *    or is rejected by corporate proxies, firewalls, or reverse-proxy size limits.
 */
export async function uploadFileToObjectStorage(
    file: File,
    onProgress?: (progress: number) => void,
): Promise<UploadResponse> {
    const formData = new FormData()
    formData.append("file", file)

    // Attempt 1: Upload via XHR to /api/uploads (supports fine-grained progress)
    try {
        const xhrResult = await new Promise<UploadResponse>((resolve, reject) => {
            const xhr = new XMLHttpRequest()
            xhr.open("POST", "/api/uploads")
            xhr.timeout = 20000 // 20 seconds

            xhr.upload.onprogress = (event) => {
                if (!event.lengthComputable) return
                // Map client-to-server transmission to 0% - 90%
                const percent = Math.min(90, Math.round((event.loaded / event.total) * 90))
                onProgress?.(percent)
            }

            xhr.upload.onload = () => {
                // When client finishes sending bytes, show processing
                onProgress?.(92)
            }

            xhr.onerror = () => {
                reject(new Error("Network error during XHR upload"))
            }

            xhr.ontimeout = () => {
                reject(new Error("Upload request timed out"))
            }

            xhr.onload = () => {
                onProgress?.(95)
                let responseData: UploadResponse | null = null

                try {
                    responseData = typeof xhr.response === "string"
                        ? JSON.parse(xhr.response)
                        : xhr.response
                } catch {
                    responseData = null
                }

                if (xhr.status >= 200 && xhr.status < 300 && responseData?.success) {
                    onProgress?.(100)
                    resolve(responseData)
                    return
                }

                const errorMessage = responseData?.error || `Upload HTTP ${xhr.status}`
                reject(new Error(errorMessage))
            }

            xhr.send(formData)
        })

        return xhrResult
    } catch (xhrError) {
        console.warn("[ClientUpload] /api/uploads failed, falling back to Server Action uploadFile:", xhrError)
        onProgress?.(95)
    }

    // Attempt 2 (Fallback): Upload via Server Action uploadFile
    // Server Actions bypass client-side proxy blocks, CORS, and have 50MB limit
    try {
        onProgress?.(96)
        const serverActionResult = await uploadFile(formData)

        if (serverActionResult.success && serverActionResult.url) {
            onProgress?.(100)
            return {
                success: true,
                url: serverActionResult.url,
            }
        }

        return {
            success: false,
            error: serverActionResult.error || "Gagal mengunggah file melalui server action",
        }
    } catch (serverActionError) {
        console.error("[ClientUpload] Server action fallback also failed:", serverActionError)
        return {
            success: false,
            error: serverActionError instanceof Error
                ? serverActionError.message
                : "Gagal mengunggah file. Silakan periksa koneksi internet Anda.",
        }
    }
}
