import path from "path"
import { promises as fs } from "fs"
import sharp from "sharp"

export type InstagramComposeFormat = "feed" | "portrait" | "story"

export async function composeInstagramImage(input: {
    source: Buffer
    format: InstagramComposeFormat
}) {
    const target = getTargetSize(input.format)
    const templatePath = await resolveTemplatePath(input.format === "story" ? ["story.png", "Story.png"] : ["feed.png"])
    const base = await normalizeGeneratedCanvas(input.source, target.width, target.height)
    const overlay = await makeTemplateOverlay(templatePath, target.width, target.height)

    return sharp(base)
        .composite([{ input: overlay, top: 0, left: 0 }])
        .png({ quality: 100, compressionLevel: 9 })
        .toBuffer()
}

export function getInstagramComposeSize(format: InstagramComposeFormat) {
    return getTargetSize(format)
}

async function normalizeGeneratedCanvas(source: Buffer, width: number, height: number) {
    const trimmed = await sharp(source)
        .rotate()
        .trim({ background: "#ffffff", threshold: 18 })
        .resize(width, height, { fit: "cover", position: "center" })
        .png()
        .toBuffer()

    return sharp(trimmed)
        .resize(width, height, { fit: "cover", position: "center" })
        .png()
        .toBuffer()
}

async function makeTemplateOverlay(templatePath: string, width: number, height: number) {
    const metadata = await sharp(templatePath).metadata()
    if (metadata.hasAlpha) {
        return sharp(templatePath)
            .resize(width, height, { fit: "fill" })
            .png()
            .toBuffer()
    }

    const template = await sharp(templatePath)
        .resize(width, height, { fit: "fill" })
        .ensureAlpha(1)
        .raw()
        .toBuffer({ resolveWithObject: true })
    const data = template.data
    const footerStart = Math.floor(height * 0.9)
    for (let index = 0; index < data.length; index += 4) {
        const pixel = index / 4
        const x = pixel % width
        const y = Math.floor(pixel / width)
        const red = data[index]
        const green = data[index + 1]
        const blue = data[index + 2]
        const isNearWhite = red > 242 && green > 242 && blue > 242
        const keepFooterText = y >= footerStart && isNearWhite && hasColoredNeighbor(data, width, height, x, y)
        if (isNearWhite && !keepFooterText) {
            data[index + 3] = 0
        }
    }

    return sharp(data, { raw: template.info })
        .png()
        .toBuffer()
}

function hasColoredNeighbor(data: Buffer, width: number, height: number, x: number, y: number) {
    const radius = 3
    for (let offsetY = -radius; offsetY <= radius; offsetY++) {
        for (let offsetX = -radius; offsetX <= radius; offsetX++) {
            const nx = x + offsetX
            const ny = y + offsetY
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
            const index = (ny * width + nx) * 4
            const red = data[index]
            const green = data[index + 1]
            const blue = data[index + 2]
            const isNearWhite = red > 242 && green > 242 && blue > 242
            const isDark = red < 80 && green < 80 && blue < 80
            if (!isNearWhite && !isDark) return true
        }
    }
    return false
}

function getTargetSize(format: InstagramComposeFormat) {
    if (format === "story") return { width: 1080, height: 1920 }
    return { width: 1080, height: 1350 }
}

async function resolveTemplatePath(candidates: string[]) {
    for (const candidate of candidates) {
        const templatePath = path.join(process.cwd(), "public", candidate)
        try {
            await fs.access(templatePath)
            return templatePath
        } catch {
            continue
        }
    }
    throw new Error(`Template branding tidak ditemukan: ${candidates.join(" atau ")}`)
}
