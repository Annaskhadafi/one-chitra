import { db } from "@/db";
import { goodReceiveManual } from "@/db/schema";
import { user } from "@/db/schema/auth";
import { stockMovements } from "@/db/schema/stock-movements";
import { and, desc, eq, sql } from "drizzle-orm";
import { EprIntegrasiClient } from "./epr-integrasi-client";
import { getOcrStatusMap } from "@/app/actions/vendor-quotation";
import { fetchEprIntegrationSnapshot, getEprVendorPoNumber } from "@/lib/epr-integrasi";

export const revalidate = 300;

type GrManualRow = {
    poNumber: string;
    receiveDate: string;
    supplier: string;
    deliveryType: string;
    referenceDocument: string | null;
    createdAt: string | Date;
    createdBy: string;
};

function buildLatestGrManualByPo(rows: GrManualRow[]) {
    const latestByPo = new Map<string, GrManualRow>();

    for (const row of rows) {
        const poNumber = row.poNumber.trim();
        if (!poNumber) continue;

        const current = latestByPo.get(poNumber);
        if (!current) {
            latestByPo.set(poNumber, row);
            continue;
        }

        const currentReceive = new Date(current.receiveDate).getTime();
        const nextReceive = new Date(row.receiveDate).getTime();
        const currentCreated = new Date(current.createdAt).getTime();
        const nextCreated = new Date(row.createdAt).getTime();

        if (nextReceive > currentReceive || (nextReceive === currentReceive && nextCreated > currentCreated)) {
            latestByPo.set(poNumber, row);
        }
    }

    return latestByPo;
}

export default async function EprIntegrasiPage() {
    const [eprSnapshot, goodReceiveRows, ocrStatusMap] = await Promise.all([
        fetchEprIntegrationSnapshot(),
        db
            .select({
                poNumber: goodReceiveManual.poNumber,
                receiveDate: goodReceiveManual.receiveDate,
                supplier: goodReceiveManual.supplier,
                deliveryType: goodReceiveManual.deliveryType,
                referenceDocument: goodReceiveManual.referenceDocument,
                createdAt: goodReceiveManual.createdAt,
                createdBy: sql<string>`COALESCE(STRING_AGG(DISTINCT COALESCE(${user.name}, 'Unknown'), ', '), '-')`,
            })
            .from(goodReceiveManual)
            .leftJoin(
                stockMovements,
                and(
                    eq(stockMovements.type, "GR_MANUAL"),
                    sql`${stockMovements.referenceNumber} LIKE ('PO: ' || ${goodReceiveManual.poNumber} || ' Item:%')`,
                    sql`DATE(${stockMovements.createdAt}) = DATE(${goodReceiveManual.createdAt})`
                )
            )
            .leftJoin(user, eq(user.id, stockMovements.recordedBy))
            .groupBy(
                goodReceiveManual.id,
                goodReceiveManual.poNumber,
                goodReceiveManual.receiveDate,
                goodReceiveManual.supplier,
                goodReceiveManual.deliveryType,
                goodReceiveManual.referenceDocument,
                goodReceiveManual.createdAt,
            )
            .orderBy(desc(goodReceiveManual.receiveDate), desc(goodReceiveManual.createdAt)),
        getOcrStatusMap(),
    ]);

    const latestGrManualByPo = buildLatestGrManualByPo(goodReceiveRows);
    const entries = eprSnapshot.entries.map((entry) => {
            const poNumber = getEprVendorPoNumber(entry.values);
            const grMatch = poNumber ? latestGrManualByPo.get(poNumber) : undefined;

            return {
                id: entry.id,
                values: entry.values,
                grManual: {
                    matched: Boolean(grMatch),
                    receiveDate: grMatch?.receiveDate ?? null,
                    supplier: grMatch?.supplier ?? null,
                    deliveryType: grMatch?.deliveryType ?? null,
                    referenceDocument: grMatch?.referenceDocument ?? null,
                    createdBy: grMatch?.createdBy ?? null,
                },
            };
        });

    return <EprIntegrasiClient columns={eprSnapshot.columns} entries={entries} viewId="2354" ocrStatusMap={ocrStatusMap} />;
}
