import os
import sys
import re
import json
import psycopg2
from dotenv import dotenv_values
import pypdfium2 as pdfium

config = dotenv_values(".env")
db_url = config.get("DATABASE_URL")
if not db_url:
    print("No DATABASE_URL in .env")
    sys.exit(1)

conn = psycopg2.connect(db_url)
cur = conn.cursor()

# Get invoices from July 2026 onwards without valid PO
query = """
SELECT id, invoice_number, po_number, invoice_file_url, invoice_date, created_at
FROM vendor_invoices
WHERE (created_at >= '2026-07-01' OR invoice_date >= '2026-07-01')
  AND (po_number IS NULL OR po_number !~ '^(82|81|45)[0-9]{8}$')
"""

cur.execute(query)
rows = cur.fetchall()
print(f"Total target invoices: {len(rows)}")

PO_REGEX = re.compile(r'\b(82\d{8}|81\d{8}|45\d{8})\b')

results = {
    "text_found": [],
    "more_than_5_pages": [],
    "single_page": [],
    "file_missing": [],
    "multi_page_no_text": []
}

for row in rows:
    inv_id, inv_num, po_num, file_url, inv_date, created_at = row
    if not file_url:
        results["file_missing"].append({"id": inv_id, "inv": inv_num, "reason": "no_url"})
        continue

    # Resolve local path
    clean_url = file_url.split("?")[0]
    import urllib.parse
    unquoted = urllib.parse.unquote(clean_url)
    rel_path = unquoted.replace("/api/uploads/", "")
    local_path = os.path.join(r"D:\one chitra\one-chitra\public\uploads", rel_path)
    
    # Try alternate path if not found
    if not os.path.exists(local_path):
        # try without prefix or in root uploads
        candidate = os.path.join(r"D:\one chitra\one-chitra\public\uploads\vendor-invoices\sharepoint", os.path.basename(unquoted))
        if os.path.exists(candidate):
            local_path = candidate
        else:
            results["file_missing"].append({"id": inv_id, "inv": inv_num, "path": local_path})
            continue

    try:
        pdf = pdfium.PdfDocument(local_path)
        total_pages = len(pdf)
        
        found_in_text = False
        found_po = None
        found_page = None

        for p_idx in range(total_pages):
            text = pdf[p_idx].get_textpage().get_text_range()
            m = PO_REGEX.search(text)
            if m:
                found_in_text = True
                found_po = m.group(1)
                found_page = p_idx + 1
                break

        if found_in_text:
            results["text_found"].append({
                "id": inv_id,
                "inv": inv_num,
                "po": found_po,
                "page": found_page,
                "total_pages": total_pages,
                "file": local_path
            })
        else:
            if total_pages == 1:
                results["single_page"].append({"id": inv_id, "inv": inv_num, "file": local_path})
            elif total_pages > 5:
                results["more_than_5_pages"].append({"id": inv_id, "inv": inv_num, "total_pages": total_pages, "file": local_path})
            else:
                results["multi_page_no_text"].append({"id": inv_id, "inv": inv_num, "total_pages": total_pages, "file": local_path})
    except Exception as e:
        results["file_missing"].append({"id": inv_id, "inv": inv_num, "error": str(e)})

print(f"\n--- ANALYSIS SUMMARY ---")
print(f"1. Instantly found via digital text: {len(results['text_found'])}")
print(f"2. Has > 5 pages (missed by Phase 2 limit of 5 pages): {len(results['more_than_5_pages'])}")
print(f"3. Multi-page (2-5 pages) but image scans: {len(results['multi_page_no_text'])}")
print(f"4. Single page document: {len(results['single_page'])}")
print(f"5. File missing/corrupt: {len(results['file_missing'])}")

with open("scripts/sharepoint-migration/analysis_185.json", "w") as f:
    json.dump(results, f, indent=2)

print("Saved details to scripts/sharepoint-migration/analysis_185.json")
