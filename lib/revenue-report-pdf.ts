import puppeteer from 'puppeteer'

/**
 * Generates a high-fidelity PDF of the Revenue Dashboard by taking a screenshot 
 * of a dedicated snapshot page.
 */
export async function generateRevenueReportPdf(data: { period: string }) {
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
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
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
            const body = document.body;
            const html = document.documentElement;
            return Math.max(
                body.scrollHeight, body.offsetHeight,
                html.clientHeight, html.scrollHeight, html.offsetHeight
            );
        });

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
        return pdfBuffer

    } catch (error) {
        console.error("[Puppeteer] Failed to generate PDF:", error)
        throw error
    } finally {
        if (browser) {
            await browser.close()
        }
    }
}
