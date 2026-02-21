import { db } from "../db";
import { historyOrders } from "../db/schema";
import fs from "fs";
import Papa from "papaparse";

async function main() {
    console.log("Starting History Orders CSV Import...");
    const filePath = "rev01.01.2016-31.01.2026.csv";

    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
    }

    const fileStream = fs.createReadStream(filePath);
    let batch: Record<string, string | number | null>[] = [];
    const BATCH_SIZE = 1000;
    let totalProcessed = 0;
    let totalInserted = 0;

    await new Promise((resolve, reject) => {
        Papa.parse(fileStream, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header: string) => header.trim(),
            step: async (results, parser) => {
                const item = results.data as Record<string, string>;
                totalProcessed++;

                try {
                    // Parse numeric fields safely
                    const parseNumber = (val: string | undefined | null) => {
                        if (!val) return null;
                        const cleanStr = val.replace(/\./g, "").replace(/,/g, ".");
                        const parsed = parseFloat(cleanStr);
                        return isNaN(parsed) ? null : parsed;
                    };

                    batch.push({
                        sorg: item['Sorg.'] || null,
                        billTy: item['BillTy'] || null,
                        revType: item['Rev. Type'] || null,
                        customer: item['Customer'] || null,
                        customerName: item['Customer Name'] || null,
                        salesman: item['Salesman'] || null,
                        item: item['Item'] || null,
                        sloc: item['Sloc'] || null,
                        plant: item['Plant'] || null,
                        materialNo: item['Material No'] || null,
                        materialDescription: item['Material Description'] || null,
                        sizeDimen: item['Size/Dimen'] || null,
                        materialGroup: item['Material Group'] || null,
                        matGrpDesc: item['Mat Grp Desc.'] || null,
                        matGrp1: item['Mat Grp1'] || null,
                        matGrp1Desc: item['Mat Grp1 Desc.'] || null,
                        matGrp2: item['Mat Grp2'] || null,
                        matGrp2Desc: item['Mat Grp2 Desc.'] || null,
                        matGrp3: item['Mat Grp3'] || null,
                        matGrp3Desc: item['Mat Grp3 Desc.'] || null,
                        matGrp4: item['Mat Grp4'] || null,
                        matGrp4Desc: item['Mat Grp4 Desc.'] || null,
                        matGrp5: item['Mat Grp5'] || null,
                        matGrp5Desc: item['Mat Grp5 Desc.'] || null,
                        qty: parseNumber(item['Qty']),
                        uom: item['UOM'] || null,
                        curr: item['Curr'] || null,
                        basePrice: parseNumber(item['Base Price']),
                        intdeptPrice: parseNumber(item['Intdept Price']),
                        adjustmentPrice: parseNumber(item['Adjustment Price']),
                        revenueInDocCurr: parseNumber(item['Revenue in Doc Curr.']),
                        revenueInLocCurr: parseNumber(item['Revenue in Loc Curr.']),
                        billingNo: item['Billing No'] || null,
                        billingDate: item['Billing Date'] || item['BillingDate'] || null,
                        inco1: item['INCO1'] || null,
                        inco2: item['INCO2'] || null,
                        c: item['C'] || null,
                        cancelled: item['Cancelled'] || null,
                        deliveryNo: item['Delivery No'] || null,
                        salesOrder: item['Sales Order'] || null,
                        workOrder: item['Work Order'] || null,
                        poNo: item['PO No.'] || null,
                        poDate: item['PO Date'] || null,
                        poType: item['PO Type'] || null,
                        costOfSales: parseNumber(item['Cost Of Sales']),
                        profitMargin: parseNumber(item['Profit Margin'])
                    });

                    if (batch.length >= BATCH_SIZE) {
                        parser.pause(); // Pause reading while inserting
                        try {
                            console.log(`Inserting batch of ${batch.length} rows... (Processed: ${totalProcessed})`);
                            await db.insert(historyOrders).values(batch);
                            totalInserted += batch.length;
                            batch = []; // Clear batch
                            parser.resume(); // Resume reading
                        } catch (insertError) {
                            console.error("Error inserting batch:", insertError);
                            reject(insertError);
                        }
                    }
                } catch (e) {
                    console.error("Error processing row:", e);
                }
            },
            complete: async () => {
                if (batch.length > 0) {
                    try {
                        console.log(`Inserting final batch of ${batch.length} rows... (Processed: ${totalProcessed})`);
                        await db.insert(historyOrders).values(batch);
                        totalInserted += batch.length;
                    } catch (insertError) {
                        console.error("Error inserting final batch:", insertError);
                        reject(insertError);
                    }
                }
                console.log(`\nImport completed successfully!`);
                console.log(`Total rows processed: ${totalProcessed}`);
                console.log(`Total rows inserted: ${totalInserted}`);
                resolve(true);
            },
            error: (error) => {
                console.error("Error parsing CSV:", error);
                reject(error);
            }
        });
    });

    console.log("Done.");
    process.exit(0);
}

main().catch((error) => {
    console.error("Fatal error during import:", error);
    process.exit(1);
});
