import { readFileSync, writeFileSync } from 'fs';
const file = 'D:/[01] PROJECT/one-chitra/app/dashboard/marketing/slow-moving/_components/slow-moving-client.tsx';
let c = readFileSync(file, 'utf8');

// 1. Remove the 3 headers from current position (before monthly cols)
c = c.replace(
    `                                <TableHead className="h-10 text-right text-emerald-700">Total Terjual</TableHead>
                                <TableHead className="h-10 text-right text-emerald-700">Revenue Terjual</TableHead>
                                <TableHead className="h-10 text-right text-orange-700">% Sell Out</TableHead>
                                {allMonths.map((month) => (`,
    `                                {allMonths.map((month) => (`
);

// 2. Add them back after monthly cols, before Aksi
c = c.replace(
    `                                <TableHead className="h-10 text-right">Aksi</TableHead>`,
    `                                <TableHead className="h-10 text-right text-emerald-700">Total Terjual</TableHead>
                                <TableHead className="h-10 text-right text-emerald-700">Revenue Terjual</TableHead>
                                <TableHead className="h-10 text-right text-orange-700">% Sell Out</TableHead>
                                <TableHead className="h-10 text-right">Aksi</TableHead>`
);

// 3. Remove the 3 cells from current position in row (before monthly cells)
c = c.replace(
    `                                            <TableCell className="text-right font-mono text-emerald-700">{formatQty(totalQtySold)}</TableCell>
                                            <TableCell className="text-right font-mono text-emerald-700">{formatCurrency(totalRevenue)}</TableCell>
                                            <TableCell className="text-right font-mono text-orange-700 font-semibold">
                                                {sellOutPct > 0 ? sellOutPct.toFixed(1) + "%" : "-"}
                                            </TableCell>
                                            {allMonths.map((month) => (`,
    `                                            {allMonths.map((month) => (`
);

// 4. Add them back after monthly cells, before Aksi cell
c = c.replace(
    `                                            <TableCell className="text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-destructive"
                                                    onClick={() => handleRemoveImported(row.key)}`,
    `                                            <TableCell className="text-right font-mono text-emerald-700">{formatQty(totalQtySold)}</TableCell>
                                            <TableCell className="text-right font-mono text-emerald-700">{formatCurrency(totalRevenue)}</TableCell>
                                            <TableCell className="text-right font-mono text-orange-700 font-semibold">
                                                {sellOutPct > 0 ? sellOutPct.toFixed(1) + "%" : "-"}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-destructive"
                                                    onClick={() => handleRemoveImported(row.key)}`
);

// 5. Remove the 3 footer cells from current position (before monthly footer cells)
c = c.replace(
    `                                    <td className="px-4 text-right font-mono text-sm text-emerald-700">{formatQty(stats.totalQtySold)}</td>
                                    <td className="px-4 text-right font-mono text-sm text-emerald-700">{formatCurrency(stats.totalRevenue)}</td>
                                    <td className="px-4 text-right font-mono text-sm text-orange-700 font-semibold">
                                        {stats.totalQty > 0 ? ((stats.totalQtySold / (stats.totalQty + stats.totalQtySold)) * 100).toFixed(1) + "%" : "-"}
                                    </td>
                                    {allMonths.map((month) => (`,
    `                                    {allMonths.map((month) => (`
);

// 6. Add them back after monthly footer cells, before last <td />
c = c.replace(
    `                                    <td />
                                </tr>`,
    `                                    <td className="px-4 text-right font-mono text-sm text-emerald-700">{formatQty(stats.totalQtySold)}</td>
                                    <td className="px-4 text-right font-mono text-sm text-emerald-700">{formatCurrency(stats.totalRevenue)}</td>
                                    <td className="px-4 text-right font-mono text-sm text-orange-700 font-semibold">
                                        {stats.totalQty > 0 ? ((stats.totalQtySold / (stats.totalQty + stats.totalQtySold)) * 100).toFixed(1) + "%" : "-"}
                                    </td>
                                    <td />
                                </tr>`
);

writeFileSync(file, c, 'utf8');
console.log('Done');