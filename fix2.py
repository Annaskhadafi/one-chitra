import os

filepath = r'd:\[01] PROJECT\one-chitra\app\dashboard\competitor-info-new\_components\price-competitor-dashboard.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

target = '''        const [day, month, year] = slashParts
        const parsed = new Date(Number(year), Number(month) - 1, Number(day))
    if (value >= 1_000) return `Rp ${(value / 1_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} rb`'''

replacement = r'''        const [day, month, year] = slashParts
        const parsed = new Date(Number(year), Number(month) - 1, Number(day))
        return Number.isNaN(parsed.getTime()) ? null : parsed
    }
    const parsed = new Date(text)
    return Number.isNaN(parsed.getTime()) ? null : parsed
}

function parseMoney(value?: string) {
    const raw = cleanText(value).replace(/[^\d.,-]/g, "")
    if (!raw) return 0
    const dotCount = (raw.match(/\./g) ?? []).length
    const commaCount = (raw.match(/,/g) ?? []).length
    if (dotCount === 1 && commaCount === 0) {
        const parts = raw.split(".")
        if (parts[1].length === 3) {
            const parsed = Number(raw.replace(".", ""))
            return Number.isFinite(parsed) ? parsed : 0
        }
    }
    if (commaCount === 1 && dotCount === 0) {
        const parts = raw.split(",")
        if (parts[1].length === 3) {
            const parsed = Number(raw.replace(",", ""))
            return Number.isFinite(parsed) ? parsed : 0
        }
    }
    if (dotCount > 1 && commaCount === 0) {
        const parsed = Number(raw.replaceAll(".", ""))
        return Number.isFinite(parsed) ? parsed : 0
    }
    if (commaCount > 1 && dotCount === 0) {
        const parsed = Number(raw.replaceAll(",", ""))
        return Number.isFinite(parsed) ? parsed : 0
    }
    const lastComma = raw.lastIndexOf(",")
    const lastDot = raw.lastIndexOf(".")
    const decimalSep = lastComma > lastDot ? "," : "."
    const thousandsSep = decimalSep === "," ? "." : ","
    const canonical = raw.replaceAll(thousandsSep, "").replace(decimalSep, ".")
    const parsed = Number(canonical)
    return Number.isFinite(parsed) ? parsed : 0
}

function formatMoney(value: number) {
    if (value >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} M`
    if (value >= 1_000_000) return `Rp ${(value / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`
    if (value >= 1_000) return `Rp ${(value / 1_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} rb`'''

if target in content:
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content.replace(target, replacement))
    print('SUCCESS')
else:
    print('TARGET NOT FOUND')
