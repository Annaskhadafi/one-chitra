import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { findExistingUploadFilePath } from "@/lib/upload-storage";
import { extractUploadFilename } from "@/lib/upload-url";

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ filename: string }> }
) {
    const { filename: rawFilename } = await params;
    const filename = extractUploadFilename(rawFilename);
    const resolvedFile = findExistingUploadFilePath(filename);

    if (!filename || !resolvedFile) {
        return new NextResponse("File not found", { status: 404 });
    }

    try {
        const fileBuffer = await readFile(resolvedFile.filePath);

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
