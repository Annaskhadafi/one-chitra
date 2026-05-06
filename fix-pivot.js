const fs = require('fs');
let c = fs.readFileSync('app/dashboard/r49-dashboard/_components/r49-pivot-table.tsx', 'utf8');

// Normalize newlines to \n to make replacements match
c = c.replace(/\r\n/g, '\n');

// 1. Interfaces
c = c.replace('revenue: number;\n}', 'revenueDocCurr: number;\n    revenueLocCurr: number;\n}');
c = c.replace('isLoading: boolean;\n}', 'isLoading: boolean;\n    useLocCurr: boolean;\n}');
c = c.replace('isLoading\n}: R49PivotTableProps)', 'isLoading,\n    useLocCurr\n}: R49PivotTableProps)');

// 2. dataMap
c = c.replace('{ qty: number, revenue: number }', '{ qty: number, revenueDocCurr: number, revenueLocCurr: number }');
c = c.replace('revenue: Number(item.revenue)', 'revenueDocCurr: Number(item.revenueDocCurr),\n                revenueLocCurr: Number(item.revenueLocCurr)');

// 3. formatCurrency & grandTotals
c = c.replace('    // Grand totals for footer', '    const formatCurrency = (val: number, isUSD = false) => {\n        if (!val || val === 0) return "-";\n        const formatted = new Intl.NumberFormat("id-ID", {\n            minimumFractionDigits: 0,\n            maximumFractionDigits: 0\n        }).format(val);\n        return isUSD ? `$ ${formatted}` : `Rp ${formatted}`;\n    };\n\n    const currencyLabel = useLocCurr ? "USD" : "IDR";\n\n    // Grand totals for footer');

c = c.replace('totals: Record<string, { price: number, rev: number }>', 'totals: Record<string, { qty: number, priceDocCurr: number, revDocCurr: number, priceLocCurr: number, revLocCurr: number }>');
c = c.replace('const totalRev = yearData.reduce((sum, d) => sum + Number(d.revenue), 0);', 'const totalRevDocCurr = yearData.reduce((sum, d) => sum + Number(d.revenueDocCurr), 0);\n            const totalRevLocCurr = yearData.reduce((sum, d) => sum + Number(d.revenueLocCurr), 0);');
c = c.replace('price: totalQty > 0 ? totalRev / totalQty : 0,\n                rev: totalRev', 'qty: totalQty,\n                priceDocCurr: totalQty > 0 ? totalRevDocCurr / totalQty : 0,\n                revDocCurr: totalRevDocCurr,\n                priceLocCurr: totalQty > 0 ? totalRevLocCurr / totalQty : 0,\n                revLocCurr: totalRevLocCurr');

// 4. Mobile view calculations
c = c.replace('const totalRev = matKeys.reduce((sum, m) => sum + (row.materials[m][year]?.revenue || 0), 0)', 'const totalRev = matKeys.reduce((sum, m) => sum + (useLocCurr ? (row.materials[m][year]?.revenueLocCurr || 0) : (row.materials[m][year]?.revenueDocCurr || 0)), 0)');
c = c.replace(/formatValue\(avgPrice\)/g, 'formatCurrency(avgPrice, useLocCurr)');
c = c.replace(/formatValue\(totalRev\)/g, 'formatCurrency(totalRev, useLocCurr)');
c = c.replace(/formatValue\(d\.revenue\)/g, 'formatCurrency(useLocCurr ? d.revenueLocCurr : d.revenueDocCurr, useLocCurr)');

// 5. Desktop view calculations
c = c.replace(/<div className="flex-1 py-1 text-\[10px\]">Revenue in Doc Curr\.<\/div>/g, '<div className="flex-1 py-1 text-[10px]">Revenue ({currencyLabel})</div>');
c = c.replace(/const totalRev = matKeys\.reduce\(\(sum, m\) => sum \+ \(row\.materials\[m\]\[year\]\?\.revenue \|\| 0\), 0\);/g, 'const totalRev = matKeys.reduce((sum, m) => sum + (useLocCurr ? (row.materials[m][year]?.revenueLocCurr || 0) : (row.materials[m][year]?.revenueDocCurr || 0)), 0);');
c = c.replace(/formatValue\(d\?\.revenue && d\?\.qty \? d\.revenue \/ d\.qty : 0\)/g, 'formatCurrency(d?.qty ? (useLocCurr ? d.revenueLocCurr : d.revenueDocCurr) / d.qty : 0, useLocCurr)');
c = c.replace(/formatValue\(d\?\.revenue \|\| 0\)/g, 'formatCurrency(useLocCurr ? (d?.revenueLocCurr || 0) : (d?.revenueDocCurr || 0), useLocCurr)');
c = c.replace(/formatValue\(grandTotals\[year\]\.price\)/g, 'formatCurrency(useLocCurr ? grandTotals[year].priceLocCurr : grandTotals[year].priceDocCurr, useLocCurr)');
c = c.replace(/formatValue\(grandTotals\[year\]\.rev\)/g, 'formatCurrency(useLocCurr ? grandTotals[year].revLocCurr : grandTotals[year].revDocCurr, useLocCurr)');

// Convert back to \r\n if preferred, though not strictly necessary for tsc
c = c.replace(/\n/g, '\r\n');

fs.writeFileSync('app/dashboard/r49-dashboard/_components/r49-pivot-table.tsx', c);
console.log("Done");
