import puppeteer from 'puppeteer'

/**
 * Generates a high-fidelity PDF of the Revenue Dashboard by taking a screenshot 
 * of a dedicated snapshot page.
 */
export async function generateRevenueReportPdf(data: { period: string }) {
    const { period } = data
    const token = process.env.CRON_SECRET || ""
    
    // In production (Dokploy/Docker), localhost:3000 might not work depending on networking.
    // We prefer an explicit APP_URL.
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const snapshotUrl = `${baseUrl}/report/revenue-snapshot?period=${period}&token=${token}&range=this-month`

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

        // Navigate and wait for network to be idle (charts finished loading)
        await page.goto(snapshotUrl, {
            waitUntil: 'networkidle0',
            timeout: 60000 // 60s timeout
        })

        // Wait a bit more for Recharts animations if any
        await new Promise(r => setTimeout(r, 2000))

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '10mm',
                right: '10mm',
                bottom: '10mm',
                left: '10mm'
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
