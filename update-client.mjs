import { readFileSync, writeFileSync } from 'fs';

const file = 'D:/[01] PROJECT/one-chitra/app/dashboard/marketing/slow-moving/_components/slow-moving-client.tsx';
let content = readFileSync(file, 'utf8');

// 1. Update sellingMap to also store totalQtySold and totalRevenue
content = content.replace(
    `    const sellingMap = React.useMemo(() => {
        const map = new Map<string, Record<string, number>>()
        for (const item of sellingOutByMonth) {
            map.set(item.materialKey, item.monthlyQty)
        }
        return map
    }, [sellingOutByMonth])`,
    `    const sellingMap = React.useMemo(() => {
        const map = new Map<string, { monthlyQty: Record<string, number>; totalQtySold: number; totalRevenue: number }>()
        for (const item of sellingOutByMonth) {
            map.set(item.materialKey, {
                monthlyQty: item.monthlyQty,
                totalQtySold: item.totalQtySold,
                totalRevenue: item.totalRevenue,
            })
        }
        return map
    }, [sellingOutByMonth])`
);

// 2. Update stats useMemo to include totalQtySold and totalRevenue
content = content.replace(
    `    const stats = React.useMemo(() => {
        const monthlyTotals: Record<string, number> = {}
        const base = reportRows.reduce(
            (acc, row) => {
                acc.totalQty += row.totalQty
                acc.lessThan366Qty += row.lessThan366Qty
                acc.moreThan366Qty += row.moreThan366Qty
                acc.totalValue += row.totalValue
                const monthlyQty = sellingMap.get(row.key) ?? {}
                for (const [month, qty] of Object.entries(monthlyQty)) {
                    monthlyTotals[month] = (monthlyTotals[month] ?? 0) + qty
                }
                return acc
            },
            { totalQty: 0, lessThan366Qty: 0, moreThan366Qty: 0, totalValue: 0 }
        )
        return { ...base, monthlyTotals }
    }, [reportRows, sellingMap])`,
    `    const stats = React.useMemo(() => {
        const monthlyTotals: Record<string, number> = {}
        const base = reportRows.reduce(
            (acc, row) => {
                acc.totalQty += row.totalQty
                acc.lessThan366Qty += row.lessThan366Qty
                acc.moreThan366Qty += row.moreThan366Qty
                acc.totalValue += row.totalValue
                const entry = sellingMap.get(row.key)
                acc.totalQtySold += entry?.totalQtySold ?? 0
                acc.totalRevenue += entry?.totalRevenue ?? 0
                const monthlyQty = entry?.monthlyQty ?? {}
                for (const [month, qty] of Object.entries(monthlyQty)) {
                    monthlyTotals[month] = (monthlyTotals[month] ?? 0) + qty
                }
                return acc
            },
            { totalQty: 0, lessThan366Qty: 0, moreThan366Qty: 0, totalValue: 0, totalQtySold: 0, totalRevenue: 0 }
        )
        return { ...base, monthlyTotals }
    }, [reportRows, sellingMap])`
);

// 3. Update monthly qty lookup in table rows
content = content.replace(
    `                                    const monthlyQty = sellingMap.get(row.key) ?? {}`,
    `                                    const sellingEntry = sellingMap.get(row.key)
                                    const monthlyQty = sellingEntry?.monthlyQty ?? {}
                                    const totalQtySold = sellingEntry?.totalQtySold ?? 0
                                    const totalRevenue = sellingEntry?.totalRevenue ?? 0
                                    const sellOutPct = row.totalQty > 0 ? (totalQtySold / (row.totalQty + totalQtySold)) * 100 : 0`
);

// 4. Add new columns to TableHeader after Total Value and before monthly cols
content = content.replace(
    `                                <TableHead className="h-10 text-right">Unit Price</TableHead>
                                <TableHead className="h-10 text-right">Total Value</TableHead>
                                {allMonths.map((month) => (`,
    `                                <TableHead className="h-10 text-right">Unit Price</TableHead>
                                <TableHead className="h-10 text-right">Total Value</TableHead>
                                <TableHead className="h-10 text-right text-emerald-700">Total Terjual</TableHead>
                                <TableHead className="h-10 text-right text-emerald-700">Revenue Terjual</TableHead>
                                <TableHead className="h-10 text-right text-orange-700">% Sell Out</TableHead>
                                {allMonths.map((month) => (`
);

// 5. Add new cells in table rows after Total Value and before monthly cols
content = content.replace(
    `                                            <TableCell className="text-right font-mono">{formatCurrency(row.totalValue)}</TableCell>
                                            {allMonths.map((month) => (`,
    `                                            <TableCell className="text-right font-mono">{formatCurrency(row.totalValue)}</TableCell>
                                            <TableCell className="text-right font-mono text-emerald-700">{formatQty(totalQtySold)}</TableCell>
                                            <TableCell className="text-right font-mono text-emerald-700">{formatCurrency(totalRevenue)}</TableCell>
                                            <TableCell className="text-right font-mono text-orange-700 font-semibold">
                                                {sellOutPct > 0 ? sellOutPct.toFixed(1) + "%" : "-"}
                                            </TableCell>
                                            {allMonths.map((month) => (`
);

// 6. Update footer tfoot - add new total cells after Total Value
content = content.replace(
    `                                    <td className="px-4 text-right font-mono text-sm"></td>
                                    <td className="px-4 text-right font-mono text-sm">{formatCurrency(stats.totalValue)}</td>
                                    {allMonths.map((month) => (`,
    `                                    <td className="px-4 text-right font-mono text-sm"></td>
                                    <td className="px-4 text-right font-mono text-sm">{formatCurrency(stats.totalValue)}</td>
                                    <td className="px-4 text-right font-mono text-sm text-emerald-700">{formatQty(stats.totalQtySold)}</td>
                                    <td className="px-4 text-right font-mono text-sm text-emerald-700">{formatCurrency(stats.totalRevenue)}</td>
                                    <td className="px-4 text-right font-mono text-sm text-orange-700 font-semibold">
                                        {stats.totalQty > 0 ? ((stats.totalQtySold / (stats.totalQty + stats.totalQtySold)) * 100).toFixed(1) + "%" : "-"}
                                    </td>
                                    {allMonths.map((month) => (`
);

// 7. Update totalCols count (+3 for new cols)
content = content.replace(
    `    const totalCols = 9 + totalMonthCols`,
    `    const totalCols = 12 + totalMonthCols`
);

// 8. Update export to include new columns
content = content.replace(
    `            const base: Record<string, unknown> = {
                No: index + 1,
                "Material Number": row.materialNumber,
                Desc: row.description,
                "All Qty": row.totalQty,
                "<366": row.lessThan366Qty,
                "366>": row.moreThan366Qty,
                "Unit Price": Math.round(row.unitPrice),
                "Total Value": Math.round(row.totalValue),
            }
            for (const month of allMonths) {
                base[\`Selling \${formatMonthLabel(month)}\`] = monthlyQty[month] ?? 0
            }`,
    `            const sellingEntry = sellingMap.get(row.key)
            const totalQtySold = sellingEntry?.totalQtySold ?? 0
            const totalRevenue = sellingEntry?.totalRevenue ?? 0
            const monthlyQty = sellingEntry?.monthlyQty ?? {}
            const sellOutPct = row.totalQty > 0 ? ((totalQtySold / (row.totalQty + totalQtySold)) * 100).toFixed(1) + "%" : "-"
            const base: Record<string, unknown> = {
                No: index + 1,
                "Material Number": row.materialNumber,
                Desc: row.description,
                "All Qty": row.totalQty,
                "<366": row.lessThan366Qty,
                "366>": row.moreThan366Qty,
                "Unit Price": Math.round(row.unitPrice),
                "Total Value": Math.round(row.totalValue),
                "Total Terjual": totalQtySold,
                "Revenue Terjual": Math.round(totalRevenue),
                "% Sell Out": sellOutPct,
            }
            for (const month of allMonths) {
                base[\`Selling \${formatMonthLabel(month)}\`] = monthlyQty[month] ?? 0
            }`
);

// 9. Fix old monthlyQty reference in export (remove old line)
content = content.replace(
    `        const rows = reportRows.map((row, index) => {
            const monthlyQty = sellingMap.get(row.key) ?? {}`,
    `        const rows = reportRows.map((row, index) => {`
);

writeFileSync(file, content, 'utf8');
console.log('Done');