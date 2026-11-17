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

interface CheckpointPhase2 {
  processedIds: string[]
  foundCount: number
  notFoundCount: number
  foundByPage: Record<number, number>
  lastUpdated: string
}

const CHECKPOINT_FILE = path.join(__dirname, "ocr_phase2_checkpoint.json")
const CACHE_DIR = path.join(__dirname, "rendered_cache_phase2")
const CONCURRENCY = 4
const PO_REGEX = /\b(82\d{8}|81\d{8}|45\d{8})\b/

function loadCheckpoint(): CheckpointPhase2 {
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
    foundByPage: { 2: 0, 3: 0, 4: 0, 5: 0 },
    lastUpdated: new Date().toISOString(),
  }
}

function saveCheckpoint(data: CheckpointPhase2) {
  data.lastUpdated = new Date().toISOString()
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2), "utf-8")
}

async function renderPdfPage(pdfPath: string, outJpgPath: string, pageNum: number): Promise<{ success: boolean; totalPages: number }> {
  return new Promise((resolve) => {
    const py = spawn("python", [
      path.join(__dirname, "render_page.py"),
      pdfPath,
      outJpgPath,
      String(pageNum),
      "1.5",
    ])
    let stdout = ""
    py.stdout.on("data", (d) => { stdout += d.toString() })
    py.on("close", (code) => {
      if (code === 0 && fs.existsSync(outJpgPath)) {
        const m = stdout.match(/SUCCESS:(\d+)/)
        const total = m ? parseInt(m[1], 10) : 1
        resolve({ success: true, totalPages: total })
      } else {
        resolve({ success: false, totalPages: 0 })
      }
    })
    py.on("error", () => resolve({ success: false, totalPages: 0 }))
  })
}

async function extractPoWithVision(imagePath: string, pageNum: number, maxRetries = 3): Promise<string | null> {
  const imageBuffer = fs.readFileSync(imagePath)
  const base64Image = imageBuffer.toString("base64")
  const dataUrl = `data:image/jpeg;base64,${base64Image}`

  const apiKey = process.env.OPENAI_API_KEY?.trim()
  const rawBaseUrl = process.env.OPENAI_BASE_URL?.trim() || "https://9router.chitraparatama.com/v1"
  const baseUrl = rawBaseUrl.replace(/\/$/, "")
  const endpoint = baseUrl.endsWith("/chat/completions") ? baseUrl : `${baseUrl}/chat/completions`
  const model = process.env.OPENAI_MODEL?.trim() || "cx/gpt-5.6-luna"

  const prompt = `Anda adalah sistem OCR cerdas dokumen lampiran faktur (Halaman ${pageNum} - Lampiran PO / BAST / DO / Work Order) PT Chitra Paratama.
Tugas Anda: Cari dan temukan NOMOR PO SAP (Purchase Order / Purchase Order No / No Pesanan / PO No / Client Ref).
Karakteristik Nomor PO SAP:
- Terdiri dari 10 digit angka persis.
- Selalu diawali dengan '82' (kontrak/jasa), '81', atau '45' (material/sparepart). Contoh: 8210010586, 8220025196, 8210010520, 4500123456.
Kembalikan respon dalam format JSON:
{
  "poNumber": "10 digit nomor PO jika ditemukan, atau kosongkan jika tidak ada",
  "confidence": "high/medium/low"
}
Kembalikan HANYA JSON tanpa format markdown.`

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
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
        signal: AbortSignal.timeout(45000),
      })

      if (!res.ok) {
        const err = await res.text()
        if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
          console.warn(`[OCR Warning] Status ${res.status} on attempt ${attempt}. Retrying in ${attempt * 3}s...`)
          await new Promise(r => setTimeout(r, attempt * 3000))
          continue
        }
        throw new Error(`HTTP ${res.status}: ${err}`)
      }

      const data = await res.json()
      const content = data.choices?.[0]?.message?.content || ""

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
        // ignore
      }

      return null
    } catch (err: any) {
      if (attempt < maxRetries) {
        console.warn(`[OCR Error Attempt ${attempt}/${maxRetries}]: ${err?.message || err}. Retrying in ${attempt * 2}s...`)
        await new Promise(r => setTimeout(r, attempt * 2000))
        continue
      }
      throw err
    }
  }

  return null
}

function safeUnlink(filePath: string) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  } catch {
    // Ignore Windows EBUSY lock
  }
}

async function processInvoicePages2To5(job: InvoiceJob): Promise<{ found: boolean; po: string | null; page: number | null }> {
  const safeId = job.id.replace(/[^a-zA-Z0-9_-]/g, "")

  // Coba halaman 2 terlebih dahulu untuk cek total pages
  const p2Jpg = path.join(CACHE_DIR, `${safeId}_p2.jpg`)
  const p2Result = await renderPdfPage(job.filePath, p2Jpg, 2)

  if (!p2Result.success || p2Result.totalPages < 2) {
    // PDF hanya 1 halaman
    safeUnlink(p2Jpg)
    return { found: false, po: null, page: null }
  }

  const maxPage = Math.min(5, p2Result.totalPages)

  // Cek Halaman 2
  try {
    const po2 = await extractPoWithVision(p2Jpg, 2)
    safeUnlink(p2Jpg)
    if (po2) {
      await db.update(vendorInvoices).set({ poNumber: po2 }).where(eq(vendorInvoices.id, job.id))
      return { found: true, po: po2, page: 2 }
    }
  } catch {
    safeUnlink(p2Jpg)
  }

  // Jika halaman 2 belum ketemu, iterasi halaman 3 s/d maxPage
  for (let page = 3; page <= maxPage; page++) {
    const pageJpg = path.join(CACHE_DIR, `${safeId}_p${page}.jpg`)
    const pageResult = await renderPdfPage(job.filePath, pageJpg, page)
    if (!pageResult.success) continue

    try {
      const po = await extractPoWithVision(pageJpg, page)
      safeUnlink(pageJpg)
      if (po) {
        await db.update(vendorInvoices).set({ poNumber: po }).where(eq(vendorInvoices.id, job.id))
        return { found: true, po, page }
      }
    } catch {
      safeUnlink(pageJpg)
    }
  }

  return { found: false, po: null, page: null }
}

async function main() {
  console.log("==================================================================")
  console.log("🚀 BATCH OCR FASE 2: SCAN HALAMAN 2 S/D 5 UNTUK SISA INVOICE")
  console.log("==================================================================\n")

  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true })
  }

  const checkpoint = loadCheckpoint()
  const processedSet = new Set<string>(checkpoint.processedIds)

  const july1 = new Date("2026-07-01T00:00:00.000Z")

  // Ambil sisa invoice yang belum memiliki PO
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

  console.log(`📦 Antrean Fase 2 siap diproses: ${queue.length}`)
  console.log(`⏩ Sudah diproses di checkpoint Fase 2: ${processedSet.size}\n`)

  if (queue.length === 0) {
    console.log("🎉 Tidak ada antrean Fase 2 yang perlu diproses. Selesai!")
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

      const result = await processInvoicePages2To5(job)

      processedSet.add(job.id)
      checkpoint.processedIds.push(job.id)

      if (result.found && result.po) {
        checkpoint.foundCount++
        checkpoint.foundByPage[result.page!] = (checkpoint.foundByPage[result.page!] || 0) + 1
        console.log(`[${jobNum}/${totalJobs} - ${progressPct}%] (W${workerId}) ✅ Inv: ${job.invoiceNumber.padEnd(22)} -> PO: ${result.po} (di Hal ${result.page})`)
      } else {
        checkpoint.notFoundCount++
        console.log(`[${jobNum}/${totalJobs} - ${progressPct}%] (W${workerId}) ⚠️  Inv: ${job.invoiceNumber.padEnd(22)} -> (PO Tidak Ditemukan di Hal 2-5 / 1 Hal Saja)`)
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
  console.log("\n==================================================================")
  console.log(`🎉 BATCH OCR FASE 2 SELESAI dalam ${elapsedSec} detik!`)
  console.log(`📊 Hasil Pemrosesan Fase 2:`)
  console.log(`   - PO SAP Baru Berhasil Ditemukan & Diupdate : ${checkpoint.foundCount}`)
  console.log(`     * Dari Halaman 2 : ${checkpoint.foundByPage[2] || 0}`)
  console.log(`     * Dari Halaman 3 : ${checkpoint.foundByPage[3] || 0}`)
  console.log(`     * Dari Halaman 4 : ${checkpoint.foundByPage[4] || 0}`)
  console.log(`     * Dari Halaman 5 : ${checkpoint.foundByPage[5] || 0}`)
  console.log(`   - Tetap Tidak Ditemukan / Dokumen 1 Hal    : ${checkpoint.notFoundCount}`)
  console.log("==================================================================")

  process.exit(0)
}

main().catch((err) => {
  console.error("Fatal Phase 2 OCR Error:", err)
  process.exit(1)
})
