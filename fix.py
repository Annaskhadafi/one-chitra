import os

filepath = r'd:\[01] PROJECT\one-chitra\app\dashboard\competitor-info-new\_components\monthly-report-tab.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

target = '''    businessImpact: string
    for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size))
    return chunks
}'''

replacement = r'''    businessImpact: string
    strategy: string
    description: string
}

type LostSaleRecord = {
    id: string
    offeringDate: Date | null
    consultant: string
    customer: string
    productDetail: string
    reason: string
    remark: string
    actionPlan: string
}

function parseDateValue(value?: string) {
    const text = cleanText(value)
    if (!text) return null
    const datePart = text.split(" ")[0]
    const slashParts = datePart.split("/")
    if (slashParts.length === 3) {
        const [day, month, year] = slashParts
        const parsed = new Date(Number(year), Number(month) - 1, Number(day))
        return Number.isNaN(parsed.getTime()) ? null : parsed
    }
    const parsed = new Date(text)
    return Number.isNaN(parsed.getTime()) ? null : parsed
}

function parseMoney(value?: string) {
    const raw = cleanText(value).replace(/IDR/gi, "").replace(/[^\d.,-]/g, "")
    if (!raw) return 0
    const dotCount = (raw.match(/\./g) ?? []).length
    const commaCount = (raw.match(/,/g) ?? []).length
    if (dotCount === 1 && commaCount === 0) {
        const parts = raw.split(".")
        if (parts[1].length === 3) return Number(raw.replace(".", "")) || 0
    }
    if (commaCount === 1 && dotCount === 0) {
        const parts = raw.split(",")
        if (parts[1].length === 3) return Number(raw.replace(",", "")) || 0
    }
    if (dotCount > 1 && commaCount === 0) return Number(raw.replaceAll(".", "")) || 0
    if (commaCount > 1 && dotCount === 0) return Number(raw.replaceAll(",", "")) || 0
    const lastComma = raw.lastIndexOf(",")
    const lastDot = raw.lastIndexOf(".")
    const decimalSep = lastComma > lastDot ? "," : "."
    const thousandsSep = decimalSep === "," ? "." : ","
    return Number(raw.replaceAll(thousandsSep, "").replace(decimalSep, ".")) || 0
}

function getField(row: SheetRow, ...keys: string[]) {
    const normalized = Object.entries(row).reduce<Record<string, string>>((acc, [key, value]) => {
        acc[cleanText(key).toLowerCase()] = cleanText(value)
        return acc
    }, {})
    for (const key of keys) {
        const value = normalized[cleanText(key).toLowerCase()]
        if (value) return value
    }
    return ""
}

function aggregate(values: string[], limit = 8): ChartDatum[] {
    const counts = values.reduce<Record<string, number>>((acc, value) => {
        const key = cleanText(value) || "Unknown"
        acc[key] = (acc[key] ?? 0) + 1
        return acc
    }, {})
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, limit)
}

function chunkArray<T>(items: T[], size: number) {
    const chunks: T[][] = []
    for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size))
    return chunks
}'''

if target in content:
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content.replace(target, replacement))
    print('SUCCESS')
else:
    print('TARGET NOT FOUND')
