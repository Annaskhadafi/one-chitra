
import { generateRevenueReportPdf } from "./lib/revenue-report-pdf"
import fs from "fs"

async function test() {
    const mockData = {
        period: "03.2026",
        targets: {
            consolidate: { revenue: 1000, forecast: 500 },
            primeProduct: { revenue: 800, forecast: 400 },
            service: { revenue: 100, forecast: 50 },
            pa: { revenue: 100, forecast: 50 },
            ma_oc: { revenue: 200, forecast: 100 },
            ma_ws: { revenue: 200, forecast: 100 },
            ma_fq: { revenue: 200, forecast: 100 },
            ma_br: { revenue: 200, forecast: 100 },
            ma_ag: { revenue: 200, forecast: 100 },
            ma_mc: { revenue: 200, forecast: 100 },
            ck: { revenue: 500, forecast: 250 },
            sis: { revenue: 500, forecast: 250 }
        },
        materials: [
            { desc: "Material A", qty: 10, revenue: 100 },
            { desc: "Material B", qty: 5, revenue: 50 }
        ],
        inventory: {
            jasum: 1000,
            kalEi: 2000,
            singapore: 3000,
            total: 6000
        }
    }

    try {
        console.log("Generating PDF...")
        const pdf = await generateRevenueReportPdf(mockData)
        fs.writeFileSync("test_report.pdf", pdf)
        console.log("PDF generated successfully: test_report.pdf")
    } catch (error) {
        console.error("PDF generation failed:", error)
    }
}

test()
