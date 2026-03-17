import { NextRequest, NextResponse } from "next/server"
import { getSettlementById } from "@/app/actions/cost-settlement"
import { readManagedUpload } from "@/lib/upload-storage"
import { extractUploadFilename } from "@/lib/upload-url"
import JSZip from "jszip"
import * as xlsx from "xlsx"
import { getAuthenticatedSession } from "@/lib/rbac"

const GL_MAPPING: Record<string, string> = {
    gasoline: "BBM",
    toll: "TOLL",
    parking: "PARKIR",
    meals: "MAKAN",
    maintenance: "MAINTENANCE",
    others: "LAIN",
    rapid_test: "RAPID",
    ferry: "FERRY",
    portal: "PORTAL",
    washing: "CUCI",
    escort: "PENGAWALAN",
}

type SettlementExportRow = {
    "No Settlement": string
    Tanggal: string
    Tipe: string
    Driver: string
    Kendaraan: string
    "Kategori Cost": string
    "GL Code": string
    Deskripsi: string
    Vendor: string
    Nominal: number
    "File Nota": string
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await getAuthenticatedSession("cost-settlements", "view")
    } catch {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const settlementId = Number(id)
    if (!Number.isFinite(settlementId)) {
        return NextResponse.json({ error: "Invalid ID" }, { status: 400 })
    }

    const settlement = await getSettlementById(settlementId)
    if (!settlement) {
        return NextResponse.json({ error: "Settlement not found" }, { status: 404 })
    }

    const zip = new JSZip()
    const notaFolder = zip.folder("Nota")

    const excelData: SettlementExportRow[] = []

    const cleanVehicleNumber = (settlement.vehicleNumber || "Unknown").replace(/[^a-zA-Z0-9]/g, "")
    const dateStr = settlement.settlementDate.replace(/-/g, "")

    for (const item of settlement.items) {
        const glCode = GL_MAPPING[item.costCategory] || item.costCategory.toUpperCase()

        let notaFilesStr = ""

        if (item.receipts && item.receipts.length > 0) {
            const renamedFiles: string[] = []

            for (let i = 0; i < item.receipts.length; i++) {
                const receipt = item.receipts[i]
                const filename = extractUploadFilename(receipt.fileUrl)
                if (filename) {
                    try {
                        const storedFile = await readManagedUpload(filename)
                        if (!storedFile) {
                            console.warn(`[Settlement Export] Receipt file not found: ${filename}`)
                            continue
                        }

                        const ext = filename.split('.').pop() || "jpg"
                        const newFilename = `${glCode}_${cleanVehicleNumber}_${dateStr}_${i + 1}.${ext}`

                        notaFolder?.file(newFilename, storedFile.buffer)
                        renamedFiles.push(newFilename)
                    } catch (error) {
                        console.error(`Failed to read file ${filename}:`, error)
                        // Ignore missing files or log them
                    }
                }
            }
            notaFilesStr = renamedFiles.join(", ")
        }

        excelData.push({
            "No Settlement": settlement.settlementNumber,
            "Tanggal": settlement.settlementDate,
            "Tipe": settlement.settlementType,
            "Driver": settlement.driverName || "",
            "Kendaraan": settlement.vehicleNumber || "",
            "Kategori Cost": item.costCategory,
            "GL Code": glCode,
            "Deskripsi": item.description,
            "Vendor": item.vendorName || "",
            "Nominal": Number(item.amount),
            "File Nota": notaFilesStr
        })
    }

    // Generate Excel
    const worksheet = xlsx.utils.json_to_sheet(excelData)
    const workbook = xlsx.utils.book_new()
    xlsx.utils.book_append_sheet(workbook, worksheet, "Settlement Data")
    const excelBuffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" })

    zip.file(`Settlement_${settlement.settlementNumber}.xlsx`, excelBuffer)

    const zipBuffer = await zip.generateAsync({ type: "arraybuffer" })

    return new NextResponse(zipBuffer, {
        headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="RPA_Settlement_${settlement.settlementNumber}.zip"`,
        },
    })
}
