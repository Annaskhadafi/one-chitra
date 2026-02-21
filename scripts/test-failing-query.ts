import { db } from "../db";
import { sql } from "drizzle-orm";

async function main() {
    const query = `
select "competitorPrices"."id", "competitorPrices"."info_date", "competitorPrices"."business_consultant_id", "competitorPrices"."customer_name", "competitorPrices"."product_size", "competitorPrices"."category", "competitorPrices"."brand", "competitorPrices"."supplier", "competitorPrices"."currency", "competitorPrices"."price", "competitorPrices"."remark", "competitorPrices"."created_by_id", "competitorPrices"."created_at", "competitorPrices"."updated_at", "competitorPrices_businessConsultant"."data" as "businessConsultant", "competitorPrices_createdBy"."data" as "createdBy" from "competitor_prices" "competitorPrices" left join lateral (select json_build_array("competitorPrices_businessConsultant"."id", "competitorPrices_businessConsultant"."name", "competitorPrices_businessConsultant"."email", "competitorPrices_businessConsultant"."email_verified", "competitorPrices_businessConsultant"."image", "competitorPrices_businessConsultant"."role", "competitorPrices_businessConsultant"."banned", "competitorPrices_businessConsultant"."ban_reason", "competitorPrices_businessConsultant"."ban_expires", "competitorPrices_businessConsultant"."created_at", "competitorPrices_businessConsultant"."updated_at") as "data" from (select * from "user" "competitorPrices_businessConsultant" where "competitorPrices_businessConsultant"."id" = "competitorPrices"."business_consultant_id" limit 1) "competitorPrices_businessConsultant") "competitorPrices_businessConsultant" on true left join lateral (select json_build_array("competitorPrices_createdBy"."id", "competitorPrices_createdBy"."name", "competitorPrices_createdBy"."email", "competitorPrices_createdBy"."email_verified", "competitorPrices_createdBy"."image", "competitorPrices_createdBy"."role", "competitorPrices_createdBy"."banned", "competitorPrices_createdBy"."ban_reason", "competitorPrices_createdBy"."ban_expires", "competitorPrices_createdBy"."created_at", "competitorPrices_createdBy"."updated_at") as "data" from (select * from "user" "competitorPrices_createdBy" where "competitorPrices_createdBy"."id" = "competitorPrices"."created_by_id" limit 1) "competitorPrices_createdBy") "competitorPrices_createdBy" on true order by "competitorPrices"."created_at" desc
  `;

    console.log("Executing failing query...");
    try {
        const result = await db.execute(sql.raw(query));
        console.log("Success! Result rows:", result.rows.length);
    } catch (err) {
        console.error("Query failed with error:", err);
    }
    process.exit(0);
}

main();
