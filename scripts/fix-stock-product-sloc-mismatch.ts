import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "../db";

const normalizedTextSql = (identifier: string) => sql.raw(`
    CASE
        WHEN ${identifier} IS NULL OR BTRIM(${identifier}) = '' THEN ''
        WHEN BTRIM(${identifier}) ~ '^[0-9]+$' THEN LPAD(
            COALESCE(NULLIF(REGEXP_REPLACE(BTRIM(${identifier}), '^0+', ''), ''), '0'),
            3,
            '0'
        )
        ELSE UPPER(BTRIM(${identifier}))
    END
`);

async function main() {
    console.log("Checking duplicate stock rows that can be merged safely...");

    const productSlocSql = normalizedTextSql("p.sloc");
    const warehouseSlocSql = normalizedTextSql("w.sloc");

    const summaryBefore = await db.execute(sql`
        WITH stock_view AS (
            SELECT
                sl.id AS stock_level_id,
                sl.product_id,
                sl.warehouse_id,
                sl.total_stock,
                sl.booked_stock,
                sl.draft_booked_stock,
                sl.valuation_value,
                sl.min_stock,
                p.material_number,
                ${productSlocSql} AS product_sloc,
                ${warehouseSlocSql} AS warehouse_sloc
            FROM stock_levels sl
            JOIN products p ON p.id = sl.product_id
            JOIN warehouses w ON w.id = sl.warehouse_id
        ),
        duplicate_groups AS (
            SELECT warehouse_id, material_number, COUNT(*) AS row_count
            FROM stock_view
            GROUP BY warehouse_id, material_number
            HAVING COUNT(*) > 1
        ),
        mergeable_groups AS (
            SELECT
                dg.warehouse_id,
                dg.material_number,
                COUNT(*) FILTER (WHERE sv.product_sloc = sv.warehouse_sloc) AS canonical_count
            FROM duplicate_groups dg
            JOIN stock_view sv
              ON sv.warehouse_id = dg.warehouse_id
             AND sv.material_number = dg.material_number
            GROUP BY dg.warehouse_id, dg.material_number
        )
        SELECT
            (SELECT COUNT(*) FROM duplicate_groups) AS duplicate_groups,
            COUNT(*) FILTER (WHERE canonical_count = 1) AS mergeable_groups
        FROM mergeable_groups
    `);

    console.log("Before:", summaryBefore.rows[0]);

    await db.transaction(async (tx) => {
        await tx.execute(sql`
            WITH stock_view AS (
                SELECT
                    sl.id AS stock_level_id,
                    sl.product_id,
                    sl.warehouse_id,
                    sl.total_stock,
                    sl.booked_stock,
                    sl.draft_booked_stock,
                    sl.valuation_value,
                    sl.min_stock,
                    sl.updated_at,
                    p.material_number,
                    ${productSlocSql} AS product_sloc,
                    ${warehouseSlocSql} AS warehouse_sloc
                FROM stock_levels sl
                JOIN products p ON p.id = sl.product_id
                JOIN warehouses w ON w.id = sl.warehouse_id
            ),
            duplicate_groups AS (
                SELECT warehouse_id, material_number
                FROM stock_view
                GROUP BY warehouse_id, material_number
                HAVING COUNT(*) > 1
            ),
            ranked_rows AS (
                SELECT
                    sv.*,
                    COUNT(*) FILTER (WHERE sv.product_sloc = sv.warehouse_sloc) OVER (PARTITION BY sv.warehouse_id, sv.material_number) AS canonical_count,
                    ROW_NUMBER() OVER (
                        PARTITION BY sv.warehouse_id, sv.material_number
                        ORDER BY
                            CASE WHEN sv.product_sloc = sv.warehouse_sloc THEN 0 ELSE 1 END,
                            sv.stock_level_id
                    ) AS preferred_rank
                FROM stock_view sv
                JOIN duplicate_groups dg
                  ON dg.warehouse_id = sv.warehouse_id
                 AND dg.material_number = sv.material_number
            ),
            canonical_rows AS (
                SELECT warehouse_id, material_number, stock_level_id
                FROM ranked_rows
                WHERE canonical_count = 1
                  AND preferred_rank = 1
            ),
            merged_totals AS (
                SELECT
                    rr.warehouse_id,
                    rr.material_number,
                    SUM(rr.total_stock) AS total_stock_sum,
                    SUM(rr.booked_stock) AS booked_stock_sum,
                    SUM(rr.draft_booked_stock) AS draft_booked_stock_sum,
                    SUM(COALESCE(rr.valuation_value, 0)::numeric) AS valuation_sum,
                    MAX(rr.min_stock) AS min_stock_max,
                    MAX(rr.updated_at) AS latest_updated_at
                FROM ranked_rows rr
                WHERE rr.canonical_count = 1
                GROUP BY rr.warehouse_id, rr.material_number
            )
            UPDATE stock_levels sl
            SET
                total_stock = mt.total_stock_sum,
                booked_stock = mt.booked_stock_sum,
                draft_booked_stock = mt.draft_booked_stock_sum,
                valuation_value = mt.valuation_sum,
                min_stock = mt.min_stock_max,
                updated_at = GREATEST(sl.updated_at, mt.latest_updated_at, NOW())
            FROM canonical_rows cr
            JOIN merged_totals mt
              ON mt.warehouse_id = cr.warehouse_id
             AND mt.material_number = cr.material_number
            WHERE sl.id = cr.stock_level_id
        `);

        await tx.execute(sql`
            WITH stock_view AS (
                SELECT
                    sl.id AS stock_level_id,
                    sl.warehouse_id,
                    p.material_number,
                    ${productSlocSql} AS product_sloc,
                    ${warehouseSlocSql} AS warehouse_sloc
                FROM stock_levels sl
                JOIN products p ON p.id = sl.product_id
                JOIN warehouses w ON w.id = sl.warehouse_id
            ),
            duplicate_groups AS (
                SELECT warehouse_id, material_number
                FROM stock_view
                GROUP BY warehouse_id, material_number
                HAVING COUNT(*) > 1
            ),
            ranked_rows AS (
                SELECT
                    sv.*,
                    COUNT(*) FILTER (WHERE sv.product_sloc = sv.warehouse_sloc) OVER (PARTITION BY sv.warehouse_id, sv.material_number) AS canonical_count,
                    ROW_NUMBER() OVER (
                        PARTITION BY sv.warehouse_id, sv.material_number
                        ORDER BY
                            CASE WHEN sv.product_sloc = sv.warehouse_sloc THEN 0 ELSE 1 END,
                            sv.stock_level_id
                    ) AS preferred_rank
                FROM stock_view sv
                JOIN duplicate_groups dg
                  ON dg.warehouse_id = sv.warehouse_id
                 AND dg.material_number = sv.material_number
            )
            DELETE FROM stock_levels sl
            USING ranked_rows rr
            WHERE sl.id = rr.stock_level_id
              AND rr.canonical_count = 1
              AND rr.preferred_rank > 1
        `);
    });

    const summaryAfter = await db.execute(sql`
        WITH stock_view AS (
            SELECT
                sl.id AS stock_level_id,
                sl.warehouse_id,
                p.material_number
            FROM stock_levels sl
            JOIN products p ON p.id = sl.product_id
        )
        SELECT COUNT(*) AS remaining_duplicate_groups
        FROM (
            SELECT warehouse_id, material_number
            FROM stock_view
            GROUP BY warehouse_id, material_number
            HAVING COUNT(*) > 1
        ) duplicates
    `);

    console.log("After:", summaryAfter.rows[0]);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Failed to fix duplicate stock rows:", error);
        process.exit(1);
    });
