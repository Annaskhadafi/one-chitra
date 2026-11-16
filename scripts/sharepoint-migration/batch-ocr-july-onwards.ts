import "dotenv/config"
import fs from "fs"
import path from "path"
import { spawn } from "child_process"
import { db } from "@/db"
import { vendorInvoices } from "@/db/schema/vendor-invoices"
import { eq } from "drizzle-orm"
import { findExistingUploadFilePath } from "@/lib/upload-storage"

interface InvoiceJob {
  id: string
  invoiceNumber: string
  poNumber: string
  invoiceFileUrl: string
  filePath: string
}

interface CheckpointData {
  processedIds: string[]
  foundCount: number
  notFoundCount: number
  failedCount: number
  lastUpdated: string
}

const CHECKPOINT_FILE = path.join(__dirname, "ocr_batch_checkpoint.json")
const CACHE_DIR = path.join(__dirname, "rendered_cache")
const CONCURRENCY = 4

function loadCheckpoint(): CheckpointData {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, "utf-8"))
    } catch {
      // ignore
    }
  }
  return {
    processedIds: [],
    foundCount: 0,
    notFoundCount: 0,
    failedCount: 0,
    lastUpdated: new Date().toISOString(),
  }
}

function saveCheckpoint(data: CheckpointData) {
  data.lastUpdated = new Date().toISOString()
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2), "utf-8")
}

async function renderPdfPage(pdfPath: string, outJpgPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const py = spawn("python", [
      path.join(__dirname, "render_page.py"),
      pdfPath,
      outJpgPath,
      "1.5",
    ])
    py.on("close", (code) => {
      resolve(code === 0 && fs.existsSync(outJpgPath))
    })
    py.on("error", () => resolve(false))
  })
}

const PO_REGEX = /\b(82\d{8}|81\d{8}|45\d{8})\b/

async function extractPoWithVision(imagePath: string): Promise<string | null> {
  const imageBuffer = fs.readFileSync(imagePath)
  const base64Image = imageBuffer.toString("base64")
  const dataUrl = `data:image/jpeg;base64,${base64Image}`

  const apiKey = process.env.OPENAI_API_KEY?.trim()
  const rawBaseUrl = process.env.OPENAI_BASE_URL?.trim() || "https://9router.chitraparatama.com/v1"
  const baseUrl = rawBaseUrl.replace(/\/$/, "")
  const endpoint = baseUrl.endsWith("/chat/completions") ? baseUrl : `${baseUrl}/chat/completions`
  const model = process.env.OPENAI_MODEL?.trim() || "cx/gpt-5.6-luna"

  const prompt = `Anda adalah sistem OCR cerdas dokumen faktur PT Chitra Paratama.
Tugas Anda: Cari dan temukan NOMOR PO SAP (Purchase Order / No Pesanan / PO No / Client Ref).
Karakteristik Nomor PO SAP:
- Terdiri dari 10 digit angka persis.
- Selalu diawali dengan '82' (kontrak/jasa), '81', atau '45' (material/sparepart). Contoh: 8210010586, 8220025196, 8210010520, 4500123456.
Kembalikan respon dalam format JSON:
{
  "poNumber": "10 digit nomor PO jika ditemukan, atau kosongkan jika tidak ada",
  "confidence": "high/medium/low"
}
Kembalikan HANYA JSON tanpa format markdown.`

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
    signal: AbortSignal.timeout(35000),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`HTTP ${res.status}: ${err}`)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content || ""

  // Cari pola 10 digit PO di dalam teks content
  const regexMatch = content.match(PO_REGEX)
  if (regexMatch) {
    return regexMatch[1]
  }

  try {
    const cleaned = content.replace(/```json/g, "").replace(/```/g, "").trim()
    const parsed = JSON.parse(cleaned)
    if (parsed.poNumber && PO_REGEX.test(parsed.poNumber)) {
      return parsed.poNumber.match(PO_REGEX)![1]
    }
  } catch {
    // ignore parse error
  }

  return null
}

async function processInvoice(job: InvoiceJob): Promise<{ success: boolean; po: string | null }> {
  const safeId = job.id.replace(/[^a-zA-Z0-9_-]/g, "")
  const jpgPath = path.join(CACHE_DIR, `${safeId}.jpg`)

  try {
    // 1. Render halaman 1
    const rendered = await renderPdfPage(job.filePath, jpgPath)
    if (!rendered) {
      return { success: false, po: null }
    }

    // 2. Scan dengan Vision OCR
    const detectedPo = await extractPoWithVision(jpgPath)

    // 3. Hapus cache image agar menghemat disk space
    if (fs.existsSync(jpgPath)) {
      try {
        fs.unlinkSync(jpgPath)
      } catch {
        // ignore
      }
    }

    if (detectedPo) {
      // 4. Update Database
      await db.update(vendorInvoices)
        .set({ poNumber: detectedPo })
        .where(eq(vendorInvoices.id, job.id))
      return { success: true, po: detectedPo }
    }

    return { success: true, po: null }
  } catch (error) {
    // Hapus cache image jika error
    if (fs.existsSync(jpgPath)) {
      try {
        fs.unlinkSync(jpgPath)
      } catch {
        // ignore
      }
    }
    return { success: false, po: null }
  }
}

async function main() {
  console.log("==========================================================")
  console.log("🚀 BATCH OCR VISION SCAN: INVOICE JULI 2026 S/D SEKARANG")
  console.log("==========================================================\n")

  fs.makedirs = fs.mkdirSync
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true })
  }

  const checkpoint = loadCheckpoint()
  const processedSet = new Set<string>(checkpoint.processedIds)

  const july1 = new Date("2026-07-01T00:00:00.000Z")

  // Ambil target invoice dari DB
  const allInvoices = await db.select({
    id: vendorInvoices.id,
    invoiceNumber: vendorInvoices.invoiceNumber,
    poNumber: vendorInvoices.poNumber,
    createdAt: vendorInvoices.createdAt,
    invoiceDate: vendorInvoices.invoiceDate,
    invoiceFileUrl: vendorInvoices.invoiceFileUrl,
  }).from(vendorInvoices)

  const candidates = allInvoices.filter((inv) => {
    const dCreated = inv.createdAt ? new Date(inv.createdAt) : null
    const dInv = inv.invoiceDate ? new Date(inv.invoiceDate) : null
    const isJuly = (dCreated && dCreated >= july1) || (dInv && dInv >= july1)
    const isPoValid = PO_REGEX.test((inv.poNumber || "").trim())
    return isJuly && !isPoValid
  })

  console.log(`📋 Total invoice Juli - sekarang yang belum memiliki PO: ${candidates.length}`)

  // Siapkan antrean kerja yang memiliki file fisik di disk
  const queue: InvoiceJob[] = []
  for (const inv of candidates) {
    if (processedSet.has(inv.id)) continue
    if (!inv.invoiceFileUrl) continue

    const localFile = findExistingUploadFilePath(inv.invoiceFileUrl)
    if (localFile && fs.existsSync(localFile.filePath)) {
      queue.push({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        poNumber: inv.poNumber,
        invoiceFileUrl: inv.invoiceFileUrl,
        filePath: localFile.filePath,
      })
    }
  }

  console.log(`📦 Antrean siap diproses (belum pernah diproses & berkas tersedia): ${queue.length}`)
  console.log(`⏩ Sudah diproses di sesi sebelumnya: ${processedSet.size}\n`)

  if (queue.length === 0) {
    console.log("🎉 Tidak ada antrean yang perlu diproses. Selesai!")
    process.exit(0)
  }

  const totalJobs = queue.length
  let currentIndex = 0
  const startTime = Date.now()

  async function worker(workerId: number) {
    while (true) {
      const jobIdx = currentIndex++
      if (jobIdx >= queue.length) break

      const job = queue[jobIdx]
      const jobNum = jobIdx + 1
      const progressPct = ((jobNum / totalJobs) * 100).toFixed(1)

      const result = await processInvoice(job)

      processedSet.add(job.id)
      checkpoint.processedIds.push(job.id)

      if (result.success && result.po) {
        checkpoint.foundCount++
        console.log(`[${jobNum}/${totalJobs} - ${progressPct}%] (W${workerId}) ✅ Inv: ${job.invoiceNumber.padEnd(20)} -> PO SAP: ${result.po}`)
      } else if (result.success && !result.po) {
        checkpoint.notFoundCount++
        console.log(`[${jobNum}/${totalJobs} - ${progressPct}%] (W${workerId}) ⚠️  Inv: ${job.invoiceNumber.padEnd(20)} -> (PO Tidak Tertulis di Hal 1)`)
      } else {
        checkpoint.failedCount++
        console.log(`[${jobNum}/${totalJobs} - ${progressPct}%] (W${workerId}) ❌ Inv: ${job.invoiceNumber.padEnd(20)} -> (Error render/OCR)`)
      }

      if (jobNum % 5 === 0 || jobNum === totalJobs) {
        saveCheckpoint(checkpoint)
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1))
  await Promise.all(workers)

  saveCheckpoint(checkpoint)

  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(0)
  console.log("\n==========================================================")
  console.log(`🎉 BATCH OCR SELESAI dalam ${elapsedSec} detik!`)
  console.log(`📊 Hasil Pemrosesan:`)
  console.log(`   - PO SAP Berhasil Ditemukan & Diupdate : ${checkpoint.foundCount}`)
  console.log(`   - Tidak Ada PO di Halaman 1           : ${checkpoint.notFoundCount}`)
  console.log(`   - Gagal / Error                      : ${checkpoint.failedCount}`)
  console.log("==========================================================")

  process.exit(0)
}

main().catch((err) => {
  console.error("Fatal Batch OCR Error:", err)
  process.exit(1)
})
