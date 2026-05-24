import { readFileSync, writeFileSync } from 'fs';
const file = 'D:/[01] PROJECT/one-chitra/app/actions/slow-moving-products.ts';
let content = readFileSync(file, 'utf8');

content = content.replace(
    "SELECT UPPER(TRIM(material_no)) AS material_key, SUM(qty) AS total_qty_sold, SUM(revenue_in_loc_curr) AS total_revenue FROM sales_revenue_sap WHERE (cancelled IS NULL OR cancelled = '') AND UPPER(TRIM(material_no)) = ANY(ARRAY[\" + safeList + \"]) GROUP BY UPPER(TRIM(material_no))",
    "SELECT UPPER(TRIM(material_no)) AS material_key, SUM(qty) AS total_qty_sold, SUM(revenue_in_loc_curr) AS total_revenue FROM sales_revenue_sap WHERE billing_date IS NOT NULL AND EXTRACT(YEAR FROM billing_date) = EXTRACT(YEAR FROM CURRENT_DATE) AND (cancelled IS NULL OR cancelled = '') AND UPPER(TRIM(material_no)) = ANY(ARRAY[\" + safeList + \"]) GROUP BY UPPER(TRIM(material_no))"
);

writeFileSync(file, content, 'utf8');
console.log('Done');