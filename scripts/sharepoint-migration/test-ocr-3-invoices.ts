import "dotenv/config"
import fs from "fs"
import path from "path"
import { db } from "@/db"
import { vendorInvoices } from "@/db/schema/vendor-invoices"
import { eq } from "drizzle-orm"

/**
 * Script Uji Coba OCR 3 Lampiran Invoice SharePoint & Update Nomor PO SAP
 */

interface InvoiceTarget {
  invoiceNumber: string
  vendorName: string
  imagePath: string
}

async function runVisionOcr(imagePath: string): Promise<string> {
  const imageBuffer = fs.readFileSync(imagePath)
  const base64Image = imageBuffer.toString("base64")
  const dataUrl = `data:image/jpeg;base64,${base64Image}`

  const apiKey = process.env.OPENAI_API_KEY?.trim()
  const rawBaseUrl = process.env.OPENAI_BASE_URL?.trim() || "https://9router.chitraparatama.com/v1"
  const baseUrl = rawBaseUrl.replace(/\/$/, "")
  const endpoint = baseUrl.endsWith("/chat/completions") ? baseUrl : `${baseUrl}/chat/completions`
  const model = process.env.OPENAI_MODEL?.trim() || "cx/gpt-5.6-luna"

  const prompt = `Anda adalah ahli OCR dokumen pengadaan barang/jasa PT Chitra Paratama.
Analisis gambar faktur/invoice ini secara teliti.
Ekstrak informasi berikut dalam format JSON:
{
  "invoiceNumber": "string",
  "poNumber": "string (Nomor PO SAP / Purchase Order / Client Ref / No Pesanan, biasanya 10 digit diawali 82, 81, atau 45)",
  "vendorName": "string",
  "invoiceDate": "string",
  "grandTotal": "string",
  "taxInvoiceNumber": "string",
  "notes": "string"
}
Kembalikan HANYA JSON valid tanpa markdown atau teks pengantar.`

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: dataUrl,
              },
            },
          ],
        },
      ],
      temperature: 0.1,
    }),
    signal: AbortSignal.timeout(30000),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Vision OCR HTTP ${res.status}: ${errText}`)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content || "{}"
  return content
}

async function main() {
  console.log("🚀 Memulai Uji Coba OCR Vision untuk 3 Dokumen Lampiran Invoice...\n")

  const targets: InvoiceTarget[] = [
    {
      invoiceNumber: "4808",
      vendorName: "PT ODG INDONESIA",
      imagePath: "scripts/sharepoint-migration/ocr_samples/4808_rendered.jpg",
    },
    {
      invoiceNumber: "AJP/2610/4537",
      vendorName: "CV. APTA JAYA PRIMA",
      imagePath: "scripts/sharepoint-migration/ocr_samples/AJP_2610_4537_rendered.jpg",
    },
    {
      invoiceNumber: "MGK02601803",
      vendorName: "PT. MENTARI GRHA KENCANA",
      imagePath: "scripts/sharepoint-migration/ocr_samples/MGK02601803_rendered.jpg",
    },
  ]

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i]
    console.log(`------------------------------------------------------------------`)
    console.log(`[TEST ${i + 1}/3] Dokumen Invoice: ${t.invoiceNumber} (${t.vendorName})`)
    console.log(`Lokasi Gambar Scan: ${t.imagePath}`)

    try {
      console.log("⏳ Sedang memproses Vision OCR via AI Engine...")
      const rawJson = await runVisionOcr(t.imagePath)
      
      // Bersihkan kemungkinan markdown ```json ... ```
      const cleanJson = rawJson.replace(/```json/g, "").replace(/```/g, "").trim()
      const parsed = JSON.parse(cleanJson)

      console.log("✅ Hasil Ekstraksi OCR Berhasil:")
      console.log(JSON.stringify(parsed, null, 2))

      const detectedPo = parsed.poNumber?.trim()

      if (detectedPo && detectedPo !== "string" && detectedPo.length >= 5) {
        console.log(`🎯 Nomor PO SAP Ditemukan: ${detectedPo}`)
        
        // Update ke database vendor_invoices
        const updateResult = await db
          .update(vendorInvoices)
          .set({
            poNumber: detectedPo,
            ocrStatus: "matched",
            ocrExtractedData: parsed,
          })
          .where(eq(vendorInvoices.invoiceNumber, t.invoiceNumber))
          .returning({ id: vendorInvoices.id, invoiceNumber: vendorInvoices.invoiceNumber, poNumber: vendorInvoices.poNumber })

        console.log(`💾 Database Berhasil Diperbarui:`, updateResult)
      } else {
        console.log("⚠️ Nomor PO tidak terdeteksi secara otomatis di halaman 1 dokumen ini.")
      }
    } catch (err: any) {
      console.error(`❌ Gagal OCR untuk ${t.invoiceNumber}:`, err.message)
    }
  }

  console.log(`\n🎉 Seluruh pengujian OCR 3 dokumen selesai!`)
}

main().then(() => process.exit(0)).catch(console.error)
