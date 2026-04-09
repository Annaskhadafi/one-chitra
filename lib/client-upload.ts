"use client"

type UploadResponse = {
    success: boolean
    url?: string
    filename?: string
    error?: string
}

function replaceFileExtension(filename: string, nextExtension: string) {
    const normalized = filename.replace(/\.[^.]+$/, "")
    return `${normalized}.${nextExtension}`
}

async function loadImageElement(file: File) {
    const objectUrl = URL.createObjectURL(file)

    try {
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
            const element = new Image()
            element.onload = () => resolve(element)
            element.onerror = () => reject(new Error("Failed to read image for upload optimization"))
            element.src = objectUrl
        })

        return image
    } finally {
        URL.revokeObjectURL(objectUrl)
    }
}

export async function optimizeImageForUpload(file: File) {
    if (!file.type.startsWith("image/")) {
        return file
    }

    if (file.type === "image/gif" || file.type === "image/svg+xml" || file.size < 1_500_000) {
        return file
    }

    try {
        const image = await loadImageElement(file)
        const maxDimension = 1800
        const scale = Math.min(1, maxDimension / Math.max(image.width, image.height))
        const width = Math.max(1, Math.round(image.width * scale))
        const height = Math.max(1, Math.round(image.height * scale))

        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height

        const context = canvas.getContext("2d")
        if (!context) {
            return file
        }

        context.drawImage(image, 0, 0, width, height)

        const blob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob(resolve, "image/jpeg", 0.82)
        })

        if (!blob || blob.size >= file.size * 0.95) {
            return file
        }

        return new File([blob], replaceFileExtension(file.name, "jpg"), {
            type: "image/jpeg",
            lastModified: Date.now(),
        })
    } catch {
        return file
    }
}

export async function uploadFileToObjectStorage(
    file: File,
    onProgress?: (progress: number) => void,
) {
    return new Promise<UploadResponse>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        const formData = new FormData()
        formData.append("file", file)

        xhr.open("POST", "/api/uploads")
        xhr.responseType = "json"

        xhr.upload.onprogress = (event) => {
            if (!event.lengthComputable) return
            onProgress?.(Math.min(99, Math.round((event.loaded / event.total) * 100)))
        }

        xhr.onerror = () => {
            reject(new Error("Network error while uploading file"))
        }

        xhr.onload = () => {
            const response = (xhr.response ?? {}) as UploadResponse

            if (xhr.status >= 200 && xhr.status < 300 && response.success) {
                onProgress?.(100)
                resolve(response)
                return
            }

            reject(new Error(response.error || "Upload failed"))
        }

        xhr.send(formData)
    })
}
