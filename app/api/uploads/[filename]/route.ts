import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ filename: string }> }
) {
    const { filename } = await params;
    // In Next.js standalone mode, process.cwd() = /app/.next/standalone
    // so this resolves to /app/.next/standalone/public/uploads/<filename>
    // which matches the Dokploy Volume Mount container path
    const filePath = join(process.cwd(), "public", "uploads", filename);

    if (!existsSync(filePath)) {
        return new NextResponse("File not found", { status: 404 });
    }

    try {
        const fileBuffer = await readFile(filePath);

        // Determine Content-Type based on extension
        const ext = filename.split('.').pop()?.toLowerCase();
        let contentType = "application/octet-stream";
        if (ext === "jpg" || ext === "jpeg") contentType = "image/jpeg";
        else if (ext === "png") contentType = "image/png";
        else if (ext === "gif") contentType = "image/gif";
        else if (ext === "webp") contentType = "image/webp";
        else if (ext === "pdf") contentType = "application/pdf";

        return new NextResponse(new Uint8Array(fileBuffer), {
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        });
    } catch (error) {
        console.error("[ServeFile] Error reading file:", error);
        return new NextResponse("Error reading file", { status: 500 });
    }
}
