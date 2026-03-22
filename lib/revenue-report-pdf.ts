import os from "node:os"
import path from "node:path"
import { promises as fs } from "node:fs"
import puppeteer from "puppeteer"

async function resolveChromiumExecutablePath() {
    const candidates = [
        process.env.PUPPETEER_EXECUTABLE_PATH,
        process.env.CHROMIUM_PATH,
        "/usr/lib/chromium/chromium",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
    ].filter(Boolean) as string[]

    for (const candidate of candidates) {
        try {
            await fs.access(candidate)
            return candidate
        } catch {
            // Try next known path.
        }
    }

    return undefined
}

/**
 * Generates a high-fidelity PDF of the Revenue Dashboard by taking a screenshot 
 * of a dedicated snapshot page.
 */
export async function generateRevenueReportPdf(data: { period: string; [key: string]: unknown }) {
    const { period } = data
    // Use a shared fallback for development if CRON_SECRET is missing
    const token = process.env.CRON_SECRET || "one-chitra-internal-secret-2026"
    
    // In production (Dokploy/Docker), localhost:3000 might not work depending on networking.
    // We prefer an explicit APP_URL.
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const snapshotUrl = `${baseUrl}/report/revenue-snapshot?period=${period}&token=${token}`

    console.log(`[Puppeteer] Launching browser to capture: ${snapshotUrl}`)

    let browser;
    try {
        const writableRoot = process.env.XDG_CACHE_HOME || process.env.HOME || os.tmpdir()
        const chromiumUserDataDir = path.join(writableRoot, "one-chitra-chromium")
        const chromiumCrashDir = path.join(chromiumUserDataDir, "crashpad")
        const chromiumConfigDir = process.env.XDG_CONFIG_HOME || path.join(writableRoot, ".config")
        const executablePath = await resolveChromiumExecutablePath()

        process.env.HOME = process.env.HOME || writableRoot
        process.env.XDG_CONFIG_HOME = chromiumConfigDir
        process.env.XDG_CACHE_HOME = writableRoot

        await fs.mkdir(chromiumCrashDir, { recursive: true })
        await fs.mkdir(chromiumConfigDir, { recursive: true })
        await fs.mkdir(chromiumUserDataDir, { recursive: true })

        console.log(`[Puppeteer] Using executable: ${executablePath || "bundled/default"}`)
        console.log(`[Puppeteer] Writable root: ${writableRoot}`)

        browser = await puppeteer.launch({
            executablePath,
            headless: true,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--no-zygote",
                "--no-first-run",
                "--disable-features=Crashpad,Translate,AcceptCHFrame",
                `--user-data-dir=${chromiumUserDataDir}`,
                `--crash-dumps-dir=${chromiumCrashDir}`,
                "--disable-crash-reporter",
                "--disable-crashpad",
            ]
        })

        const page = await browser.newPage()
        
        // Set viewport to a standard desktop size for the dashboard
        await page.setViewport({
            width: 1280,
            height: 1600,
            deviceScaleFactor: 2, // High resolution
        })

        // 1. Navigate and wait for network to be idle (charts finished loading)
        await page.goto(snapshotUrl, {
            waitUntil: 'networkidle0',
            timeout: 60000 // 60s timeout
        })

        // 2. Wait a bit more for Recharts animations if any
        await new Promise(r => setTimeout(r, 3000))

        // 3. Calculate the actual content height to avoid splitting into A4 pages
        const height = await page.evaluate(() => {
            const root = document.getElementById("revenue-report-pdf-root")

            if (root) {
                const rect = root.getBoundingClientRect()
                return Math.ceil(Math.max(root.scrollHeight, root.clientHeight, rect.height))
            }

            const body = document.body
            return Math.ceil(Math.max(body.scrollHeight, body.offsetHeight))
        })

        console.log(`[Puppeteer] Capturing PDF with height: ${height}px`)

        const pdfBuffer = await page.pdf({
            width: '1280px',
            height: `${height}px`,
            printBackground: true,
            margin: {
                top: '0mm',
                right: '0mm',
                bottom: '0mm',
                left: '0mm'
            }
        })

        console.log(`[Puppeteer] PDF generated successfully (${pdfBuffer.length} bytes)`)
        return Buffer.from(pdfBuffer)

    } catch (error) {
        console.error("[Puppeteer] Failed to generate PDF:", error)
        throw error
    } finally {
        if (browser) {
            await browser.close()
        }
    }
}
