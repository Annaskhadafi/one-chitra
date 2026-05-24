import { readFileSync, writeFileSync } from 'fs';

const file = 'D:/[01] PROJECT/one-chitra/app/actions/slow-moving-products.ts';
let content = readFileSync(file, 'utf8');

// Update type
content = content.replace(
    `export type MonthlySellingQty = {
    materialKey: string
    monthlyQty: Record<string, number>
}`,
    `export type MonthlySellingQty = {
    materialKey: string
    monthlyQty: Record<string, number>
    totalQtySold: number
    totalRevenue: number
}`
);

// Replace function body
const startMarker = 'export async function getSellingOutByMonth';
const startIdx = content.indexOf(startMarker);
let depth = 0, endIdx = startIdx;
for (let i = startIdx; i < content.length; i++) {
    if (content[i] === '{') depth++;
    else if (content[i] === '}') { depth--; if (depth === 0) { endIdx = i + 1; break; } }
}

const newFn = `export async function getSellingOutByMonth(materialKeys: string[]): Promise<MonthlySellingQty[]> {
    if (materialKeys.length === 0) return []

    const upperKeys = materialKeys.map((k) => k.toUpperCase())
    const safeList = upperKeys.map((k) => k.replace(/'/g, "''")).map((k) => "'" + k + "'").join(",")

    const [monthlyResult, summaryResult] = await Promise.all([
        db.execute(
            sql.raw(
                "SELECT UPPER(TRIM(material_no)) AS material_key, TO_CHAR(billing_date, 'YYYY-MM') AS month, SUM(qty) AS total_qty FROM sales_revenue_sap WHERE billing_date IS NOT NULL AND EXTRACT(YEAR FROM billing_date) = EXTRACT(YEAR FROM CURRENT_DATE) AND (cancelled IS NULL OR cancelled = '') AND UPPER(TRIM(material_no)) = ANY(ARRAY[" + safeList + "]) GROUP BY UPPER(TRIM(material_no)), TO_CHAR(billing_date, 'YYYY-MM') ORDER BY UPPER(TRIM(material_no)), TO_CHAR(billing_date, 'YYYY-MM')"
            )
        ),
        db.execute(
            sql.raw(
                "SELECT UPPER(TRIM(material_no)) AS material_key, SUM(qty) AS total_qty_sold, SUM(revenue_in_loc_curr) AS total_revenue FROM sales_revenue_sap WHERE (cancelled IS NULL OR cancelled = '') AND UPPER(TRIM(material_no)) = ANY(ARRAY[" + safeList + "]) GROUP BY UPPER(TRIM(material_no))"
            )
        ),
    ])

    const monthlyMap = new Map<string, Record<string, number>>()
    for (const row of monthlyResult.rows as { material_key: string; month: string; total_qty: string }[]) {
        const key = row.material_key
        if (!monthlyMap.has(key)) monthlyMap.set(key, {})
        monthlyMap.get(key)![row.month] = Number(row.total_qty) || 0
    }

    const summaryMap = new Map<string, { totalQtySold: number; totalRevenue: number }>()
    for (const row of summaryResult.rows as { material_key: string; total_qty_sold: string; total_revenue: string }[]) {
        summaryMap.set(row.material_key, {
            totalQtySold: Number(row.total_qty_sold) || 0,
            totalRevenue: Number(row.total_revenue) || 0,
        })
    }

    return upperKeys.map((k) => ({
        materialKey: k,
        monthlyQty: monthlyMap.get(k) ?? {},
        totalQtySold: summaryMap.get(k)?.totalQtySold ?? 0,
        totalRevenue: summaryMap.get(k)?.totalRevenue ?? 0,
    }))
}`;

const newContent = content.substring(0, startIdx) + newFn + content.substring(endIdx);
writeFileSync(file, newContent, 'utf8');
console.log('Done');